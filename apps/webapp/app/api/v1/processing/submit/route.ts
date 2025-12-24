import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { getS3Client, requireBucket } from "@/lib/s3";
import { submitWorkerJob } from "@/lib/worker";
import { FileModel, ProcessedFileModel, ProcessingJobModel, UserModel } from "@/models";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BodySchema = z.object({
  fileId: z.string().uuid(),
  which: z.enum(["target", "residual"]).default("target"),
  promptType: z.enum(["text", "span", "visual"]),
  promptData: z.any(),
  quality: z.enum(["standard", "high"]).default("standard"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const parsed = await readJson(req, BodySchema);
  if (!parsed.ok) return jsonError(400, "Invalid request", parsed.error);

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(401, "Unauthorized");

  const file = await FileModel.findOne({ id: parsed.data.fileId, userId: user.id })
    .select({ id: 1, s3Key: 1 })
    .lean();
  if (!file) return jsonError(404, "File not found");
  const s3Key = (file as { s3Key?: unknown }).s3Key;
  if (typeof s3Key !== "string" || !s3Key) return jsonError(500, "File is missing S3 key");

  // TODO: enforce quota based on duration once duration is populated.

  const job = await ProcessingJobModel.create({
    id: crypto.randomUUID(),
    userId: user.id,
    fileId: file.id,
    promptType: parsed.data.promptType,
    promptData: parsed.data.promptData,
    status: "queued",
    progress: 0,
    createdAt: new Date(),
  });

  const which = parsed.data.which;
  const s3 = getS3Client();
  const bucket = requireBucket();

  const outputKey = `jobs/${user.id}/${job.id}/${which}.wav`;
  await ProcessedFileModel.create({
    id: crypto.randomUUID(),
    jobId: job.id,
    fileId: file.id,
    targetAudioS3Key: which === "target" ? outputKey : undefined,
    residualAudioS3Key: which === "residual" ? outputKey : undefined,
    createdAt: new Date(),
  });

  const inputUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    }),
    { expiresIn: 3600 }
  );

  const outputUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      ContentType: "audio/wav",
    }),
    { expiresIn: 3600 }
  );

  const worker = await submitWorkerJob({
    jobId: job.id,
    which,
    inputUrl,
    outputUrl,
    description: String(parsed.data.promptData?.text ?? parsed.data.promptData?.description ?? ""),
    anchorsJson: String(parsed.data.promptData?.anchorsJson ?? ""),
  });

  await ProcessingJobModel.updateOne(
    { id: job.id },
    { $set: { workerJobId: worker.workerJobId, status: "processing", startedAt: new Date() } }
  );

  return Response.json({
    jobId: job.id,
    status: "processing",
    estimatedTime: 0,
  });
}


