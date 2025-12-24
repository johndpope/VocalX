import { z } from "zod";
import { connectMongoose } from "@/lib/mongo";
import { hashPassword } from "@/lib/password";
import { UserModel } from "@/models";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    await connectMongoose();

    const existing = await UserModel.findOne({ email }).select({ id: 1 }).lean();
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = hashPassword(parsed.data.password);

    await UserModel.create({
      id: crypto.randomUUID(),
      email,
      passwordHash,
      subscriptionTier: "free",
      usageLimit: 10,
      usageUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    try {
      console.error("/api/auth/signup error:", msg);
    } catch {}
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
