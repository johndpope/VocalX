"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ResultFile = { url: string; filename: string; createdAt: number };
type ResultsState = { target?: ResultFile; residual?: ResultFile };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function estimateSeconds(file: File | null): number | null {
  if (!file) return null;
  const sizeMb = file.size / (1024 * 1024);
  const seconds = Math.round(sizeMb * 5) + 8;
  return clamp(seconds, 8, 75);
}

export function StudioClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsState>({});
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isolatedVol, setIsolatedVol] = useState(1);
  const [backgroundVol, setBackgroundVol] = useState(1);

  const isolatedAudioRef = useRef<HTMLAudioElement | null>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);

  const hasResults = Boolean(results.target || results.residual);
  const etaSeconds = useMemo(() => estimateSeconds(file), [file]);

  const isVideo = Boolean(file?.type?.startsWith("video/"));

  useEffect(() => {
    if (!file) {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setOriginalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setOriginalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    return () => {
      if (results.target?.url) URL.revokeObjectURL(results.target.url);
      if (results.residual?.url) URL.revokeObjectURL(results.residual.url);
    };
  }, [results.target?.url, results.residual?.url]);

  useEffect(() => {
    if (isolatedAudioRef.current) isolatedAudioRef.current.volume = isolatedVol;
  }, [isolatedVol]);

  useEffect(() => {
    if (backgroundAudioRef.current) backgroundAudioRef.current.volume = backgroundVol;
  }, [backgroundVol]);

  function startOver() {
    setError(null);
    setPromptText("");
    setFile(null);
    setResults({});
    setIsDragging(false);
  }

  function setPickedFile(next: File | null) {
    setFile(next);
    setError(null);
    setResults({});
    if (next && !promptText.trim()) setPromptText("speech");
  }

  async function run(which: "target" | "residual") {
    if (!file) return setError("Upload an audio/video file first.");
    if (!promptText.trim()) return setError("Type what you want to isolate (e.g. “speech”, “lead vocal”).");

    setIsRunning(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file, file.name);
      fd.set("description", promptText.trim());
      fd.set("anchorsJson", "");
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
      const filename = match?.[1] || `${which}.wav`;

      const url = URL.createObjectURL(blob);
      setResults((prev) => {
        const next: ResultsState = { ...prev };
        if (which === "target") {
          if (prev.target?.url) URL.revokeObjectURL(prev.target.url);
          next.target = { url, filename, createdAt: Date.now() };
        } else {
          if (prev.residual?.url) URL.revokeObjectURL(prev.residual.url);
          next.residual = { url, filename, createdAt: Date.now() };
        }
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }

  function downloadResult(which: "target" | "residual") {
    const r = which === "target" ? results.target : results.residual;
    if (!r) return;
    const a = document.createElement("a");
    a.href = r.url;
    a.download = r.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="h-full">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100">Isolate sounds</div>
          <div className="mt-1 text-xs text-slate-400">
            Upload audio/video → describe the sound → download isolated track (SAM Audio).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startOver}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10 active:scale-[0.99]"
          >
            Start over
          </button>
          <button
            disabled={!results.target}
            onClick={() => downloadResult("target")}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black disabled:opacity-40"
            title={results.target ? "Download isolated track" : "Run a separation first"}
          >
            Download
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_1fr] lg:gap-5 lg:p-6">
        <aside className="rounded-2xl border border-white/10 bg-black/30 p-4">
          {!hasResults ? (
            <>
              <div className="text-sm font-semibold">How it works</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-slate-200">1. Add audio or video</div>
                  <div className="mt-1 text-xs text-slate-400">Upload any file to start.</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-slate-200">2. Isolate sound</div>
                  <div className="mt-1 text-xs text-slate-400">Type what you want to extract.</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-slate-200">3. Download</div>
                  <div className="mt-1 text-xs text-slate-400">Get isolated + background tracks.</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-300">Model</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  SAM Audio
                  <span className="h-1 w-1 rounded-full bg-emerald-400/80" />
                  <span className="text-slate-400">remote worker</span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold text-slate-200">Subscription</div>
                <div className="mt-1 text-xs text-slate-400">Free (MVP). Usage tracking comes next.</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">Add sound effects</div>
              <div className="mt-1 text-xs text-slate-400">
                Preview-only controls (processing effects will be wired later).
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-300">Isolated sound</div>
                <input
                  className="mt-2 w-full accent-brand-500"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isolatedVol}
                  onChange={(e) => setIsolatedVol(Number(e.target.value))}
                />
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-300">Without isolated sound</div>
                <input
                  className="mt-2 w-full accent-brand-500"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={backgroundVol}
                  onChange={(e) => setBackgroundVol(Number(e.target.value))}
                />
              </div>

              <div className="mt-6 space-y-2">
                {["Reverb", "Delay", "Equalizer", "Compressor"].map((label) => (
                  <button
                    key={label}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200 hover:bg-white/10"
                    type="button"
                  >
                    <span>{label}</span>
                    <span className="text-xs text-slate-500">soon</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="min-w-0">
          {!file ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 sm:p-10">
              <div
                className={[
                  "flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center transition",
                  isDragging ? "ring-2 ring-brand-500/60" : "",
                ].join(" ")}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0] ?? null;
                  setPickedFile(f);
                }}
              >
                <div className="text-sm text-slate-300">Start with your own audio or video</div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/10 px-7 text-sm font-semibold text-slate-50 hover:bg-brand-500/15"
                >
                  Upload
                </button>
                <div className="mt-3 text-xs text-slate-500">MP3, WAV, MP4… (we convert to WAV in the worker)</div>

                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="mt-8 text-center text-xs text-slate-500">Or try a sample audio or video</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {["Interview", "Cafe", "Action"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="group aspect-video rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-3 text-left hover:bg-white/10"
                    title="Sample assets coming soon"
                    onClick={() => setError("Sample assets aren’t wired yet — please upload your own file.")}
                  >
                    <div className="text-sm font-semibold text-slate-200">{label}</div>
                    <div className="mt-1 text-xs text-slate-500">Sample (soon)</div>
                    <div className="mt-3 h-1 w-10 rounded-full bg-brand-500/30 transition group-hover:bg-brand-500/50" />
                  </button>
                ))}
              </div>

              {error ? (
                <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{file.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB{etaSeconds ? ` • ~${etaSeconds}s` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() => inputRef.current?.click()}
                    >
                      Replace
                    </button>
                    <input
                      ref={inputRef}
                      className="hidden"
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  {originalUrl ? (
                    isVideo ? (
                      <video className="w-full rounded-xl border border-white/10 bg-black" controls src={originalUrl} />
                    ) : (
                      <audio className="w-full" controls src={originalUrl} />
                    )
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold text-slate-300">What do you want to isolate?</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["speech", "lead vocal", "drums", "crowd noise", "room tone"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                      onClick={() => setPromptText(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder='e.g. "A dog barking", "lead vocal", "speech"'
                  className="mt-3 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                />

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    disabled={isRunning}
                    onClick={() => run("target")}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {isRunning ? "Processing…" : "Isolate sound"}
                  </button>
                  <button
                    disabled={isRunning}
                    onClick={() => run("residual")}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
                  >
                    Get background track
                  </button>
                </div>

                {error ? (
                  <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Results</div>
                  <div className="text-xs text-slate-500">Download WAV</div>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-300">Isolated sound</div>
                      <button
                        disabled={!results.target}
                        onClick={() => downloadResult("target")}
                        className="rounded-lg bg-white/10 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/15 disabled:opacity-40"
                      >
                        Download
                      </button>
                    </div>
                    {results.target ? (
                      <audio ref={isolatedAudioRef} className="mt-2 w-full" controls src={results.target.url} />
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">Run “Isolate sound” to generate.</div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-300">Without isolated sound</div>
                      <button
                        disabled={!results.residual}
                        onClick={() => downloadResult("residual")}
                        className="rounded-lg bg-white/10 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/15 disabled:opacity-40"
                      >
                        Download
                      </button>
                    </div>
                    {results.residual ? (
                      <audio ref={backgroundAudioRef} className="mt-2 w-full" controls src={results.residual.url} />
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">Use “Get background track” to generate.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


