import Link from "next/link";

const FEATURES = [
  {
    title: "Graph structure checks",
    body: "Disconnected nodes, missing triggers, unreachable branches, broken topology — caught before you ever run it.",
    color: "var(--violet)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="4" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <circle cx="16" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <circle cx="16" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <path d="M6.2 9.2L13.8 5M6.2 10.8L13.8 15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
  {
    title: "Secret detection",
    body: "Hardcoded API keys, tokens, or passwords embedded in node parameters — flagged as critical issues.",
    color: "var(--rose)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="10" cy="13.5" r="1.2" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
  },
  {
    title: "Sandbox execution",
    body: "Real n8n runs your workflow — every node that executes is traced. Coverage shows how much actually ran.",
    color: "var(--amber)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
        <path d="M7 6.5l5.5 3.5L7 13.5V6.5z" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
  },
  {
    title: "Readiness score",
    body: "A 0–100 score with a band (Production Ready → Not Ready) based on static + runtime findings. One clear signal.",
    color: "var(--jade)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
        <path d="M10 10V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.7"/>
        <path d="M10 10l4 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
        <circle cx="10" cy="10" r="1.2" fill="currentColor"/>
      </svg>
    ),
  },
  {
    title: "Error handling checks",
    body: "No error branches, no global error workflow — high-severity issues that silently swallow failures in production.",
    color: "var(--coral)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3L18 17H2L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5"/>
        <path d="M10 9v4M10 15v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Shareable reports",
    body: "Every run gets a unique URL. Share with your team, PM, or reviewer — full report, no login required.",
    color: "var(--sky)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 3h4v4M17 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
        <path d="M9 5H5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
  },
];

const PIPELINE_STEPS = [
  { label: "Parsing",    sub: "JSON shape",          color: "var(--sky)",    eta: "~2s" },
  { label: "Static",    sub: "Graph & security",     color: "var(--amber)",  eta: "~5s" },
  { label: "Sandbox",   sub: "Live n8n execution",   color: "var(--violet)", eta: "~30s" },
  { label: "Remediation", sub: "Fix plan",           color: "var(--jade)",   eta: "~3s" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen grid-bg relative overflow-hidden">
      {/* Mesh orbs */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "var(--mesh-1)" }} />
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "var(--mesh-2)" }} />

      <div className="relative z-[1] mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">

        {/* ═══════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════ */}
        <section className="pt-20 sm:pt-28 pb-10 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left copy */}
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: "var(--violet-dim)",
                border: "1px solid rgba(138,99,255,0.25)",
                color: "var(--violet-text)",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--violet)",
                  boxShadow: "0 0 8px var(--violet)",
                  display: "inline-block",
                }}
              />
              Production readiness gate
            </div>

            <h1
              className="text-[clamp(2.2rem,5.5vw,3.4rem)] font-semibold leading-[1.08] tracking-tight"
              style={{ color: "var(--text)", fontFamily: "var(--font-ui)" }}
            >
              Upload your n8n workflow.
              <br />
              <span style={{ color: "var(--violet-light)" }}>Know if it's production‑ready.</span>
            </h1>

            <p className="mt-5 text-[15px] leading-relaxed max-w-xl" style={{ color: "var(--text-2)" }}>
              Drygate runs static analysis and a live sandbox execution on your n8n workflow JSON, scores production readiness 0–100, and gives you a prioritized fix plan in under a minute.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/verify?demo=1" className="btn-primary" style={{ padding: "12px 28px", fontSize: 14, fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Try demo workflow
              </Link>
              <Link href="/verify" className="btn-ghost" style={{ padding: "12px 24px", fontSize: 14 }}>
                Upload your own
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap gap-5">
              {[
                { label: "Static + runtime", icon: "⚡" },
                { label: "0–100 readiness score", icon: "📊" },
                { label: "Shareable report link", icon: "🔗" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-2">
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — hero preview card */}
          <div className="relative">
            {/* Glow behind card */}
            <div
              className="pointer-events-none absolute -inset-8 rounded-[48px] blur-3xl"
              style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(138,99,255,0.18) 0%, transparent 65%)" }}
            />

            <div
              className="relative rounded-3xl p-6 sm:p-7"
              style={{
                background: "var(--surface-mid)",
                border: "1px solid var(--border-mid)",
                boxShadow: "0 32px 80px -32px rgba(0,0,0,0.8)",
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-data)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Live pipeline
                  </div>
                  <div className="mt-1 font-semibold text-sm" style={{ color: "var(--text)" }}>
                    E-commerce Order Sync
                  </div>
                </div>
                {/* Score badge */}
                <div
                  className="flex flex-col items-center justify-center rounded-2xl px-4 py-2"
                  style={{
                    background: "var(--jade-dim)",
                    border: "1px solid rgba(46,207,150,0.25)",
                    minWidth: 72,
                  }}
                >
                  <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--jade)", lineHeight: 1 }}>88</div>
                  <div style={{ fontSize: 10, color: "var(--jade-light)", marginTop: 3, fontFamily: "var(--font-data)", letterSpacing: "0.05em" }}>
                    Minor Issues
                  </div>
                </div>
              </div>

              {/* Pipeline steps with connector */}
              <div className="relative">
                {/* Vertical connector line */}
                <div
                  className="absolute left-[17px] top-5 bottom-5"
                  style={{ width: 1, background: "linear-gradient(to bottom, var(--violet)30, var(--jade)20)" }}
                />
                <div className="space-y-3">
                  {PIPELINE_STEPS.map((s, i) => (
                    <div
                      key={s.label}
                      className="relative flex items-center gap-4 rounded-xl px-4 py-3"
                      style={{
                        background: i === 2 ? `${s.color}0d` : "rgba(255,255,255,0.025)",
                        border: `1px solid ${i === 2 ? `${s.color}25` : "var(--border)"}`,
                      }}
                    >
                      {/* Dot */}
                      <div style={{ position: "relative", flexShrink: 0, zIndex: 1 }}>
                        {i === 2 && (
                          <div
                            style={{
                              position: "absolute",
                              inset: -4,
                              borderRadius: "50%",
                              background: s.color,
                              opacity: 0.2,
                              animation: "pulseGlow 1.4s ease-in-out infinite",
                            }}
                          />
                        )}
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: i < 2 ? "var(--jade)" : i === 2 ? s.color : "var(--surface-high)",
                            boxShadow: i < 2 ? "0 0 8px var(--jade-glow)" : i === 2 ? `0 0 10px ${s.color}` : "none",
                            position: "relative",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold" style={{ color: i <= 2 ? "var(--text)" : "var(--text-muted)" }}>
                            {s.label}
                          </span>
                          {i === 2 && (
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-data)",
                                color: s.color,
                                background: `${s.color}15`,
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              running
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{s.sub}</div>
                      </div>
                      <div style={{ fontSize: 10, color: i < 2 ? "var(--jade)" : i === 2 ? s.color : "var(--text-faint)", fontFamily: "var(--font-data)", flexShrink: 0 }}>
                        {i < 2 ? "✓" : i === 2 ? s.eta : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issue pill preview */}
              <div
                className="mt-5 rounded-xl px-4 py-3"
                style={{
                  background: "var(--rose-dim)",
                  border: "1px solid rgba(240,67,110,0.2)",
                }}
              >
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--rose)",
                        flexShrink: 0,
                        boxShadow: "0 0 8px var(--rose)",
                      }}
                    />
                    <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--rose-light)" }}>
                      MISSING_ERROR_OUTPUT
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-data)",
                      color: "var(--rose-light)",
                      background: "rgba(240,67,110,0.15)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    High
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, paddingLeft: 16 }}>
                  Validate Order · No error branch defined
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            PIPELINE SECTION
            ═══════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="text-center mb-12">
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-data)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              The pipeline
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Four stages. One report.
            </h2>
          </div>

          <div className="relative">
            {/* Horizontal connector */}
            <div
              className="hidden lg:block absolute top-[52px] left-[calc(12.5%-16px)] right-[calc(12.5%-16px)]"
              style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border-plus) 20%, var(--border-plus) 80%, transparent)" }}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_STEPS.map((s, i) => (
                <div
                  key={s.label}
                  className="relative rounded-2xl p-6 text-center"
                  style={{
                    background: "var(--surface-mid)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Step number */}
                  <div
                    className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: `${s.color}18`,
                      border: `1px solid ${s.color}35`,
                      color: s.color,
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="font-semibold text-sm mb-1.5" style={{ color: "var(--text)" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.sub}</div>
                  <div
                    className="mt-3 inline-block"
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-data)",
                      color: s.color,
                      background: `${s.color}12`,
                      padding: "2px 8px",
                      borderRadius: 20,
                      border: `1px solid ${s.color}25`,
                    }}
                  >
                    {s.eta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            FEATURES GRID
            ═══════════════════════════════════════════════ */}
        <section className="py-4 sm:py-8">
          <div className="text-center mb-12">
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-data)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              What we check
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Everything that matters before production
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${f.color}`,
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${f.color} 20%, transparent)`,
                    color: f.color,
                  }}
                >
                  {f.icon}
                </div>
                <div className="font-semibold text-sm mb-2" style={{ color: "var(--text)" }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            CTA STRIP
            ═══════════════════════════════════════════════ */}
        <section className="py-16 sm:py-24">
          <div
            className="relative rounded-3xl p-10 sm:p-16 text-center overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--surface-plus) 0%, var(--surface-mid) 100%)",
              border: "1px solid var(--border-mid)",
            }}
          >
            {/* Violet orb */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 65% 60% at 50% 120%, rgba(138,99,255,0.22) 0%, transparent 65%)",
              }}
            />
            <div className="relative z-[1]">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-4"
                style={{ color: "var(--violet-text)" }}
              >
                Get started now
              </p>
              <h2
                className="text-2xl sm:text-[2rem] font-semibold tracking-tight mb-4"
                style={{ color: "var(--text)", lineHeight: 1.15 }}
              >
                Is your n8n workflow<br />production-ready?
              </h2>
              <p className="text-sm mb-10 mx-auto max-w-lg" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
                Paste the JSON, run the pipeline, share the report. Under 60 seconds from upload to fix plan.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/verify?demo=1" className="btn-primary" style={{ padding: "13px 32px", fontSize: 14, fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Try demo workflow
                </Link>
                <Link href="/how-it-works" className="btn-ghost" style={{ padding: "13px 28px", fontSize: 14 }}>
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
