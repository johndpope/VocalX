import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectMongoose } from "@/lib/mongo";
import { FileModel, UserModel } from "@/models";
import { getS3Client, requireBucket } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectMongoose();

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { filename, fileType, fileSize } = parsed.data;
  // Hard limit from spec
  if (fileSize > 2 * 1024 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 2GB)" }, { status: 413 });
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (session.user.name) update.name = session.user.name;
  if (session.user.image) update.avatarUrl = session.user.image;

  const user = await UserModel.findOneAndUpdate(
    { email: session.user.email },
    {
      $set: update,
      $setOnInsert: {
        id: crypto.randomUUID(),
        email: session.user.email,
        name: session.user.name ?? undefined,
        avatarUrl: session.user.image ?? undefined,
        subscriptionTier: "free",
        usageLimit: 10,
        usageUsed: 0,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true }
  ).select({ id: 1 }).lean();

  if (!user?.id) {
    return Response.json({ error: "Unable to create user" }, { status: 500 });
  }

  const id = crypto.randomUUID();
  const key = `temp/${user.id}/${id}/${filename}`;

  const s3 = getS3Client();
  const bucket = requireBucket();

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    }),
    { expiresIn: 3600 }
  );

  await FileModel.create({
    id,
    userId: user.id,
    originalFilename: filename,
    fileType,
    fileSize,
    s3Key: key,
    status: "uploaded",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Response.json({ fileId: id, uploadUrl, expiresIn: 3600 });
}


