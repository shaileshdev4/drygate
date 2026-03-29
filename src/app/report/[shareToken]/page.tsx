import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import {
  RemediationItem,
  N8nWorkflow,
  ScoreBand,
  IssueSeverity,
  Issue,
  NodeTrace,
  NodeCoverage,
  ComplexityReport,
} from "@/types";
import { CoverageBreakdown } from "@/components/ui/CoverageBreakdown";
import { WorkflowGraph } from "@/components/ui/WorkflowGraph";
import { ReportCategorizedIssues } from "@/components/report/ReportCategorizedIssues";
import { scoreBandLabel } from "@/lib/utils";
import { hasFailClosedIssue } from "@/lib/scorer";

function getBaseUrl() {
  const v = process.env.NEXT_PUBLIC_APP_URL;
  if (v) return v;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

function bandHeadingClass(band: ScoreBand | null): string {
  if (band === "production_ready") return "report-score-band-label report-score-band-label--jade";
  if (band === "needs_minor_fixes") return "report-score-band-label report-score-band-label--amber";
  return "report-score-band-label";
}

export default async function ReportPage({ params }: { params: { shareToken: string } }) {
  const shareToken = params.shareToken;
  const baseUrl = getBaseUrl();
  const shareUrl = `${baseUrl}/report/${shareToken}`;

  const res = await fetch(`${baseUrl}/api/report/${shareToken}`, {
    cache: "no-store",
  });

  if (!res.ok) notFound();
  const data = (await res.json()) as Record<string, unknown>;

  const status = data?.status as string | undefined;
  const failed = status === "failed";
  const score = typeof data?.readinessScore === "number" ? data.readinessScore : null;
  const scoreband = (data?.scoreband ?? null) as ScoreBand | null;

  const staticReportData = data?.staticReport as {
    issues?: Issue[];
    complexityReport?: ComplexityReport;
  } | null;
  const issues = staticReportData?.issues ?? [];
  const complexityReport = staticReportData?.complexityReport ?? null;
  const remediationItems = (data?.remediationPlan as { items?: RemediationItem[] } | null)?.items ?? [];

  const simulationCoverage =
    typeof data?.simulationCoverage === "number"
      ? data.simulationCoverage
      : ((data?.runtimeReport as { simulationCoverage?: number } | null)?.simulationCoverage ?? null);

  const workflow = (data?.workflow ?? null) as N8nWorkflow | null;

  const pipelineError = data?.pipelineError as string | null | undefined;
  const createdAt = data?.createdAt as string | undefined;

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
  const highCount = bySeverity.critical + bySeverity.high;
  const mediumCount = bySeverity.medium;
  const failClosedHint = hasFailClosedIssue(issues) && score !== null && score <= 40;

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="min-h-screen grid-bg relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% -15%, rgba(138,99,255,0.12) 0%, transparent 55%), radial-gradient(ellipse 60% 45% at 100% 100%, rgba(46,207,150,0.06) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-[1] mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 pb-20 pt-10 sm:pt-14">
        {/* 1) Score first — full width, primary output */}
        <section className="report-score-hero w-full" aria-labelledby="score-hero-heading">
          <ScoreGauge score={score} scoreband={scoreband} compact />
          <div className="report-score-divider" aria-hidden />
          <div className="report-score-detail">
            <h1 id="score-hero-heading" className={bandHeadingClass(scoreband)}>
              {scoreBandLabel(scoreband)}
            </h1>
            <p className="report-score-band-sub">
              Static analysis, guardrails, and sandbox runtime combined into one score.
            </p>
            <div className="report-score-stats">
              <div className="report-stat-chip">
                <span className="report-stat-chip-num">{issueTotal}</span>
                <span className="report-stat-chip-label">Issues</span>
              </div>
              <div className="report-stat-chip">
                <span className="report-stat-chip-num">{highCount}</span>
                <span className="report-stat-chip-label">High</span>
              </div>
              <div className="report-stat-chip">
                <span className="report-stat-chip-num">{mediumCount}</span>
                <span className="report-stat-chip-label">Medium</span>
              </div>
              <div className="report-stat-chip">
                <span className="report-stat-chip-num">
                  {typeof simulationCoverage === "number" ? `${Math.round(simulationCoverage)}%` : "—"}
                </span>
                <span className="report-stat-chip-label">Coverage</span>
              </div>
              {complexityReport ? (
                <div
                  style={{
                    padding: "8px 14px",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      display: "block",
                      lineHeight: 1.2,
                      color:
                        complexityReport.rating === "low"
                          ? "var(--jade)"
                          : complexityReport.rating === "medium"
                            ? "var(--text)"
                            : complexityReport.rating === "high"
                              ? "var(--amber)"
                              : "var(--rose)",
                    }}
                  >
                    {complexityReport.rating === "low"
                      ? "Low"
                      : complexityReport.rating === "medium"
                        ? "Med"
                        : complexityReport.rating === "high"
                          ? "High"
                          : "V.High"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9,
                      color: "var(--muted2)",
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      display: "block",
                      marginTop: 2,
                    }}
                  >
                    Complexity
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          {complexityReport &&
          (complexityReport.rating === "high" || complexityReport.rating === "very_high") ? (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                background: "rgba(245,185,66,0.06)",
                border: "1px solid rgba(245,185,66,0.18)",
                borderRadius: 12,
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                Complexity: {complexityReport.rating}
              </span>
              {" — "}
              {complexityReport.reasons.slice(0, 2).join(". ")}
              {complexityReport.nodeCount > 20
                ? ". Consider splitting into sub-workflows for easier maintenance."
                : ""}
            </div>
          ) : null}
          {failClosedHint ? (
            <div className="report-failclosed-badge">
              <strong>Fail-closed rule</strong>
              Score may be capped at 40 when a critical class of issue is present (e.g. missing trigger,
              hardcoded secret, or unauthorized egress).
            </div>
          ) : null}
        </section>

        {/* Title + context + actions (secondary to score) */}
        <header className="report-header mt-10 mb-8">
          <div className="min-w-0 flex-1">
            <p className="report-eyebrow">Readiness report</p>
            <h2 className="report-title">{(data?.workflowName as string) ?? "Workflow"}</h2>
            <div className="report-meta">
              <span className={`report-pill ${failed ? "report-pill--danger" : "report-pill--success"}`}>
                {failed ? "Pipeline error" : "Verification complete"}
              </span>
              {typeof data?.nodeCount === "number" ? (
                <span className="report-pill report-pill--muted">{data.nodeCount} nodes</span>
              ) : null}
              {formattedDate ? (
                <span className="report-pill report-pill--muted">{formattedDate}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link href="/verify" className="report-btn-ghost">
              New verification
            </Link>
            <a href={shareUrl} className="report-btn-primary" target="_blank" rel="noreferrer">
              Share report
            </a>
          </div>
        </header>

        {pipelineError ? (
          <div
            className="mb-8 rounded-2xl p-5"
            style={{
              background: "var(--rose-dim)",
              border: "1px solid rgba(240,67,110,0.2)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--rose-light)" }}>
              What went wrong
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              {pipelineError}
            </p>
          </div>
        ) : null}

        {/* 2) Graph + coverage side by side */}
        {workflow && Array.isArray(issues) ? (
          <div className="report-two-col mb-14">
            <WorkflowGraph
              embedded
              workflow={workflow}
              issues={issues as Issue[]}
              nodeTraces={(data?.runtimeReport as { nodeTraces?: NodeTrace[] } | null)?.nodeTraces ?? []}
              coverageClassification={
                (data?.staticReport as { coverageClassification?: NodeCoverage[] } | null)?.coverageClassification ?? []
              }
            />
            <CoverageBreakdown
              reportLayout
              nodeTraces={(data?.runtimeReport as { nodeTraces?: NodeTrace[] } | null)?.nodeTraces ?? []}
              coverageClassification={
                (data?.staticReport as { coverageClassification?: NodeCoverage[] } | null)?.coverageClassification ?? []
              }
              simulationCoverage={simulationCoverage}
            />
          </div>
        ) : (
          <div className="report-two-col mb-14">
            <div
              className="report-graph-card flex items-center justify-center text-sm px-4 text-center"
              style={{ minHeight: 200, color: "var(--text-muted)" }}
            >
              Workflow graph appears after the next verification (workflow snapshot is stored with the report).
            </div>
            <CoverageBreakdown
              reportLayout
              nodeTraces={(data?.runtimeReport as { nodeTraces?: NodeTrace[] } | null)?.nodeTraces ?? []}
              coverageClassification={
                (data?.staticReport as { coverageClassification?: NodeCoverage[] } | null)?.coverageClassification ?? []
              }
              simulationCoverage={simulationCoverage}
            />
          </div>
        )}

        {/* 3) Categorized issues — collapsible groups; remediation inside each card */}
        <ReportCategorizedIssues issues={issues as Issue[]} remediationItems={remediationItems} />

        <footer className="report-share-footer mt-14">
          <div>
            <div className="report-share-text">
              Anyone with this link can view the report — no login required.
            </div>
            <div className="report-share-url">{shareUrl}</div>
          </div>
          <a href={shareUrl} className="report-btn-primary shrink-0" target="_blank" rel="noreferrer">
            Open share link
          </a>
        </footer>
      </div>
    </main>
  );
}
