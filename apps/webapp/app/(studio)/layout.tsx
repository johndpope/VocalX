import Link from "next/link";

export default function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-0 px-3 py-3 sm:px-4 sm:py-4">
        <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/30 py-3 lg:flex">
          <Link
            href="/"
            title="Home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="h-px w-10 bg-white/10" />

          <nav className="flex flex-col items-center gap-2">
            {[
              { href: "/studio", title: "Studio", icon: "spark" },
              { href: "/history", title: "History", icon: "clock" },
              { href: "/settings", title: "Settings", icon: "gear" },
              { href: "/account", title: "Account", icon: "user" },
              { href: "/local", title: "Local Test", icon: "beaker" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/0 text-slate-300 hover:bg-white/10 hover:text-slate-100"
              >
                {item.icon === "spark" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2l1.2 5.4L18 9l-4.8 1.6L12 16l-1.2-5.4L6 9l4.8-1.6L12 2Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 13l.7 3.2L23 17l-3.3 1-.7 3.3-.7-3.3L15 17l3.3-.8L19 13Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : item.icon === "clock" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                ) : item.icon === "gear" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.5-2-3.5-2.4.5a8.6 8.6 0 0 0-1.7-1L15 6 11 6l-.4 2.5a8.6 8.6 0 0 0-1.7 1L6.5 9l-2 3.5 2 1.5a7.9 7.9 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.5a8.6 8.6 0 0 0 1.7 1L11 22h4l.4-2.5a8.6 8.6 0 0 0 1.7-1l2.4.5 2-3.5-2-1.5Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : item.icon === "user" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <path
                      d="M4 20a8 8 0 0 1 16 0"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M10 3H5a2 2 0 0 0-2 2v5m13-7h3a2 2 0 0 1 2 2v3M3 14v5a2 2 0 0 0 2 2h3m11-1h-3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 12h8"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
          {children}
        </div>
      </div>
    </div>
  );
}
