import { Issue } from "@/types";
import { SeverityBadge } from "./SeverityBadge";

function glowClass(severity: Issue["severity"]) {
  switch (severity) {
    case "critical":
      return "gate-card-critical";
    case "high":
      return "gate-card-high";
    case "medium":
      return "gate-card-medium";
    case "low":
      return "gate-card-low";
    case "info":
      return "gate-card-info";
  }
}

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className={["glass-plus rounded-xl p-4 border", glowClass(issue.severity)].join(" ")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <span className="mono-tag">{issue.issueCode}</span>
          </div>
          <div className="mt-2 text-sm text-muted">
            Node: <span className="text-text">{issue.nodeName}</span>
          </div>
          <div className="mt-1 text-base font-semibold">{issue.title}</div>
        </div>
        <div className="hidden shrink-0 sm:block">
          <div className="h-10 w-10 rounded-xl border bg-surface-plus/40" />
        </div>
      </div>

      <div className="mt-3 text-sm text-muted leading-relaxed">{issue.detail}</div>

      <div className="mt-3 rounded-lg border bg-surface-plus/40 p-3">
        <div className="text-xs uppercase tracking-widest text-muted">Remediation</div>
        <div className="mt-1 text-sm leading-relaxed">{issue.remediationHint}</div>
      </div>
    </div>
  );
}

