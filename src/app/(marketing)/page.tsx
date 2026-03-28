import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen grid-bg relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-surface/30 to-bg" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-green-glow/30 blur-3xl" />
      <div className="absolute -bottom-48 right-[-120px] h-[420px] w-[420px] rounded-full bg-amber-glow/30 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border bg-surface-plus/60 flex items-center justify-center">
              <div className="h-4 w-4 rounded-full" style={{ background: "var(--green)" }} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-widest text-muted">
                DRY GATE
              </div>
              <div className="text-lg font-semibold">Production Readiness Verifier</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/verify" className="btn-ghost">
              Start
            </Link>
          </div>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mono-tag inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--amber)" }} />
              Zero guessing
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Upload your n8n workflow.
              <span style={{ color: "var(--green)" }}> Get exact fix steps.</span>
            </h1>
            <p className="mt-4 text-muted leading-relaxed max-w-prose">
              Drygate runs static checks and sandbox execution to score production readiness,
              then generates a remediation plan you can apply directly in the n8n editor.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/verify?demo=1" className="btn-primary">
                Use demo workflow
              </Link>
              <Link href="/verify" className="btn-ghost">
                Upload your own
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="glass-plus rounded-xl p-4 border">
                <div className="text-sm font-semibold">Static gate</div>
                <div className="mt-1 text-sm text-muted">
                  Missing triggers, disconnected nodes, loops, creds, error handling.
                </div>
              </div>
              <div className="glass-plus rounded-xl p-4 border">
                <div className="text-sm font-semibold">Runtime sandbox</div>
                <div className="mt-1 text-sm text-muted">
                  Simulated execution + intercepted egress to detect unsafe nodes.
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="glass-plus rounded-3xl border p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-muted">Live pipeline preview</div>
                <div className="mono-tag">SSE progress</div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  { stage: "Parsing", color: "var(--blue)" },
                  { stage: "Static analysis", color: "var(--amber)" },
                  { stage: "Sandbox execution", color: "var(--green)" },
                  { stage: "Remediation", color: "var(--purple)" },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    className="glass rounded-xl border px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: s.color, boxShadow: `0 0 24px ${s.color}55` }}
                      />
                      <div className="font-semibold">{s.stage}</div>
                    </div>
                    <div className="text-xs text-muted">queued</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 terminal">
                <div className="px-3 py-2 border-b border-border text-xs font-semibold tracking-widest text-muted">
                  SANDBOX CONSOLE
                </div>
                <div className="px-3 py-3 text-sm text-muted space-y-1">
                  <div className="terminal-line">Preparing sandbox environment…</div>
                  <div className="terminal-line">Creating isolated network…</div>
                  <div className="terminal-line">Importing workflow into sandbox…</div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -inset-5 rounded-[40px] bg-grid-pattern opacity-60 blur-[1px]" />
          </div>
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Readable scores",
              body: "Production Ready vs Needs Fixes vs Not Ready — with a reasoned score breakdown.",
              glow: "glow-green",
            },
            {
              title: "Actionable remediation",
              body: "Remediation steps are deterministic, optionally enhanced by Claude when keys exist.",
              glow: "glow-amber",
            },
            {
              title: "Shareable reports",
              body: "Generate a tokenized report you can paste into Slack or your team channel.",
              glow: "glow-red",
            },
          ].map((c, idx) => (
            <div key={idx} className="glass-plus rounded-2xl border p-5">
              <div className={`h-2 w-14 rounded-full ${c.glow}`} />
              <div className="mt-3 text-lg font-semibold">{c.title}</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">{c.body}</div>
            </div>
          ))}
        </section>

        <footer className="mt-14 text-sm text-muted">
          Demo build: runtime verification requires Docker + n8n sandbox containers.
        </footer>
      </div>
    </main>
  );
}

