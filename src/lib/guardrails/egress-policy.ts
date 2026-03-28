import { EgressLog, Issue } from "@/types";

/**
 * DRYGATE_EGRESS_ALLOWLIST — comma-separated **hostnames** (no scheme), e.g.
 * `api.stripe.com,hooks.slack.com,api.openai.com`
 *
 * When unset, egress policy checks are **skipped** (typical for persistent n8n without mock gateway).
 * Ephemeral sandbox traffic is logged by `mock-gateway`; this validates those URLs.
 */
export function parseEgressAllowlistFromEnv(): string[] | null {
  const raw = process.env.DRYGATE_EGRESS_ALLOWLIST?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameFromLogUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProbablyRawIp(host: string): boolean {
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":") && !host.includes(".")) return true;
  return false;
}

function hostMatchesAllowlist(host: string, allowed: Set<string>): boolean {
  if (allowed.has(host)) return true;
  for (const entry of Array.from(allowed)) {
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(2);
      if (host === suffix || host.endsWith("." + suffix)) return true;
    }
  }
  return false;
}

/**
 * Builds issues for outbound requests that are not on the allowlist or use raw IPs.
 * Typically fed from mock-gateway logs in **ephemeral** Docker sandbox mode.
 */
export function buildEgressPolicyIssues(logs: EgressLog[]): Issue[] {
  const allowlist = parseEgressAllowlistFromEnv();
  if (!allowlist || allowlist.length === 0) return [];

  const allowed = new Set(allowlist);
  const seen = new Set<string>();
  const issues: Issue[] = [];

  for (const log of logs) {
    const url = log.url;
    if (!url) continue;
    const host = hostnameFromLogUrl(url);
    if (!host) continue;
    const key = `${host}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (isProbablyRawIp(host)) {
      issues.push({
        issueCode: "UNAUTHORIZED_EGRESS_DETECTED",
        nodeId: "egress-policy",
        nodeName: "Outbound HTTP",
        nodeType: "egress",
        severity: "critical",
        title: `Egress to raw IP / non-DNS target: ${host}`,
        detail: `The sandbox observed a request to "${url}". Production policies usually require approved hostnames, not raw IPs.`,
        remediationHint:
          "Use a stable hostname (DNS) and add it to DRYGATE_EGRESS_ALLOWLIST if it is an approved dependency.",
      });
      continue;
    }

    if (!hostMatchesAllowlist(host, allowed)) {
      issues.push({
        issueCode: "UNAUTHORIZED_EGRESS_DETECTED",
        nodeId: "egress-policy",
        nodeName: "Outbound HTTP",
        nodeType: "egress",
        severity: "critical",
        title: `Egress to non-allowlisted host: ${host}`,
        detail: `Request URL: ${url.slice(0, 200)}. This hostname is not in DRYGATE_EGRESS_ALLOWLIST.`,
        remediationHint:
          "Restrict production workflows to known SaaS endpoints, or add this hostname to the allowlist after security review.",
      });
    }
  }

  return issues;
}
