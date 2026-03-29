"use client";

import { useMemo, useState } from "react";
import { Issue, RemediationItem, IssueSeverity, EffortEstimate } from "@/types";
import { severityColor } from "@/lib/utils";
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  getIssueCategory,
  type IssueCategory,
} from "@/lib/remediation/categories";

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function emptyBuckets(): Record<IssueCategory, Issue[]> {
  return {
    security: [],
    reliability: [],
    logic: [],
    configuration: [],
    ai_agents: [],
  };
}

function sortBySeverity(a: Issue, b: Issue): number {
  return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
}

function CategoryIcon({ id }: { id: IssueCategory }) {
  const stroke =
    id === "security"
      ? "#f0436e"
      : id === "reliability"
        ? "#f5b942"
        : id === "logic"
          ? "#c084fc"
          : id === "configuration"
            ? "#42b0f5"
            : "#2ecf96";

  if (id === "security") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M7 1L12 3V7C12 10 9.5 12.5 7 13C4.5 12.5 2 10 2 7V3L7 1Z"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M5 7L6.5 8.5L9 5.5"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "reliability") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M7 2V7L9.5 9.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="7" cy="7" r="5.5" stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }
  if (id === "logic") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M3 7H11M7 3V11" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="7" cy="7" r="5" stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }
  if (id === "configuration") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="2" stroke={stroke} strokeWidth="1.2" />
        <path
          d="M7 1V3M7 11V13M13 7H11M3 7H1M11.24 2.76L9.83 4.17M4.17 9.83L2.76 11.24M11.24 11.24L9.83 9.83M4.17 4.17L2.76 2.76"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1L8.2 3.8H11L8.7 5.7L9.6 8.5L7 6.8L4.4 8.5L5.3 5.7L3 3.8H5.8L7 1Z"
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function effortPhrase(e: EffortEstimate): string {
  if (e === "minutes") return "~5 min fix";
  if (e === "hours") return "~1–2 hrs";
  return "~1+ days";
}

function severityPill(sev: IssueSeverity): { label: string; pillClass: string } {
  switch (sev) {
    case "critical":
      return { label: "CRIT", pillClass: "report-pill report-pill--danger report-issue-sev-pill" };
    case "high":
      return { label: "HIGH", pillClass: "report-pill report-pill--danger report-issue-sev-pill" };
    case "medium":
      return { label: "MED", pillClass: "report-pill report-pill--warn report-issue-sev-pill" };
    case "low":
      return { label: "LOW", pillClass: "report-pill report-pill--info report-issue-sev-pill" };
    default:
      return { label: "INFO", pillClass: "report-pill report-pill--muted report-issue-sev-pill" };
  }
}

function codeColor(sev: IssueSeverity): string {
  switch (sev) {
    case "critical":
    case "high":
      return "var(--rose)";
    case "medium":
      return "var(--amber)";
    case "low":
      return "var(--sky)";
    default:
      return "var(--text-muted)";
  }
}

function remedySteps(issue: Issue, items: RemediationItem[]): { steps: string[]; effort: EffortEstimate } {
  const match = items.find((r) => r.issueCode === issue.issueCode && r.nodeId === issue.nodeId);
  if (match && match.steps.length > 0) {
    return { steps: match.steps, effort: match.estimatedEffort };
  }
  return { steps: [issue.remediationHint], effort: "minutes" };
}

interface Props {
  issues: Issue[];
  remediationItems: RemediationItem[];
  maxVisible?: number;
}

export function ReportCategorizedIssues({ issues, remediationItems, maxVisible = 80 }: Props) {
  const [openIssue, setOpenIssue] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const buckets = emptyBuckets();
    const slice = issues.slice(0, maxVisible);
    for (const i of slice) {
      buckets[getIssueCategory(i.issueCode)].push(i);
    }
    for (const cat of CATEGORY_ORDER) {
      buckets[cat].sort(sortBySeverity);
    }
    return { buckets, truncated: issues.length > maxVisible };
  }, [issues, maxVisible]);

  const toggleIssue = (key: string) => {
    setOpenIssue((prev) => (prev === key ? null : key));
  };

  const renderIssue = (issue: Issue, idx: number) => {
    const key = `${issue.issueCode}:${issue.nodeId}:${idx}`;
    const expanded = openIssue === key;
    const { steps, effort } = remedySteps(issue, remediationItems);
    const pill = severityPill(issue.severity);
    const borderColor =
      issue.severity === "critical" || issue.severity === "high"
        ? "var(--rose)"
        : issue.severity === "medium"
          ? "var(--amber)"
          : issue.severity === "low"
            ? "var(--sky)"
            : "rgba(255,255,255,0.12)";

    return (
      <div key={key} className="report-issue-card" style={{ borderLeft: `3px solid ${borderColor}` }}>
        <button type="button" className="report-issue-card-header" onClick={() => toggleIssue(key)}>
          <div
            className="report-issue-severity-dot"
            style={{
              background: severityColor(issue.severity),
              boxShadow:
                issue.severity === "critical" || issue.severity === "high"
                  ? `0 0 6px ${severityColor(issue.severity)}`
                  : undefined,
            }}
          />
          <div className="report-issue-card-body">
            <div className="report-issue-code-row">
              <span className="report-issue-code" style={{ color: codeColor(issue.severity) }}>
                {issue.issueCode}
              </span>
              <span className="report-issue-node-tag">· {issue.nodeName}</span>
            </div>
            <div className="report-issue-title">{issue.title}</div>
            <div className="report-issue-detail">{issue.detail}</div>
          </div>
          <span className={pill.pillClass}>{pill.label}</span>
        </button>
        {expanded ? (
          <div className="report-issue-remedy">
            <div className="report-remedy-effort">{effortPhrase(effort)}</div>
            <div className="report-remedy-label">Remediation steps</div>
            <ul className="report-remedy-steps">
              {steps.map((step, sidx) => (
                <li key={sidx} className="report-remedy-step">
                  <span className="report-step-num">{sidx + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            {issue.aiSuggestion ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  background: "rgba(138,99,255,0.06)",
                  border: "1px solid rgba(138,99,255,0.18)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "rgba(138,99,255,0.7)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M5 1L6.2 3.8H9L6.7 5.7L7.6 8.5L5 6.8L2.4 8.5L3.3 5.7L1 3.8H3.8L5 1Z"
                      fill="rgba(138,99,255,0.8)"
                    />
                  </svg>
                  AI suggestion — specific to this node
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.75)",
                    lineHeight: 1.5,
                    marginBottom: issue.aiSuggestion.exampleCode ? 8 : 0,
                  }}
                >
                  {issue.aiSuggestion.specificFix}
                </p>
                {issue.aiSuggestion.exampleCode ? (
                  <code
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontFamily: "var(--mono)",
                      color: "rgba(138,99,255,0.6)",
                      marginTop: 6,
                      padding: "6px 10px",
                      background: "rgba(138,99,255,0.08)",
                      borderRadius: 6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {issue.aiSuggestion.exampleCode}
                  </code>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCategory = (id: IssueCategory, list: Issue[]) => {
    if (list.length === 0) return null;
    const meta = CATEGORY_META[id];
    return (
      <details key={id} className="report-category-group" open>
        <summary className="report-category-header">
          <div
            className="report-category-icon"
            style={{ background: meta.bgColor, border: `1px solid ${meta.borderColor}` }}
          >
            <CategoryIcon id={id} />
          </div>
          <span className="report-category-name" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span
            className="report-category-count"
            style={{
              background: meta.bgColor,
              color: meta.color,
              border: `1px solid ${meta.borderColor}`,
            }}
          >
            {list.length}
          </span>
          <span className="report-category-chevron">▾</span>
        </summary>
        <div>{list.map((issue, i) => renderIssue(issue, i))}</div>
      </details>
    );
  };

  const totalShown = CATEGORY_ORDER.reduce((n, id) => n + grouped.buckets[id].length, 0);

  return (
    <>
      <div className="report-issues-header">
        <h2 className="report-section-title">Issues</h2>
        <p className="report-issues-total">
          {issues.length} total · click an issue for fix steps
          {grouped.truncated ? ` · showing first ${maxVisible}` : ""}
        </p>
      </div>

      {issues.length === 0 ? (
        <p
          className="text-sm py-12 text-center rounded-xl border border-white/[0.07]"
          style={{ color: "var(--text-muted)" }}
        >
          No issues were generated for this workflow.
        </p>
      ) : (
        <>
          {CATEGORY_ORDER.map((id) => renderCategory(id, grouped.buckets[id]))}
          {totalShown === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No issues in view.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
