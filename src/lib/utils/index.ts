import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ScoreBand, IssueSeverity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function scoreBandLabel(band: ScoreBand | null): string {
  switch (band) {
    case "production_ready":
      return "Production Ready";
    case "needs_minor_fixes":
      return "Needs Minor Fixes";
    case "significant_issues":
      return "Significant Issues";
    case "not_ready":
      return "Not Production Ready";
    default:
      return "Analyzing...";
  }
}

export function scoreBandColor(band: ScoreBand | null): string {
  switch (band) {
    case "production_ready":
      return "var(--green)";
    case "needs_minor_fixes":
      return "var(--amber)";
    case "significant_issues":
      return "var(--red)";
    case "not_ready":
      return "var(--red)";
    default:
      return "var(--text-muted)";
  }
}

export function scoreBandClass(band: ScoreBand | null): string {
  switch (band) {
    case "production_ready":
      return "text-green";
    case "needs_minor_fixes":
      return "text-amber";
    case "significant_issues":
      return "text-red";
    case "not_ready":
      return "text-red";
    default:
      return "text-muted";
  }
}

export function severityColor(severity: IssueSeverity): string {
  switch (severity) {
    case "critical":
      return "#FF3D3D";
    case "high":
      return "#FF6B35";
    case "medium":
      return "#FFB020";
    case "low":
      return "#3B82F6";
    case "info":
      return "#6B7280";
  }
}

export function severityBgClass(severity: IssueSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red/10 border-red/30 text-red";
    case "high":
      return "bg-orange/10 border-orange/30 text-orange";
    case "medium":
      return "bg-amber/10 border-amber/30 text-amber";
    case "low":
      return "bg-blue/10 border-blue/30 text-blue";
    case "info":
      return "bg-surface border-border text-muted";
  }
}

export function effortLabel(effort: string): string {
  switch (effort) {
    case "minutes":
      return "~5 min fix";
    case "hours":
      return "~1-2 hrs";
    case "days":
      return "1+ day";
    default:
      return effort;
  }
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function nodeClassLabel(cls: string): string {
  switch (cls) {
    case "fully_simulatable":
      return "Simulated";
    case "mock_intercepted":
      return "Mock Intercepted";
    case "credential_blocked":
      return "Blocked (Credentials)";
    case "destructive_blocked":
      return "Blocked (Destructive)";
    case "structural_only":
      return "Static Only";
    default:
      return cls;
  }
}

export function nodeClassColor(cls: string): string {
  switch (cls) {
    case "fully_simulatable":
      return "#05E27A";
    case "mock_intercepted":
      return "#3B82F6";
    case "credential_blocked":
      return "#FFB020";
    case "destructive_blocked":
      return "#FF3D3D";
    case "structural_only":
      return "#A855F7";
    default:
      return "#4A5568";
  }
}
