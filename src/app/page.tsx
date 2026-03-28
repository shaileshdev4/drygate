"use client";

import Link from "next/link";

export default function Page() {
  return (
    <main className="grid-bg" style={{ minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "80px 28px 60px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          alignItems: "center",
        }}
        className="hero-grid"
      >
        {/* Left — copy */}
        <div style={{ animation: "fadeSlideIn 0.6s cubic-bezier(0.22,1,0.36,1) both" }}>
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px 5px 6px",
              background: "var(--violet-dim)",
              border: "1px solid rgba(138,99,255,0.22)",
              borderRadius: 99,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                background: "var(--grad-violet)",
                borderRadius: 99,
                padding: "2px 10px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                fontWeight: 500,
                color: "#fff",
                letterSpacing: "0.06em",
              }}
            >
              n8n
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--violet-text)",
                fontFamily: "var(--font-data)",
                letterSpacing: "0.02em",
              }}
            >
              Production Readiness Verifier
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(34px, 4.5vw, 52px)",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              marginBottom: 20,
              color: "var(--text)",
            }}
          >
            Ship n8n workflows
            <br />
            <span
              style={{
                background: "linear-gradient(130deg, var(--violet-text) 0%, var(--jade-light) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              with confidence.
            </span>
          </h1>

          {/* Sub */}
          <p
            style={{
              fontSize: 15,
              color: "var(--text-2)",
              lineHeight: 1.7,
              maxWidth: 420,
              marginBottom: 36,
              letterSpacing: "-0.01em",
            }}
          >
            Paste your workflow JSON. Drygate runs static analysis and live
            sandbox execution — then gives you a score, a band, and exact
            steps to fix every gap before it hits production.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/verify?demo=1" className="btn-primary" style={{ fontSize: 14, padding: "12px 26px" }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M3 7.5L6.5 11L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Run demo workflow
            </Link>
            <Link href="/verify" className="btn-ghost" style={{ fontSize: 14, padding: "12px 22px" }}>
              Upload your own →
            </Link>
          </div>

          {/* Social proof strip */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            {[
              { val: "Static", sub: "Graph Analysis" },
              { val: "Live", sub: "Sandbox Run" },
              { val: "Score", sub: "0–100 Band" },
            ].map((s) => (
              <div key={s.val} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.val}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Score preview card */}
        <div
          style={{
            animation: "fadeSlideIn 0.7s 0.12s cubic-bezier(0.22,1,0.36,1) both",
            position: "relative",
          }}
        >
          {/* Glow behind card */}
          <div
            style={{
              position: "absolute",
              inset: -40,
              background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(138,99,255,0.13) 0%, transparent 70%)",
              pointerEvents: "none",
              animation: "pulseGlow 4s ease-in-out infinite",
            }}
          />

          <div
            className="glass-plus"
            style={{
              borderRadius: 24,
              padding: 28,
              position: "relative",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Verification Result</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>
                  ecommerce-order-sync.json
                </div>
              </div>
              <span className="pill pill-jade" style={{ fontSize: 11 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--jade)", display: "inline-block" }} />
                runtime_done
              </span>
            </div>

            {/* Score arc mock */}
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 24 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="38"
                    fill="none"
                    stroke="var(--surface-high)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray="200 239"
                    strokeDashoffset="-19"
                    transform="rotate(144 50 50)"
                  />
                  <circle
                    cx="50" cy="50" r="38"
                    fill="none"
                    stroke="url(#scoreGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray="168 239"
                    strokeDashoffset="-19"
                    transform="rotate(144 50 50)"
                    style={{ filter: "drop-shadow(0 0 6px rgba(46,207,150,0.6))" }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8a63ff" />
                      <stop offset="100%" stopColor="#2ecf96" />
                    </linearGradient>
                  </defs>
                  <text x="50" y="46" textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="700" fontFamily="var(--font-ui)" letterSpacing="-1">
                    88
                  </text>
                  <text x="50" y="60" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5" fontFamily="var(--font-data)" letterSpacing="0.04em">
                    /100
                  </text>
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--jade-light)", letterSpacing: "-0.01em", marginBottom: 4 }}>
                  Production Ready
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  2 minor issues found. Fix before deploying to reduce operational risk.
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <span className="mono-tag">14 nodes</span>
                  <span className="mono-tag">91% coverage</span>
                </div>
              </div>
            </div>

            {/* Pipeline stages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Parsing",          color: "var(--sky)",    status: "done", delay: "0s"    },
                { label: "Static analysis",   color: "var(--amber)",  status: "done", delay: "0.1s"  },
                { label: "Sandbox execution", color: "var(--violet)", status: "done", delay: "0.2s"  },
                { label: "Remediation plan",  color: "var(--jade)",   status: "done", delay: "0.3s"  },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 9,
                    animation: `fadeSlideIn 0.4s ${s.delay} both`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: s.color,
                        boxShadow: `0 0 10px ${s.color}`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", letterSpacing: "-0.01em" }}>
                      {s.label}
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--jade)", letterSpacing: "0.04em" }}>
                    ✓ done
                  </span>
                </div>
              ))}
            </div>

            {/* Issue preview */}
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "var(--rose-dim)",
                border: "1px solid rgba(240,67,110,0.18)",
                borderLeft: "2px solid var(--rose)",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--rose-light)", fontFamily: "var(--font-data)", letterSpacing: "0.02em" }}>
                MISSING_ERROR_OUTPUT
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                HTTP Request node
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto 0",
          padding: "0 28px",
        }}
      >
        <div className="divider" />
      </div>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "72px 28px",
        }}
      >
        <div style={{ marginBottom: 48 }}>
          <div className="label" style={{ marginBottom: 10 }}>Pipeline</div>
          <h2
            style={{
              fontSize: "clamp(22px, 3vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              maxWidth: 480,
            }}
          >
            Four stages. One definitive answer.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            position: "relative",
          }}
          className="pipeline-grid"
        >
          {[
            {
              num: "01",
              title: "Parse",
              body: "Validates shape, nodes array, and connection graph. Rejects malformed JSON immediately.",
              color: "var(--sky)",
              colorDim: "var(--sky-dim)",
            },
            {
              num: "02",
              title: "Static Gate",
              body: "Checks for missing triggers, hardcoded secrets, disconnected nodes, unbounded loops, credential drift.",
              color: "var(--amber)",
              colorDim: "var(--amber-dim)",
            },
            {
              num: "03",
              title: "Sandbox Run",
              body: "Executes the workflow in an isolated n8n instance with trigger coercion. Catches node errors at runtime.",
              color: "var(--violet)",
              colorDim: "var(--violet-dim)",
            },
            {
              num: "04",
              title: "Remediate",
              body: "Generates a prioritized fix plan — deterministic steps you can apply directly in the n8n editor.",
              color: "var(--jade)",
              colorDim: "var(--jade-dim)",
            },
          ].map((step, i) => (
            <div
              key={step.num}
              style={{
                background: "var(--surface-mid)",
                border: "1px solid var(--border-mid)",
                borderRadius: i === 0 ? "18px 0 0 18px" : i === 3 ? "0 18px 18px 0" : 0,
                padding: "28px 24px",
                position: "relative",
                animation: `fadeSlideIn 0.5s ${i * 0.07}s both`,
                overflow: "hidden",
              }}
            >
              {/* Top accent bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: step.color,
                  opacity: 0.7,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: step.color,
                  letterSpacing: "0.06em",
                  marginBottom: 14,
                  opacity: 0.75,
                }}
              >
                {step.num}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.025em",
                  marginBottom: 10,
                }}
              >
                {step.title}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ──────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "0 28px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
        className="feature-grid"
      >
        {[
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="5" width="14" height="2" rx="1" fill="currentColor" opacity="0.9"/>
                <rect x="2" y="9" width="10" height="2" rx="1" fill="currentColor" opacity="0.5"/>
                <rect x="2" y="13" width="7" height="2" rx="1" fill="currentColor" opacity="0.3"/>
              </svg>
            ),
            color: "var(--violet)",
            colorDim: "var(--violet-dim)",
            title: "Scored bands",
            body: "Production Ready / Minor Fixes / Significant Issues / Not Ready. Instant signal, no interpretation needed.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
                <path d="M9 6v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ),
            color: "var(--jade)",
            colorDim: "var(--jade-dim)",
            title: "Real-time progress",
            body: "Server-Sent Events stream parsing, static, sandbox, and remediation stages live as they run.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M9 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
            color: "var(--coral)",
            colorDim: "var(--coral-dim)",
            title: "Shareable reports",
            body: "Every result gets a tokenized link. Paste into Slack, your PR, or a Notion page.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="3" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.8"/>
                <rect x="10" y="3" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.4"/>
                <rect x="3" y="10" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.4"/>
                <rect x="10" y="10" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.6"/>
              </svg>
            ),
            color: "var(--sky)",
            colorDim: "var(--sky-dim)",
            title: "Fail-closed rules",
            body: "Hardcoded secrets, circular deps, or missing triggers? Score caps at 40 — no exceptions, no soft-landing.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 15l4-4 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
            color: "var(--amber)",
            colorDim: "var(--amber-dim)",
            title: "Simulation coverage",
            body: "Tracks exactly which nodes ran in the sandbox. Know what's verified versus what's estimated.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M6 3h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
                <path d="M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ),
            color: "var(--violet)",
            colorDim: "var(--violet-dim)",
            title: "Deterministic fixes",
            body: "Remediation steps are code-generated from issue codes — repeatable, not random AI suggestions.",
          },
        ].map((f, i) => (
          <div
            key={f.title}
            className="glass-plus"
            style={{
              padding: "24px",
              borderRadius: 18,
              animation: `fadeSlideIn 0.5s ${i * 0.06}s both`,
              transition: "border-color 0.22s, transform 0.22s, box-shadow 0.22s",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-plus)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "";
              (e.currentTarget as HTMLDivElement).style.transform = "";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "";
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: f.colorDim,
                border: `1px solid ${f.color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: f.color,
                marginBottom: 16,
              }}
            >
              {f.icon}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 650,
                color: "var(--text)",
                letterSpacing: "-0.025em",
                marginBottom: 8,
              }}
            >
              {f.title}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* ── CTA strip ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "0 28px 100px",
        }}
      >
        <div
          style={{
            background: "var(--surface-mid)",
            border: "1px solid var(--border-mid)",
            borderRadius: 24,
            padding: "52px 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            position: "relative",
            overflow: "hidden",
          }}
          className="cta-strip"
        >
          {/* bg orb */}
          <div
            style={{
              position: "absolute",
              right: -60,
              top: -60,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(138,99,255,0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <h2
              style={{
                fontSize: "clamp(20px, 2.5vw, 28px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                marginBottom: 8,
              }}
            >
              Is your workflow production-ready?
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-2)" }}>
              Paste or upload your exported n8n JSON and get a result in under 60 seconds.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0, flexWrap: "wrap", position: "relative" }}>
            <Link href="/verify?demo=1" className="btn-ghost" style={{ fontSize: 14 }}>
              Try demo
            </Link>
            <Link href="/verify" className="btn-primary" style={{ fontSize: 14, padding: "12px 28px" }}>
              Start verifying →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "20px 28px",
          maxWidth: 1160,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          Drygate · n8n Production Gate
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            color: "var(--text-faint)",
          }}
        >
          Sandbox requires Docker + n8n containers
        </span>
      </footer>
    </main>
  );
}