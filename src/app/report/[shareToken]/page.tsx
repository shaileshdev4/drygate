import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { GateStatus } from "@/components/ui/GateStatus";
import { IssueCard } from "@/components/ui/IssueCard";
import { RemediationCard } from "@/components/ui/RemediationCard";
import { IssueSeverity, RemediationItem, ScoreBand } from "@/types";

function getBaseUrl() {
  const v = process.env.NEXT_PUBLIC_APP_URL;
  if (v) return v;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

const SEVERITY_META: Array<{ key: IssueSeverity; label: string; cssVar: string }> = [
  { key: "critical", label: "Critical", cssVar: "var(--rose)" },
  { key: "high", label: "High", cssVar: "var(--coral)" },
  { key: "medium", label: "Medium", cssVar: "var(--amber)" },
  { key: "low", label: "Low", cssVar: "var(--sky)" },
  { key: "info", label: "Info", cssVar: "var(--text-muted)" },
];

export default async function ReportPage({ params }: { params: { shareToken: string } }) {
  const shareToken = params.shareToken;
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/api/report/${shareToken}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();
  const data = (await res.json()) as any;

  const status = data?.status as string | undefined;
  const failed = status === "failed";
  const score = typeof data?.readinessScore === "number" ? data.readinessScore : null;
  const scoreband = (data?.scoreband ?? null) as ScoreBand | null;

  const issues = (data?.staticReport?.issues ?? []) as Array<any>;
  const remediationItems = (data?.remediationPlan?.items ?? []) as RemediationItem[];

  const simulationCoverage =
    typeof data?.simulationCoverage === "number"
      ? data.simulationCoverage
      : (data?.runtimeReport?.simulationCoverage ?? null);

  const pipelineError = data?.pipelineError as string | null | undefined;

  const bySeverity: Record<IssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const i of issues) {
    if (bySeverity[i.severity as IssueSeverity] !== undefined) {
      bySeverity[i.severity as IssueSeverity] += 1;
    }
  }

  const issueTotal = issues.length;
  const positiveFindings = issueTotal > 0;

  return (
    <main className="min-h-screen grid-bg relative">
      {/* Soft vignette - keeps focus on content */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% -15%, rgba(138,99,255,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 45% at 100% 100%, rgba(46,207,150,0.06) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-[1] mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 pb-20 pt-12 sm:pt-16">
        {/* ── Hero ───────────────────────────────────────── */}
        <header className="border-b border-[var(--border-mid)] pb-12 sm:pb-14">
          {/* Score - dominant, top center on mobile; top right on lg */}
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--violet-text)" }}
              >
                Readiness report
              </p>
              <h1
                className="text-[clamp(1.65rem,4vw,2.35rem)] font-semibold leading-[1.12] tracking-tight"
                style={{
                  color: "var(--text)",
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontWeight: 300,
                }}
              >
                {data?.workflowName ?? "Workflow"}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide"
                  style={{
                    background: failed ? "var(--rose-dim)" : "var(--jade-dim)",
                    color: failed ? "var(--rose-light)" : "var(--jade-light)",
                    border: `1px solid ${failed ? "rgba(240,67,110,0.22)" : "rgba(46,207,150,0.22)"}`,
                  }}
                >
                  {failed ? "Pipeline error" : "Verification complete"}
                </span>
                {typeof data?.nodeCount === "number" ? (
                  <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                    {data.nodeCount} nodes
                  </span>
                ) : null}
                {typeof simulationCoverage === "number" ? (
                  <span
                    className="text-sm font-mono"
                    style={{
                      color: simulationCoverage === 0 ? "var(--text-faint)" : "var(--text-muted)",
                    }}
                  >
                    {simulationCoverage}% sandbox coverage
                    {simulationCoverage === 0 ? " (credentials not set up in sandbox)" : ""}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 lg:pb-0.5 shrink-0">
              <Link
                href="/verify"
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border-plus)",
                  color: "var(--text-2)",
                  background: "var(--surface)",
                }}
              >
                New verification
              </Link>
              {/* Copy share link - proper CTA */}
              <a
                href={`${baseUrl}/report/${shareToken}`}
                className="btn-primary inline-flex items-center gap-2 justify-center rounded-full px-5 py-2.5 text-sm font-semibold"
                target="_blank"
                rel="noreferrer"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M8 1h4v4M12 1L7.5 5.5M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Share report
              </a>
            </div>
          </div>

          {pipelineError ? (
            <div
              className="mt-10 rounded-2xl p-5 sm:p-6"
              style={{
                background: "var(--rose-dim)",
                border: "1px solid rgba(240,67,110,0.2)",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--rose-light)" }}
              >
                What went wrong
              </p>
              <p
                className="mt-2 text-sm leading-relaxed sm:text-[15px]"
                style={{ color: "var(--text)" }}
              >
                {pipelineError}
              </p>
            </div>
          ) : null}
        </header>

        {/* ── Body: sidebar + main ───────────────────────── */}
        <div className="mt-14 grid gap-14 lg:mt-20 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-0">
          {/* Sidebar */}
          <aside className="space-y-10 lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <section
              className="rounded-[var(--r-xl)] p-7 sm:p-8"
              style={{
                background: "linear-gradient(165deg, var(--surface-plus) 0%, var(--surface) 100%)",
                border: "1px solid var(--border-mid)",
                boxShadow: "0 24px 80px -48px rgba(0,0,0,0.75)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                Score
              </p>
              <div className="mt-8 flex justify-center">
                <ScoreGauge score={score} scoreband={scoreband} />
              </div>
              <div className="mt-8 border-t border-[var(--border)] pt-8">
                <GateStatus scoreband={scoreband} />
              </div>
            </section>

            <section
              className="rounded-[var(--r-lg)] px-6 py-7 sm:px-7"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-muted)" }}
              >
                Findings by severity
              </p>
              <p className="mt-2 text-sm leading-snug" style={{ color: "var(--text-2)" }}>
                {positiveFindings
                  ? `${issueTotal} total across the categories below.`
                  : "No issues recorded for this run."}
              </p>

              {positiveFindings ? (
                <>
                  <div
                    className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--surface-high)", gap: 2 }}
                    title="Distribution by severity"
                  >
                    {SEVERITY_META.map(({ key, cssVar }) => {
                      const n = bySeverity[key];
                      if (n === 0) return null;
                      return (
                        <div
                          key={key}
                          className="h-full min-w-[6px]"
                          style={{ flex: `${n} 1 0`, background: cssVar }}
                        />
                      );
                    })}
                  </div>
                  <ul className="mt-6 space-y-4">
                    {SEVERITY_META.map(({ key, label, cssVar }) => (
                      <li key={key} className="flex items-center justify-between gap-4 text-sm">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: cssVar, boxShadow: `0 0 12px ${cssVar}66` }}
                          />
                          <span style={{ color: "var(--text-2)" }}>{label}</span>
                        </span>
                        <span
                          className="tabular-nums font-mono text-xs font-medium shrink-0 px-2 py-0.5 rounded-md"
                          style={{
                            color: "var(--text)",
                            background: "var(--surface-plus)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {bySeverity[key]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          </aside>

          {/* Main column */}
          <div className="space-y-16 lg:col-span-8">
            <section>
              <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold tracking-tight sm:text-2xl"
                    style={{ color: "var(--text)" }}
                  >
                    Issues
                  </h2>
                  <p
                    className="mt-2 max-w-xl text-sm leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Detailed findings from static analysis, guardrails, and sandbox execution.
                  </p>
                </div>
                {issueTotal > 18 ? (
                  <span
                    className="text-xs font-mono font-medium tabular-nums"
                    style={{ color: "var(--violet-text)" }}
                  >
                    Showing 18 of {issueTotal}
                  </span>
                ) : issueTotal > 0 ? (
                  <span
                    className="text-xs font-mono font-medium tabular-nums"
                    style={{ color: "var(--violet-text)" }}
                  >
                    {issueTotal} {issueTotal === 1 ? "issue" : "issues"}
                  </span>
                ) : null}
              </div>

              {issues.length === 0 ? (
                <p
                  className="rounded-[var(--r-lg)] px-6 py-14 text-center text-sm"
                  style={{
                    color: "var(--text-muted)",
                    border: "1px dashed var(--border-plus)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  No issues were generated for this workflow.
                </p>
              ) : (
                <div
                  className="space-y-5 max-h-[min(68vh,720px)] overflow-y-auto pr-1 sm:pr-2"
                  style={{ scrollbarGutter: "stable" }}
                >
                  {issues.slice(0, 18).map((issue, idx) => (
                    <IssueCard key={`${issue.issueCode}-${issue.nodeId}-${idx}`} issue={issue} />
                  ))}
                </div>
              )}

              {issues.length > 18 ? (
                <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Showing the first 18 issues. Export or re-run for the full list in larger
                  workflows.
                </p>
              ) : null}
            </section>

            <section className="border-t border-[var(--border)] pt-16">
              <div className="mb-8">
                <h2
                  className="text-xl font-semibold tracking-tight sm:text-2xl"
                  style={{ color: "var(--text)" }}
                >
                  Remediation
                </h2>
                <p
                  className="mt-2 max-w-xl text-sm leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Prioritized actions to improve production readiness. Expand each card for steps.
                </p>
              </div>

              {remediationItems.length === 0 ? (
                <p
                  className="rounded-[var(--r-lg)] px-6 py-14 text-center text-sm"
                  style={{
                    color: "var(--text-muted)",
                    border: "1px dashed var(--border-plus)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  No remediation plan was generated.
                </p>
              ) : (
                <div className="space-y-4">
                  {remediationItems.map((item, idx) => (
                    <RemediationCard
                      key={`${item.issueCode}-${item.nodeId}-${item.priority}-${idx}`}
                      item={item}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ── Share section ─────────────────────────────── */}
        <div
          className="mt-20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-mid)",
          }}
        >
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
              Share this report
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Anyone with this link can view the full report - no login required.
            </p>
            <p
              className="mt-2 font-mono text-[11px] break-all"
              style={{ color: "var(--text-faint)" }}
            >
              {`${baseUrl}/report/${shareToken}`}
            </p>
          </div>
          <a
            href={`${baseUrl}/report/${shareToken}`}
            className="btn-primary inline-flex shrink-0 items-center gap-2 justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M8 1h4v4M12 1L7.5 5.5M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Open share link
          </a>
        </div>
      </div>
    </main>
  );
}
