import { env } from "@/lib/env";
import { isVertexEnabled, vertexSamAudioPredict } from "@/lib/vertex";

function jsonError(status: number, message: string, details?: unknown) {
  return Response.json({ ok: false, error: message, details }, { status });
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Vertex AI path (recommended): webapp -> Vertex Endpoint (GPU) -> model container
  if (isVertexEnabled()) {
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError(400, "Invalid form data");

    const file = form.get("file");
    const description = String(form.get("description") ?? "");
    const anchorsJson = String(form.get("anchorsJson") ?? "");
    const which = String(form.get("which") ?? "target"); // target | residual

    if (!(file instanceof File)) return jsonError(400, "Missing file");
    if (!description.trim()) return jsonError(400, "Missing description");
    if (which !== "target" && which !== "residual") return jsonError(400, "Invalid which");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pred = await vertexSamAudioPredict({
      audioBytes: bytes,
      filename: file.name || "input",
      description,
      anchorsJson,
      which,
      predictSpans: false,
      rerankingCandidates: 0,
    });

    if (!pred?.ok) {
      return jsonError(502, "Vertex worker error", pred);
    }

    const base64Key =
      which === "residual" ? ("residual_wav_base64" as const) : ("target_wav_base64" as const);
    const b64 = (pred as Record<string, unknown>)[base64Key];
    if (typeof b64 !== "string" || !b64.length) {
      return jsonError(502, "Vertex worker did not return WAV base64", pred);
    }

    const wavBytes = Buffer.from(b64, "base64");
    const safeBase = (file.name || "audio").replace(/[^\w.\-]+/g, "_").slice(0, 64);
    const outName = `${safeBase}.${which}.wav`;

    return new Response(wavBytes, {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "content-disposition": `attachment; filename="${outName}"`,
        "cache-control": "no-store",
      },
    });
  }

  // Direct worker URL path: webapp -> worker (FastAPI) -> model
  if (!env.WORKER_URL) {
    return jsonError(
      400,
      "WORKER_URL is not configured",
      "Set WORKER_URL=http://localhost:8000 (or your worker host) and restart the webapp."
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");

  const file = form.get("file");
  const description = String(form.get("description") ?? "");
  const anchorsJson = String(form.get("anchorsJson") ?? "");
  const which = String(form.get("which") ?? "target"); // target | residual

  if (!(file instanceof File)) return jsonError(400, "Missing file");

  const workerUrl = env.WORKER_URL.replace(/\/+$/, "");
  const fd = new FormData();
  fd.set("audio", file, file.name);
  fd.set("description", description);
  if (anchorsJson.trim()) fd.set("anchors_json", anchorsJson);
  fd.set("predict_spans", "false");
  fd.set("reranking_candidates", "0");

  const url = `${workerUrl}/sam_audio/separate`;
  let res: Response;
  try {
    const headers: HeadersInit | undefined = env.WORKER_API_KEY
      ? { authorization: `Bearer ${env.WORKER_API_KEY}` }
      : undefined;
    res = await fetch(url, { method: "POST", body: fd, headers });
  } catch (e) {
    return jsonError(502, "Worker unreachable", {
      tried: url,
      error: String(e),
      hint:
        "If you're running the worker in WSL, it may have crashed (OOM) when loading SAM-Audio. " +
        "Check the worker logs and consider increasing WSL2 memory/swap or using a larger machine.",
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return jsonError(502, "Worker error", text || `${res.status} ${res.statusText}`);
  }

  const json = await res.json().catch(() => null);
  if (!json?.ok) {
    return jsonError(502, "Worker returned invalid response", json);
  }

  const base64Key =
    which === "residual" ? ("residual_wav_base64" as const) : ("target_wav_base64" as const);
  const b64 = json[base64Key];
  if (typeof b64 !== "string" || !b64.length) {
    return jsonError(
      502,
      "Worker did not return WAV base64",
      json?.warning ?? "Make sure `torchaudio` is installed in the worker and SAM-Audio is working."
    );
  }

  const wavBytes = Buffer.from(b64, "base64");
  const safeBase = (file.name || "audio").replace(/[^\w.\-]+/g, "_").slice(0, 64);
  const outName = `${safeBase}.${which}.wav`;

  return new Response(wavBytes, {
    status: 200,
    headers: {
      "content-type": "audio/wav",
      "content-disposition": `attachment; filename="${outName}"`,
      "cache-control": "no-store",
    },
  });
}


