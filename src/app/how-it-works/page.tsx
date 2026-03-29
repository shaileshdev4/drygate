"use client";
import Link from "next/link";

const STEPS = [
  {
    number: "01",
    title: "Upload your workflow",
    description:
      "Paste your n8n workflow JSON directly or drag and drop a .json export. Drygate accepts any workflow format exported from the n8n editor - no preprocessing needed.",
    color: "var(--violet)",
    glow: "rgba(138,99,255,0.2)",
    detail: [
      "Supports paste, file upload, or the pre-loaded demo workflow",
      "Validates JSON structure immediately - clear errors if malformed",
      "Works with any n8n version export",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 16V4M8 8l4-4 4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 18v1a1 1 0 001 1h14a1 1 0 001-1v-1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Static analysis runs",
    description:
      "Drygate parses the workflow graph and runs deterministic rule checks — no n8n required. Findings roll up into five issue categories (Security, Reliability, Logic, Configuration, AI / Agents) on the report.",
    color: "var(--sky)",
    glow: "rgba(66,176,245,0.2)",
    detail: [
      "Graph: disconnected nodes, missing triggers, cycles, disabled nodes in path",
      "Expressions: risky {{ }} access, missing fallbacks, dead $node references",
      "Security & webhooks: secrets, webhook auth, prompt-injection heuristics for LLM nodes",
      "Reliability: error outputs, rate limiting (loops vs APIs), HTTP retries, schedules",
      "Input flow: validation between triggers and destructive or high-risk steps",
      "AI agents: system prompt, memory, error handling; plus a complexity score for maintainability",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" opacity="0.4" />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Sandbox execution",
    description:
      "The workflow is loaded into a real n8n instance. Triggers are converted to manual triggers so execution can start deterministically. Per-node traces power the coverage card on your report.",
    color: "var(--amber)",
    glow: "rgba(245,185,66,0.2)",
    detail: [
      "Sticky notes are annotations only — they are omitted from coverage and simulation lists",
      "Workflow triggers (e.g. Telegram, Webhook) are labeled Trigger, not lumped in with credential-blocked nodes",
      "Blocked = nodes that need real credentials or are unsafe to run in the sandbox; Skipped = on-graph but not executed (e.g. untaken branch)",
      "Simulation coverage = share of sandbox-runnable nodes that actually executed",
      "Runtime findings merge with static issues for one score",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.8"
          opacity="0.4"
        />
        <path d="M9 8l6 4-6 4V8z" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Score and band",
    description:
      "A deduction-based scorer starts from 100 and subtracts per finding. Critical issues (missing trigger, hardcoded secrets, unauthorized egress, circular dependencies) can trigger fail-closed caps. The report also shows a separate complexity rating (maintainability), not a pass/fail.",
    color: "var(--jade)",
    glow: "rgba(46,207,150,0.2)",
    detail: [
      "Score 85–100 → Production Ready",
      "Score 65–84 → Minor Issues",
      "Score 40–64 → Significant Issues",
      "Score below 40 → Not Ready",
      "Complexity badge: node count, branches, loops, depth — high/very high shows a short rationale",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    ),
  },
  {
    number: "05",
    title: "Remediation plan",
    description:
      "Every issue gets deterministic remediation steps — always safe, never hallucinated. With ANTHROPIC_API_KEY set, a subset of high/critical issues may also show an optional AI suggestion tailored to that node (Claude Haiku); if the API fails, you still have the full deterministic card.",
    color: "var(--coral)",
    glow: "rgba(255,107,74,0.2)",
    detail: [
      "Issues grouped by category; expand a row for step-by-step fixes",
      "Cards ordered by severity (critical first)",
      "Effort hints: minutes vs hours vs days",
      "Optional purple “AI suggestion” strip when the model returns a concise, node-specific fix",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.5"
        />
        <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    number: "06",
    title: "Shareable report",
    description:
      "Every verification generates a unique share token. Anyone with the link can view the full report — score, graph, coverage breakdown, categorized issues, and remediation — without an account.",
    color: "var(--violet-light)",
    glow: "rgba(167,139,255,0.2)",
    detail: [
      "Score hero with issue counts, coverage %, and complexity",
      "Interactive workflow graph colored by trace status and issues",
      "Coverage sidebar: Executed, Blocked, Skipped, Trigger",
      "No login required; dashboard history is available in demo mode",
    ],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M16 6l-4-4-4 4M12 2v13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const FAQ = [
  {
    q: "Does Drygate need my real n8n credentials?",
    a: "No. The sandbox uses a clean n8n instance that has no connection to your production environment. Credentials referenced in your workflow are detected as references but never validated against real systems.",
  },
  {
    q: "What n8n version does the sandbox use?",
    a: "The sandbox targets n8n 1.x (latest). The verification pipeline handles version-specific API differences automatically, with multi-attempt fallbacks for older n8n instances.",
  },
  {
    q: "How is the score calculated?",
    a: "The scorer starts at 100 and deducts points per finding. Deductions scale by severity (critical > high > medium > low). Some issues (missing trigger, hardcoded secrets) are fail-closed - they cap the score at a ceiling regardless of other findings. Runtime deductions for nodes that error in the sandbox add on top.",
  },
  {
    q: "Can the sandbox run every type of node?",
    a: "Most nodes run normally in the sandbox. External API calls are made from the sandbox environment. Nodes that require real credentials (e.g. database connections, OAuth services) will error in the sandbox - this is expected and is captured as a runtime trace, not a failure of Drygate itself.",
  },
  {
    q: "Is 0% simulation coverage a problem?",
    a: "It means no sandbox-runnable nodes executed successfully. Common causes: the first real steps need credentials the sandbox does not have, or execution stopped early. Your static analysis and issue list are still valid; triggers and stickies do not count against “blocked” the same way integration nodes do.",
  },
  {
    q: "Why do I see Postgres error 42P05 (prepared statement already exists)?",
    a: "Usually Supabase’s transaction pooler on port 6543. Add ?pgbouncer=true to DATABASE_URL (use &pgbouncer=true if the URL already has query params). Keep DIRECT_URL on a direct or session pooler for prisma db push.",
  },
  {
    q: "Do I need Anthropic for Drygate to work?",
    a: "No. ANTHROPIC_API_KEY only enables optional AI suggestion strips and the AI-enhanced remediation pass. The pipeline, score, and deterministic fix steps work without it.",
  },
  {
    q: "Is the share link public?",
    a: "Anyone with the share URL can view the report. The token is a random ID - it's not guessable, but it's not authenticated. Don't share reports that contain sensitive workflow structures you'd rather keep private.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen grid-bg relative">
      {/* Ambient glows */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(138,99,255,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(46,207,150,0.06) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-[1] mx-auto max-w-4xl px-5 sm:px-8 pb-24 pt-14 sm:pt-20">
        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="mb-20 max-w-2xl">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-4"
            style={{ color: "var(--violet-text)" }}
          >
            How it works
          </p>
          <h1
            className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.1] tracking-tight"
            style={{ color: "var(--text)" }}
          >
            From upload to scored report and fix plan
          </h1>
          <p className="mt-5 text-base leading-relaxed" style={{ color: "var(--text-2)" }}>
            Drygate runs a layered verification pipeline - static analysis then live sandbox
            execution - and produces a single readiness score with prioritized remediation cards.
          </p>
          <div className="mt-8 flex gap-3 flex-wrap">
            <Link
              href="/verify?demo=1"
              className="btn-primary"
              style={{ fontSize: 14, padding: "11px 24px" }}
            >
              Try with demo workflow
            </Link>
            <Link
              href="/verify"
              className="btn-ghost"
              style={{ fontSize: 14, padding: "11px 24px" }}
            >
              Upload your own
            </Link>
          </div>
        </div>

        {/* ── Steps ────────────────────────────────────────── */}
        <div className="space-y-6">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              style={{
                borderRadius: 20,
                border: "1px solid var(--border-mid)",
                background: "var(--surface-mid)",
                overflow: "hidden",
              }}
            >
              {/* Color accent top bar */}
              <div
                style={{
                  height: 2,
                  background: `linear-gradient(90deg, ${step.color}, transparent 70%)`,
                }}
              />

              <div className="p-7 sm:p-8">
                <div className="flex items-start gap-5">
                  {/* Number + icon */}
                  <div className="flex flex-col items-center gap-3 shrink-0 pt-0.5">
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: step.glow,
                        border: `1px solid ${step.color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: step.color,
                        flexShrink: 0,
                      }}
                    >
                      {step.icon}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        style={{
                          width: 1,
                          height: 20,
                          background: `linear-gradient(to bottom, ${step.color}40, transparent)`,
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          color: step.color,
                          opacity: 0.8,
                        }}
                      >
                        Step {step.number}
                      </span>
                    </div>
                    <h2
                      className="text-lg font-semibold tracking-tight mb-3"
                      style={{ color: "var(--text)" }}
                    >
                      {step.title}
                    </h2>
                    <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-2)" }}>
                      {step.description}
                    </p>

                    {/* Detail bullets */}
                    <ul className="space-y-2">
                      {step.detail.map((d, di) => (
                        <li
                          key={di}
                          className="flex items-start gap-2.5 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: step.color,
                              opacity: 0.6,
                              flexShrink: 0,
                              marginTop: 7,
                            }}
                          />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <div className="mt-24">
          <h2
            className="text-2xl font-semibold tracking-tight mb-10"
            style={{ color: "var(--text)" }}
          >
            Questions
          </h2>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  padding: "20px 24px",
                }}
              >
                <p className="font-semibold text-sm mb-2" style={{ color: "var(--text)" }}>
                  {item.q}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────── */}
        <div
          className="mt-20 text-center rounded-3xl p-10 sm:p-14 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, var(--surface-plus) 0%, var(--surface-mid) 100%)",
            border: "1px solid var(--border-mid)",
          }}
        >
          {/* Violet orb */}
          <div
            className="pointer-events-none absolute"
            style={{
              inset: 0,
              background:
                "radial-gradient(ellipse 60% 55% at 50% 120%, rgba(138,99,255,0.18) 0%, transparent 65%)",
            }}
          />
          <div className="relative z-[1]">
            <h2
              className="text-2xl font-semibold tracking-tight mb-3"
              style={{ color: "var(--text)" }}
            >
              Ready to verify your workflow?
            </h2>
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              Takes under 60 seconds. Score, issues, and fix plan - all in one report.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Link
                href="/verify?demo=1"
                className="btn-primary"
                style={{ fontSize: 14, padding: "12px 28px" }}
              >
                Use demo workflow
              </Link>
              <Link
                href="/verify"
                className="btn-ghost"
                style={{ fontSize: 14, padding: "12px 28px" }}
              >
                Upload your own
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
