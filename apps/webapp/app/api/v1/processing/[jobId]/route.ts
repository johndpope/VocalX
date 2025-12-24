import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { getWorkerJobStatus } from "@/lib/worker";
import { ProcessingJobModel, UserModel } from "@/models";

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(401, "Unauthorized");

  const jobId = params.jobId;
  const job = await ProcessingJobModel.findOne({ id: jobId, userId: user.id })
    .select({
      _id: 0,
      id: 1,
      status: 1,
      progress: 1,
      errorMessage: 1,
      workerJobId: 1,
      createdAt: 1,
      startedAt: 1,
      completedAt: 1,
    })
    .lean();

  if (!job) return jsonError(404, "Not found");

  // Poll the worker opportunistically so the client can just poll this endpoint.
  const workerJobId = (job as { workerJobId?: unknown }).workerJobId;
  if ((job.status === "queued" || job.status === "processing") && typeof workerJobId === "string" && workerJobId) {
    try {
      const st = await getWorkerJobStatus(workerJobId);
      if (st.status === "processing") {
        await ProcessingJobModel.updateOne(
          { id: job.id },
          {
            $set: {
              status: "processing",
              progress: typeof st.progress === "number" ? Math.max(0, Math.min(100, st.progress)) : job.progress,
              startedAt: job.startedAt ?? new Date(),
              errorMessage: null,
            },
          }
        );
      } else if (st.status === "succeeded") {
        await ProcessingJobModel.updateOne(
          { id: job.id },
          {
            $set: {
              status: "completed",
              progress: 100,
              completedAt: new Date(),
              errorMessage: null,
            },
          }
        );
      } else if (st.status === "failed") {
        await ProcessingJobModel.updateOne(
          { id: job.id },
          {
            $set: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: st.error ?? "Worker job failed",
            },
          }
        );
      }
    } catch {
      // Don't fail client polling if the worker is temporarily unavailable.
    }
  }

  const refreshed = await ProcessingJobModel.findOne({ id: job.id, userId: user.id })
    .select({ _id: 0, id: 1, status: 1, progress: 1, errorMessage: 1 })
    .lean();

  return Response.json({
    jobId: refreshed?.id ?? job.id,
    status: refreshed?.status ?? job.status,
    progress: typeof refreshed?.progress === "number" ? refreshed.progress : job.progress,
    eta: null,
    error: refreshed?.errorMessage ?? job.errorMessage ?? null,
  });
}


