import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { ProcessingJobModel, UserModel } from "@/models";

export async function POST(_req: Request, { params }: { params: { jobId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return jsonError(401, "Unauthorized");

  const job = await ProcessingJobModel.findOne({ id: params.jobId, userId: user.id }).select({ id: 1 }).lean();
  if (!job) return jsonError(404, "Not found");

  // TODO: Call Paperspace cancel API when integration is enabled.
  await ProcessingJobModel.updateOne(
    { id: job.id },
    { $set: { status: "cancelled", completedAt: new Date(), errorMessage: "Cancelled by user" } }
  );

  return Response.json({ success: true });
}


