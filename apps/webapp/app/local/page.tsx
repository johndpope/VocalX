"use client";

import { useMemo, useState } from "react";

type Which = "target" | "residual";

export default function LocalTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("A man speaking");
  const [anchorsJson, setAnchorsJson] = useState("");
  const [which, setWhich] = useState<Which>("target");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(file) && !isSubmitting;

  const hint = useMemo(() => {
    return `This page bypasses NextAuth/S3/DB and calls your local worker via /api/local/separate.\n\n` +
      `Required env:\n- WORKER_URL=http://localhost:8000\n\n` +
      `Worker requirements:\n- GPU model service running on your worker host\n- accepts POST /sam_audio/separate (multipart) and/or /v1/jobs (json) depending on your mode`;
  }, []);

  async function submit() {
    if (!file) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file, file.name);
      fd.set("description", description);
      fd.set("anchorsJson", anchorsJson);
      fd.set("which", which);

      const res = await fetch("/api/local/separate", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const details = json?.details;
        if (typeof details === "string" && details.trim()) throw new Error(details);
        if (details && typeof details === "object") throw new Error(JSON.stringify(details));
        throw new Error(json?.error || `Request failed: ${res.status}`);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] || "output.wav";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Local SAM-Audio Test</h1>
        <p className="mt-2 text-slate-400">
          Upload an audio/video file, send it to the local worker, and download the separated WAV.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="text-sm text-slate-300 whitespace-pre-wrap">{hint}</div>
        </div>

        <div className="mt-8 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div>
            <label className="text-sm font-medium text-slate-200">Input file (audio/video)</label>
            <input
              className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? <div className="mt-2 text-xs text-slate-400">Selected: {file.name}</div> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">Text prompt</label>
            <input
              className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "A dog barking"'
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Anchors JSON (optional; SAM-Audio span prompting)
            </label>
            <textarea
              className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={3}
              value={anchorsJson}
              onChange={(e) => setAnchorsJson(e.target.value)}
              placeholder='Example: [["+", 6.3, 7.0], ["-", 0.0, 1.0]]'
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300">Download</label>
              <select
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={which}
                onChange={(e) => setWhich(e.target.value as Which)}
              >
                <option value="target">target.wav</option>
                <option value="residual">residual.wav</option>
              </select>
            </div>

            <button
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              disabled={!canSubmit}
              onClick={submit}
            >
              {isSubmitting ? "Running…" : "Run separation"}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}


