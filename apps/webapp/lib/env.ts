import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  MONGO_URL: z.string().optional(),
  MONGO_DB_NAME: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  // Vertex AI (recommended for MVP if GPU VM quota is hard)
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().optional(),
  VERTEX_ENDPOINT_ID: z.string().optional(),
  VERTEX_PREDICT_ROUTE: z.string().optional(), // default: /predict
  // Worker base URL (on GCP). Kept `LOCAL_WORKER_URL` for backward compatibility.
  WORKER_URL: z.string().optional(),
  LOCAL_WORKER_URL: z.string().optional(),
  WORKER_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = EnvSchema.parse(process.env);
export const env = {
  ...parsed,
  WORKER_URL: parsed.WORKER_URL ?? parsed.LOCAL_WORKER_URL,
};


