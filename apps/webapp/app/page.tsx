import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-300/70" />
            <div className="leading-tight">
              <div className="text-base font-semibold">VocalX</div>
              <div className="text-xs text-slate-400">AI audio editing for creators</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 sm:flex">
            <Link className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="/studio">
              Studio
            </Link>
            <a className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="#pricing">
              Pricing
            </a>
            <Link className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="/login">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50 transition hover:bg-brand-600 hover:shadow-brand-500/30 active:scale-[0.98]"
            >
              Start free
            </Link>
          </nav>

          <div className="sm:hidden">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              Free trial: 10 minutes • No credit card
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Remove, Isolate, Extract — One Click
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
              AI-powered audio editing for creators. Clean podcast audio, extract music stems, and remove background
              noise with plain English.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Upload → describe what you want → download the result.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-500 px-6 text-sm font-semibold text-black shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/50 transition hover:bg-brand-600 hover:shadow-brand-500/30 active:scale-[0.98]"
              >
                Try Free — No Credit Card
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-6 text-sm font-semibold text-slate-100 hover:bg-white/5"
              >
                Watch 30-second demo
              </a>
            </div>

            <div className="mt-6 text-sm text-slate-400">
              <span className="text-slate-200">2,500+</span> creators. <span className="text-slate-200">50,000+</span> minutes processed / month.
            </div>
          </div>

          {/* Visual: before/after */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="text-xs font-semibold text-slate-300">Before → After</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <div className="text-xs font-semibold text-slate-200">Before</div>
                  <div className="mt-3 h-12 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900" />
                  <div className="mt-3 text-xs text-slate-400">Room noise + reverb</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <div className="text-xs font-semibold text-slate-200">After</div>
                  <div className="mt-3 h-12 rounded-xl border border-slate-800 bg-[length:200%_200%] bg-gradient-to-r from-brand-500/10 via-brand-500/35 to-emerald-300/10 animate-gradient" />
                  <div className="mt-3 text-xs text-slate-400">Speaker isolated</div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 text-xs text-slate-300">
                Upload your audio, describe the change, and get a clean export.
              </div>
            </div>
          </div>
        </div>
      </section>

    {/* How it works */}
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 pb-16">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 sm:p-8">
        <div className="text-sm font-semibold">How it works</div>
        <div className="mt-1 text-sm text-slate-400">A simple 3-step workflow.</div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { title: "1) Upload", desc: "Drop an audio (or video) file." },
            { title: "2) Describe", desc: "Tell us what to remove or extract." },
            { title: "3) Download", desc: "Compare and export your result." },
          ].map((step) => (
            <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="text-sm font-semibold text-slate-200">{step.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Use cases */}
    <section className="mx-auto max-w-6xl px-6 pb-16">
      <div>
        <div className="text-2xl font-semibold">Made for every creator</div>
        <div className="mt-2 text-slate-400">From podcasters to video editors.</div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: "🎙️",
            title: "Podcasters",
            desc: "Clean dialog, reduce room noise, isolate guest voices.",
            example: "Example: remove office noise from a home studio recording.",
          },
          {
            icon: "🎵",
            title: "Musicians",
            desc: "Extract vocals or instruments for remixing and practice.",
            example: "Example: pull an acapella from a song for a quick demo.",
          },
          {
            icon: "🎬",
            title: "Video editors",
            desc: "Make dialog crisp and consistent across clips.",
            example: "Example: reduce echo on interview audio.",
          },
          {
            icon: "📱",
            title: "Content creators",
            desc: "Improve audio for YouTube, shorts, and livestreams.",
            example: "Example: remove fan noise from a gaming clip.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 transition hover:-translate-y-0.5 hover:bg-slate-900/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">
                {c.icon}
              </div>
              <div className="text-base font-semibold">{c.title}</div>
            </div>
            <div className="mt-4 text-sm leading-6 text-slate-300">{c.desc}</div>
            <div className="mt-3 text-xs leading-5 text-slate-400">{c.example}</div>
            <div className="mt-5">
              <Link
                href="/signup"
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black hover:bg-brand-600"
              >
                Try for free
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Pricing */}
    <section id="pricing" className="mx-auto max-w-6xl px-6 pb-16">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 sm:p-8">
        <div className="text-2xl font-semibold">Simple, transparent pricing</div>
        <div className="mt-2 text-slate-400">Pay only for what you use. No hidden fees.</div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <div className="text-sm font-semibold">Start free</div>
            <div className="mt-2 text-sm text-slate-300">10 min audio trial</div>
            <div className="mt-4 text-xs text-slate-400">No credit card required.</div>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black hover:bg-brand-600"
            >
              Start free trial
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-950 p-6 ring-1 ring-brand-500/40">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Pay as you go</div>
              <div className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-500">Default</div>
            </div>
            <div className="mt-3 text-sm text-slate-300">Audio: $0.05 / min</div>
            <div className="mt-1 text-xs text-slate-400">Example: 10 min = $0.50</div>
            <div className="mt-4 text-sm text-slate-300">Video: $0.10 / min</div>
            <div className="mt-1 text-xs text-slate-400">Example: 5 min = $0.50</div>
            <Link
              href="/studio"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm font-semibold text-slate-100 hover:bg-white/5"
            >
              Open Studio
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Prepaid packs</div>
              <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">Most popular</div>
            </div>
            <div className="mt-3 text-sm text-slate-300">Starter: $10 = 250 min audio</div>
            <div className="mt-2 text-sm text-slate-300">Pro: $25 = 700 min audio</div>
            <div className="mt-2 text-sm text-slate-300">Studio: $50 = 1,600 min audio</div>
            <div className="mt-4 text-xs text-slate-400">Credits never expire.</div>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-black hover:bg-brand-600"
            >
              Choose a pack
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="mx-auto max-w-6xl px-6 pb-20">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/30 p-6 sm:p-8">
        <div className="text-2xl font-semibold">FAQ</div>
        <div className="mt-2 text-slate-400">Quick answers before you start.</div>

        <div className="mt-8 space-y-3">
          {[
            { q: "How long does it take?", a: "Most short clips finish quickly. Longer files depend on length and workload." },
            { q: "How accurate is it?", a: "Accuracy depends on the source audio. Clear recordings produce the best results." },
            { q: "What formats are supported?", a: "You can upload common audio/video formats. Exports are currently WAV in the local workflow." },
            { q: "Can I cancel anytime?", a: "Yes. You control usage; prepaid credits are optional." },
          ].map((item) => (
            <details key={item.q} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">{item.q}</summary>
              <div className="mt-2 text-sm leading-6 text-slate-400">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-slate-800/70 bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 sm:grid-cols-2 sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-emerald-300/70" />
            <div>
              <div className="text-sm font-semibold">VocalX</div>
              <div className="text-xs text-slate-400">AI audio editing for creators</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">© VocalX</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Link className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="/login">Sign in</Link>
          <Link className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="/signup">Create account</Link>
          <a className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="#pricing">Pricing</a>
          <Link className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5" href="/studio">Studio</Link>
        </div>
      </div>
    </footer>
  </main>
);

}
