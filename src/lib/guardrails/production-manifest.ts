import { N8nWorkflow, Issue } from "@/types";

/**
 * Parses DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST:
 * - Comma-separated credential **names** (as shown in n8n), e.g. `Slack_Prod,Postgres_RW`
 * - Or a JSON string array: `["Slack_Prod","Postgres_RW"]`
 *
 * When unset or empty, manifest enforcement is **disabled** (no false positives for local dev).
 */
export function parseCredentialAllowlistFromEnv(): string[] | null {
  const raw = process.env.DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST?.trim();
  if (!raw) return null;
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      return null;
    }
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Every referenced credential **name** must appear in the allowlist (case-insensitive).
 * Proves portability to a target n8n instance that only exposes approved credentials.
 */
export function runProductionManifestChecks(workflow: N8nWorkflow): Issue[] {
  const allowlist = parseCredentialAllowlistFromEnv();
  if (!allowlist || allowlist.length === 0) return [];

  const allowed = new Set(allowlist.map((n) => n.toLowerCase()));
  const issues: Issue[] = [];

  for (const node of workflow.nodes) {
    if (!node.credentials) continue;
    for (const [, credRef] of Object.entries(node.credentials)) {
      const name = credRef.name?.trim();
      if (!name) continue;
      if (!allowed.has(name.toLowerCase())) {
        issues.push({
          issueCode: "CREDENTIAL_NOT_IN_MANIFEST",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "high",
          title: `Credential "${name}" is not in the production manifest`,
          detail: `This node references credential name "${name}", which is not listed in DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST. In production, that credential may not exist or may be the wrong one.`,
          remediationHint:
            "Either add this credential name to the allowlist (if it is the correct production credential) or switch the node to use an allowlisted credential that exists in your production n8n instance.",
        });
      }
    }
  }

  return issues;
}
