import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";

/**
 * Stripe webhook stub.
 * We intentionally do not attempt to verify signatures until STRIPE_WEBHOOK_SECRET is provided.
 */
export async function POST() {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    return jsonError(501, "Stripe not configured yet");
  }

  // TODO: Verify Stripe signature and process events.
  return Response.json({ ok: true });
}


