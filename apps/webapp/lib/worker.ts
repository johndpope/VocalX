import { env } from "./env";

export type WorkerSubmitJobInput = {
  jobId: string;
  which: "target" | "residual";
  inputUrl: string;
  outputUrl: string;
  description: string;
  anchorsJson?: string;
};

export type WorkerSubmitJobResult = {
  workerJobId: string;
};

export type WorkerJobStatus = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress?: number;
  error?: string;
};

function workerBaseUrl(): string {
  if (!env.WORKER_URL) {
    throw new Error(
      "WORKER_URL is not configured. Set WORKER_URL to your worker base URL."
    );
  }
  return env.WORKER_URL.replace(/\/+$/, "");
}

function workerHeaders(): HeadersInit {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.WORKER_API_KEY) headers.authorization = `Bearer ${env.WORKER_API_KEY}`;
  return headers;
}

export async function submitWorkerJob(input: WorkerSubmitJobInput): Promise<WorkerSubmitJobResult> {
  const url = `${workerBaseUrl()}/v1/jobs`;
  const res = await fetch(url, {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify({
      jobId: input.jobId,
      which: input.which,
      inputUrl: input.inputUrl,
      outputUrl: input.outputUrl,
      description: input.description,
      anchorsJson: input.anchorsJson ?? "",
    }),
  }).catch((e) => {
    throw new Error(`Worker unreachable at ${url}: ${String(e)}`);
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker error (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json().catch(() => null);
  const workerJobId = json?.workerJobId;
  if (typeof workerJobId !== "string" || !workerJobId) {
    throw new Error(`Worker returned invalid response: ${JSON.stringify(json)}`);
  }

  return { workerJobId };
}

export async function getWorkerJobStatus(workerJobId: string): Promise<WorkerJobStatus> {
  const url = `${workerBaseUrl()}/v1/jobs/${encodeURIComponent(workerJobId)}`;
  const res = await fetch(url, { method: "GET", headers: workerHeaders() }).catch((e) => {
    throw new Error(`Worker unreachable at ${url}: ${String(e)}`);
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker status error (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json.status !== "string") {
    throw new Error(`Worker returned invalid status: ${JSON.stringify(json)}`);
  }

  return json as WorkerJobStatus;
}
