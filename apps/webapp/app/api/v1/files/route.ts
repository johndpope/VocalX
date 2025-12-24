import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongo";
import { FileModel, UserModel } from "@/models";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return jsonError(401, "Unauthorized");

  await connectMongoose();

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    page: url.searchParams.get("page"),
    limit: url.searchParams.get("limit"),
  });
  if (!parsed.success) return jsonError(400, "Invalid query", parsed.error.flatten());

  const user = await UserModel.findOne({ email: session.user.email }).select({ id: 1 }).lean();
  if (!user) return Response.json({ items: [], page: parsed.data.page, limit: parsed.data.limit, total: 0 });

  const { page, limit } = parsed.data;

  type FileListItem = {
    id: string;
    originalFilename: string;
    fileType: string;
    fileSize: number;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
  };

  const [total, items] = await Promise.all([
    FileModel.countDocuments({ userId: user.id }),
    FileModel.find({ userId: user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
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
      .lean() as Promise<FileListItem[]>,
  ]);

  return Response.json({
    page,
    limit,
    total,
    items: items.map((f: FileListItem) => ({
      ...f,
      fileSize: String(f.fileSize),
    })),
  });
}


