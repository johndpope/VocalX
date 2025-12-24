import { getServerSession } from "next-auth";
import { z } from "zod";
import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { getS3Client, requireBucket } from "@/lib/s3";
import { ProcessedFileModel, ProcessingJobModel, UserModel } from "@/models";

const QuerySchema = z.object({
  which: z.enum(["target", "residual"]).default("target"),
});

export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(401, "Unauthorized");

  const job = await ProcessingJobModel.findOne({ id: params.jobId, userId: user.id })
    .select({ id: 1 })
    .lean();
  if (!job) return jsonError(404, "Not found");

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ which: url.searchParams.get("which") });
  if (!parsed.success) return jsonError(400, "Invalid query", parsed.error.flatten());

  const processed = await ProcessedFileModel.findOne({ jobId: job.id })
    .select({ _id: 0, targetAudioS3Key: 1, residualAudioS3Key: 1 })
    .lean();

  const which = parsed.data.which;
  const key = which === "target" ? processed?.targetAudioS3Key : processed?.residualAudioS3Key;
  if (!key) return jsonError(404, "Result not ready");

  const s3 = getS3Client();
  const bucket = requireBucket();
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  const body = obj.Body;
  if (!body) return jsonError(404, "Missing object body");

  const filename = `job-${job.id}.${which}.wav`;
  const contentType = obj.ContentType || "audio/wav";

  const stream =
    body instanceof Readable
      ? (Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>)
      : (body as unknown as ReadableStream<Uint8Array>);

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
