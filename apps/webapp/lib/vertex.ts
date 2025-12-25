import { GoogleAuth } from "google-auth-library";
import { env } from "./env";

export type VertexSamAudioPredictInput = {
  audioBytes: Uint8Array;
  filename: string;
  description: string;
  anchorsJson?: string;
  which: "target" | "residual";
  predictSpans?: boolean;
  rerankingCandidates?: number;
};

type VertexPrediction = {
  ok?: boolean;
  target_wav_base64?: string;
  residual_wav_base64?: string;
  warning?: string;
  error?: string;
  details?: unknown;
};

function getHeaderValue(headers: HeadersInit, name: string): string | undefined {
  const lower = name.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(lower) ?? undefined;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }
  const obj = headers as Record<string, string>;
  return obj[name] ?? obj[lower];
}

function requireVertexConfig() {
  const projectId = env.VERTEX_PROJECT_ID;
  const location = env.VERTEX_LOCATION;
  const endpointId = env.VERTEX_ENDPOINT_ID;
  const predictRoute = env.VERTEX_PREDICT_ROUTE || "/predict";

  if (!projectId || !location || !endpointId) {
    throw new Error(
      "Vertex is not configured. Set VERTEX_PROJECT_ID, VERTEX_LOCATION, and VERTEX_ENDPOINT_ID."
    );
  }

  return { projectId, location, endpointId, predictRoute };
}

function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function isVertexEnabled(): boolean {
  return Boolean(env.VERTEX_PROJECT_ID && env.VERTEX_LOCATION && env.VERTEX_ENDPOINT_ID);
}

export async function vertexSamAudioPredict(input: VertexSamAudioPredictInput): Promise<VertexPrediction> {
  const { projectId, location, endpointId, predictRoute } = requireVertexConfig();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/locations/${encodeURIComponent(location)}/endpoints/${encodeURIComponent(endpointId)}:rawPredict`;

  // Vertex rawPredict forwards the request to your custom container predictRoute.
  // Docs: rawPredict uses the container's predictRoute and passes the body through.
  const body = {
    instances: [
      {
        audio_b64: base64Encode(input.audioBytes),
        filename: input.filename,
        description: input.description,
        anchors_json: input.anchorsJson ?? "",
        which: input.which,
        predict_spans: Boolean(input.predictSpans ?? false),
        reranking_candidates: Number(input.rerankingCandidates ?? 0),
      },
    ],
  };

  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const headers = await client.getRequestHeaders();

  // rawPredict requires content-type json, and the auth header from ADC (service account).
  const authHeader = getHeaderValue(headers, "authorization");
  if (!authHeader) {
    return {
      ok: false,
      error: "Missing Google auth header",
      details:
        "No Authorization header was returned by ADC. Ensure the service is running on GCP with a service account (or GOOGLE_APPLICATION_CREDENTIALS set).",
    };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: String(authHeader),
      "content-type": "application/json",
      "x-vertex-ai-predict-route": predictRoute,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    return { ok: false, error: "Vertex rawPredict failed", details: json ?? (await res.text().catch(() => "")) };
  }

  // Expected shape: { predictions: [ { ... } ] }
  const pred = (json as { predictions?: unknown[] } | null | undefined)?.predictions?.[0];
  if (!pred || typeof pred !== "object") {
    return { ok: false, error: "Invalid Vertex response", details: json };
  }
  return pred as VertexPrediction;
}


