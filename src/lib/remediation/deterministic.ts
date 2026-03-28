import { Issue, IssueCode, RemediationItem, RemediationPlan, EffortEstimate } from "@/types";

// ─────────────────────────────────────────────────────────
// Lookup table: issueCode → deterministic fix steps
// This is the fallback. Always correct. Never hallucinates.
// ─────────────────────────────────────────────────────────

interface FixTemplate {
  title: string;
  steps: string[];
  effort: EffortEstimate;
}

const FIX_TEMPLATES: Record<IssueCode, FixTemplate> = {
  MISSING_TRIGGER: {
    title: "Add a trigger node to start the workflow",
    steps: [
      "Open the workflow in n8n editor.",
      "Click the '+' button to add a new node.",
      "Search for a trigger type: 'Webhook' for HTTP-triggered flows, 'Schedule Trigger' for timed jobs, or 'Manual Trigger' for one-off runs.",
      "Connect the trigger node to the first processing node.",
      "Save and activate the workflow.",
    ],
    effort: "minutes",
  },

  DISCONNECTED_NODE: {
    title: "Connect or remove the orphaned node",
    steps: [
      "Locate the disconnected node in the editor canvas.",
      "If it belongs in the workflow: connect its input handle to the correct upstream node and its output to the correct downstream node.",
      "If it was added by mistake: select it and press Delete.",
      "Save the workflow.",
    ],
    effort: "minutes",
  },

  CIRCULAR_DEPENDENCY: {
    title: "Break the cycle with an explicit exit condition",
    steps: [
      "Identify the back-edge - the connection that creates the loop.",
      "Insert an IF node before the back-edge.",
      "In the IF node, define an exit condition (e.g., item count >= expected, a flag variable, or a counter check).",
      "Connect the IF node's 'true' branch back into the loop and 'false' branch to the next step after the loop.",
      "Alternatively, use n8n's 'Split In Batches' node which has a built-in done output (output 1).",
    ],
    effort: "hours",
  },

  DISABLED_NODE_IN_PATH: {
    title: "Re-enable the node or reconnect the path around it",
    steps: [
      "Right-click the disabled node and select 'Enable'.",
      "Alternatively: delete the disabled node and draw a direct connection from its upstream node to its downstream node.",
      "Verify the path is complete by running a test execution.",
    ],
    effort: "minutes",
  },

  HARDCODED_SECRET: {
    title: "Move the secret to n8n Credentials and reference it safely",
    steps: [
      "Go to n8n Settings → Credentials → Add Credential.",
      "Select the correct credential type for your service.",
      "Enter your API key or secret there.",
      "In the affected node, remove the hardcoded value from the parameter field.",
      "Select the credential you just created from the node's credential dropdown.",
      "If you use expressions, reference it as {{ $credentials.yourCredentialName.apiKey }}.",
      "Rotate the exposed key in your external service dashboard immediately.",
    ],
    effort: "minutes",
  },

  CREDENTIAL_REF_MISSING: {
    title: "Attach a credential to the node",
    steps: [
      "Open the node in the editor.",
      "Click the 'Credential' dropdown field.",
      "Select an existing credential or click 'Create New' to add one.",
      "Save the node and test the connection.",
    ],
    effort: "minutes",
  },

  CREDENTIAL_REF_INCONSISTENT: {
    title: "Resolve the mismatch between auth type and credential",
    steps: [
      "Open the HTTP Request node.",
      "In the Authentication field: if the endpoint is public, set it to 'None'.",
      "If authentication is required, select the correct auth type (Bearer Token, OAuth2, API Key, etc.).",
      "Attach the corresponding credential from the Credentials dropdown.",
      "Test the request with a manual execution.",
    ],
    effort: "minutes",
  },

  MISSING_ERROR_OUTPUT: {
    title: "Add error handling to the node",
    steps: [
      "Open the node settings in the editor.",
      "Look for the error output handle (red dot on the bottom of the node).",
      "Connect the error output to a handler node - typically a Slack/email notification or a logging node.",
      "Alternatively: enable 'Continue On Fail' in the node settings if failure is acceptable and you handle it downstream.",
      "For a global approach: set an Error Workflow in the workflow settings.",
    ],
    effort: "minutes",
  },

  NO_GLOBAL_ERROR_WORKFLOW: {
    title: "Configure a global error workflow",
    steps: [
      "Create a separate n8n workflow that handles error notifications (e.g., sends a Slack message with the error details).",
      "Activate that workflow.",
      "Go back to your main workflow → Settings (gear icon).",
      "Under 'Error Workflow', select the error handler workflow you just created.",
      "Save.",
    ],
    effort: "hours",
  },

  UNBOUNDED_LOOP: {
    title: "Connect the completion output of the loop node",
    steps: [
      "Open the workflow editor.",
      "Find the Split In Batches or Loop Over Items node.",
      "Output 0 is the loop body - it should go to the work being done per item.",
      "Output 1 is the 'done' port - connect it to the node that should run after all items are processed.",
      "If output 1 is not visible, hover over the bottom of the node to reveal it.",
    ],
    effort: "minutes",
  },

  LONG_SYNCHRONOUS_WAIT: {
    title: "Replace long wait with a webhook-resume pattern",
    steps: [
      "Remove the Wait node or reduce its duration to under 60 seconds.",
      "For long delays (minutes/hours/days): split the workflow into two parts.",
      "Part 1 ends by scheduling a future event (e.g., via a queue or external scheduler).",
      "Part 2 is triggered by a Webhook or another trigger when the delay completes.",
      "This prevents holding open execution records and consuming worker resources.",
    ],
    effort: "hours",
  },

  LARGE_PAYLOAD_RISK: {
    title: "Add a timeout to the HTTP Request node",
    steps: [
      "Open the HTTP Request node.",
      "Scroll to the 'Options' section at the bottom.",
      "Enable 'Timeout' and set it to a reasonable value (10000ms for most APIs, up to 30000ms for slow endpoints).",
      "Save the node.",
    ],
    effort: "minutes",
  },

  NODE_ERRORED_IN_SANDBOX: {
    title: "Fix the node error identified during sandbox execution",
    steps: [
      "Check the sandbox error message in the runtime trace for the exact failure reason.",
      "Common causes: malformed expression, undefined variable reference, missing required parameter.",
      "Open the node and review all parameter expressions for syntax errors.",
      "Use n8n's expression editor to test the expression against a sample input.",
      "Re-verify after fixing.",
    ],
    effort: "minutes",
  },

  BLOCKED_REQUIRES_CREDENTIALS: {
    title: "Configure credentials before this node can be tested",
    steps: [
      "This node requires credentials that the sandbox cannot access.",
      "In your real n8n instance, ensure the credential is created and attached to the node.",
      "Test this node manually by running the workflow in development mode with real credentials.",
    ],
    effort: "minutes",
  },

  BLOCKED_DESTRUCTIVE_SIDE_EFFECT: {
    title: "Review and safeguard this destructive node",
    steps: [
      "This node (email, file write, etc.) was blocked from sandbox execution to prevent side effects.",
      "Ensure this node only runs when the workflow reaches production intentionally.",
      "Add an upstream IF node to guard this action with a condition.",
      "Consider adding logging before this node so you can verify intent in production.",
    ],
    effort: "hours",
  },

  BLOCKED_UNKNOWN_NODE: {
    title: "Verify this community/custom node is safe and installed correctly",
    steps: [
      "Check that this community node is installed in your n8n instance.",
      "Verify the node version matches what the workflow expects.",
      "Review the node's documentation for any production considerations.",
      "Test this node manually in your n8n instance.",
    ],
    effort: "hours",
  },

  CREDENTIAL_NOT_IN_MANIFEST: {
    title: "Align credential names with the production allowlist",
    steps: [
      "Open n8n → Credentials and confirm the exact name of the credential that should run in production.",
      "Update DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST (comma-separated or JSON array) to include that name, or change the node to reference an allowlisted credential.",
      "Re-export the workflow and re-run Drygate.",
    ],
    effort: "minutes",
  },

  UNAUTHORIZED_EGRESS_DETECTED: {
    title: "Restrict outbound HTTP to approved hosts",
    steps: [
      "Review the flagged URL in the report - decide if this dependency is legitimate.",
      "If approved, add its hostname to DRYGATE_EGRESS_ALLOWLIST (comma-separated hostnames).",
      "If not approved, remove or replace the HTTP Request node, or route traffic through an internal proxy you control.",
    ],
    effort: "hours",
  },

  MISSING_ASYNC_TIMEOUT: {
    title: "Add timeouts or bounds to long-running async steps",
    steps: [
      "For HTTP Request: set Options → Timeout to a value aligned with the upstream SLA (e.g. 10–30s).",
      "For Wait nodes that resume on webhook: ensure global execution timeouts and monitoring are configured in n8n.",
      "For sub-workflows: use version-specific timeout options if available.",
    ],
    effort: "minutes",
  },

  INPUT_CONTRACT_FAILURE: {
    title: "Harden the workflow against payload shape drift",
    steps: [
      "Add a Set or Code node after the trigger to default missing fields.",
      "Use optional chaining in expressions where you read nested JSON.",
      "Optionally validate with an IF node + Stop and Error for invalid payloads.",
    ],
    effort: "hours",
  },
};

// Priority order by severity
const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  info: 5,
};

export function generateDeterministicPlan(issues: Issue[]): RemediationItem[] {
  const sorted = [...issues].sort(
    (a, b) => (SEVERITY_PRIORITY[a.severity] ?? 5) - (SEVERITY_PRIORITY[b.severity] ?? 5),
  );

  return sorted.map((issue, index) => {
    const template = FIX_TEMPLATES[issue.issueCode];

    return {
      issueCode: issue.issueCode,
      nodeId: issue.nodeId,
      nodeName: issue.nodeName,
      priority: index + 1,
      title: template?.title ?? issue.title,
      steps: template?.steps ?? [issue.remediationHint],
      estimatedEffort: template?.effort ?? "minutes",
    } satisfies RemediationItem;
  });
}

// ─────────────────────────────────────────────────────────
// AI enhancer - calls Claude/CREAO, falls back silently
// ─────────────────────────────────────────────────────────

export async function generateRemediationPlan(issues: Issue[]): Promise<RemediationPlan> {
  const deterministic = generateDeterministicPlan(issues);

  if (issues.length === 0) {
    return { items: [], generatedBy: "deterministic" };
  }

  try {
    const enhanced = await callAIEnhancer(issues, deterministic);
    if (enhanced && validateAIResponse(enhanced, issues)) {
      return { items: enhanced, generatedBy: "ai_enhanced" };
    }
  } catch {
    // Fallback - deterministic is always the safety net
  }

  return { items: deterministic, generatedBy: "deterministic" };
}

async function callAIEnhancer(
  issues: Issue[],
  fallback: RemediationItem[],
): Promise<RemediationItem[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an n8n workflow reliability engineer.
  
  Below is a JSON array of issues found in an n8n workflow. For each issue, rewrite the remediation steps to be more specific and actionable given the node context.
  
  STRICT RULES:
  - Return ONLY a JSON array. No markdown, no explanation, no preamble.
  - Every item MUST include the original issueCode and nodeId fields unchanged.
  - Do NOT invent fixes that are not related to the issue.
  - Do NOT add items not in the input list.
  - Steps must be concrete and reference n8n specifically.
  
  Issues:
  ${JSON.stringify(
    issues.map((i) => ({
      issueCode: i.issueCode,
      nodeId: i.nodeId,
      nodeName: i.nodeName,
      severity: i.severity,
      title: i.title,
      detail: i.detail,
    })),
    null,
    2,
  )}
  
  Respond ONLY with a JSON array of RemediationItem objects with fields: issueCode, nodeId, nodeName, priority, title, steps (string[]), estimatedEffort ("minutes"|"hours"|"days").`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function validateAIResponse(items: RemediationItem[], originalIssues: Issue[]): boolean {
  if (!Array.isArray(items)) return false;

  const validCodes = new Set(originalIssues.map((i) => i.issueCode));

  // Every AI item must map to a real issue code
  return items.every(
    (item) =>
      item.issueCode &&
      validCodes.has(item.issueCode) &&
      item.nodeId &&
      Array.isArray(item.steps) &&
      item.steps.length > 0,
  );
}
