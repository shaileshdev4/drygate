import { N8nWorkflow, Issue } from "@/types";

// Patterns that strongly suggest a hardcoded secret
const SECRET_PATTERNS = [
  /bearer\s+[a-zA-Z0-9\-_.]{20,}/i,
  /token["\s]*[:=]["\s]*[a-zA-Z0-9\-_.]{16,}/i,
  /api[_-]?key["\s]*[:=]["\s]*[a-zA-Z0-9\-_.]{16,}/i,
  /secret["\s]*[:=]["\s]*[a-zA-Z0-9\-_.]{16,}/i,
  /password["\s]*[:=]["\s]*[^\s"]{8,}/i,
  /authorization["\s]*[:=]["\s]*[a-zA-Z0-9\-_.]{16,}/i,
  /private[_-]?key/i,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[a-zA-Z0-9]{20,}/,       // OpenAI-style keys
  /xoxb-[0-9]+-/,              // Slack bot tokens
  /ghp_[a-zA-Z0-9]{36}/,       // GitHub PATs
  /AIza[0-9A-Za-z-_]{35}/,     // Google API keys
];

/**
 * Recursively walk a value tree and return paths where secrets look hardcoded.
 */
function findSecretsInValue(
  value: unknown,
  path: string
): Array<{ path: string; reason: string }> {
  const findings: Array<{ path: string; reason: string }> = [];

  if (typeof value === "string") {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) {
        findings.push({
          path,
          reason: `Value matches pattern: ${pattern.source.substring(0, 40)}...`,
        });
        break; // one finding per field is enough
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      findings.push(...findSecretsInValue(item, `${path}[${i}]`));
    });
  } else if (value !== null && typeof value === "object") {
    for (const [key, val] of Object.entries(
      value as Record<string, unknown>
    )) {
      findings.push(...findSecretsInValue(val, `${path}.${key}`));
    }
  }

  return findings;
}

export function runCredentialChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];

  for (const node of workflow.nodes) {
    // ── 1. Hardcoded secrets scan ──────────────────────────────────────
    const secretFindings = findSecretsInValue(
      node.parameters,
      `nodes["${node.name}"].parameters`
    );

    for (const finding of secretFindings) {
      issues.push({
        issueCode: "HARDCODED_SECRET",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "critical",
        title: `Hardcoded secret detected in "${node.name}"`,
        detail: `A value at field path \`${finding.path}\` appears to be a hardcoded secret or API key. Committing this workflow exposes your credentials.`,
        remediationHint:
          "Move this value to n8n's Credentials manager. Reference it with an expression like `{{ $credentials.myService.apiKey }}` instead of hardcoding.",
        fieldPath: finding.path,
      });
    }

    // ── 2. Credential reference present but not named ──────────────────
    if (node.credentials) {
      for (const [credType, credRef] of Object.entries(node.credentials)) {
        if (!credRef.name || credRef.name.trim() === "") {
          issues.push({
            issueCode: "CREDENTIAL_REF_MISSING",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "high",
            title: `Credential reference unnamed in "${node.name}"`,
            detail: `Node references credential type "${credType}" but the credential name is empty. This will fail at runtime.`,
            remediationHint:
              "Open this node in the n8n editor, go to Credentials, and select or create the correct credential.",
          });
        }
      }
    }

    // ── 3. HTTP Request node with auth but no credential ──────────────
    if (
      node.type === "n8n-nodes-base.httpRequest" &&
      node.parameters?.authentication &&
      node.parameters.authentication !== "none" &&
      node.parameters.authentication !== "" &&
      (!node.credentials || Object.keys(node.credentials).length === 0)
    ) {
      issues.push({
        issueCode: "CREDENTIAL_REF_INCONSISTENT",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "high",
        title: `HTTP Request "${node.name}" has auth type set but no credential configured`,
        detail: `The node has authentication set to "${node.parameters.authentication}" but no credential is attached. The request will fail with 401.`,
        remediationHint:
          "Either set authentication to 'None' if the endpoint is public, or attach the correct credential in the node settings.",
      });
    }
  }

  return issues;
}