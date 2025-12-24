import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { FileModel, UserModel } from "@/models";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(404, "Not found");

  const file = await FileModel.findOne({ id: params.id, userId: user.id })
    .select({
      _id: 0,
      id: 1,
      originalFilename: 1,
      fileType: 1,
      fileSize: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();
  if (!file) return jsonError(404, "Not found");

  return Response.json({ ...file, fileSize: String(file.fileSize) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(404, "Not found");

  const file = await FileModel.findOne({ id: params.id, userId: user.id }).select({ id: 1 }).lean();
  if (!file) return jsonError(404, "Not found");

  // TODO: delete from S3 as well (once S3 delete logic is added).
  await FileModel.deleteOne({ id: file.id });

  return Response.json({ success: true });
}


