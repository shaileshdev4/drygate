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

  EXPRESSION_DEAD_NODE_REFERENCE: {
    title: "Fix or remove invalid $node references in expressions",
    steps: [
      "Open the node in the n8n editor.",
      "Find the expression containing $node[\"NodeName\"].",
      "Check if the referenced node was renamed or deleted.",
      "Update the expression to use the correct node name.",
      "Re-run the workflow to verify the reference resolves.",
    ],
    effort: "minutes",
  },

  EXPRESSION_NULL_REFERENCE: {
    title: "Use optional chaining and fallbacks in expressions",
    steps: [
      "Open the node and locate the expression.",
      "Replace .property with ?.property (optional chaining).",
      "Add a fallback with ?? 'default-value' at the end.",
      "Example: {{ $json.user.email }} → {{ $json.user?.email ?? '' }}",
    ],
    effort: "minutes",
  },

  EXPRESSION_ARRAY_INDEX: {
    title: "Guard array index access in expressions",
    steps: [
      "Before this node, add an IF node checking array length > 0.",
      "Route the false branch to a Set node with a safe default.",
      "On the true branch, access the array index safely.",
      "Alternatively use: {{ $json.items?.[0]?.id ?? null }}",
    ],
    effort: "minutes",
  },

  EXPRESSION_MISSING_FALLBACK: {
    title: "Add default values to expression outputs",
    steps: [
      "Open the node and find the expression.",
      "Add ?? 'fallback' after the field access.",
      "Choose a sensible default for the context (empty string, 0, null).",
    ],
    effort: "minutes",
  },

  AI_AGENT_NO_SYSTEM_PROMPT: {
    title: "Add a system prompt to the AI Agent",
    steps: [
      "Open the AI Agent node in n8n.",
      "Locate the system message or options → system message field.",
      "Write clear instructions: role, constraints, output format, and what to avoid.",
      "Save and test with a few representative inputs.",
    ],
    effort: "minutes",
  },

  AI_AGENT_NO_MEMORY: {
    title: "Attach memory to the conversational AI Agent",
    steps: [
      "Add a Window Buffer Memory (or Postgres/Redis Chat Memory) node to the canvas.",
      "Connect it to the AI Agent using the agent's memory input (sub-connection).",
      "Configure session key or persistence as required for your use case.",
      "Test a multi-turn conversation to confirm context is retained.",
    ],
    effort: "minutes",
  },

  AI_AGENT_NO_ERROR_HANDLING: {
    title: "Add error handling for the AI Agent",
    steps: [
      "Enable Continue On Fail on the agent or LLM sub-nodes if partial failure is acceptable.",
      "Or connect the node's error output to Slack, email, or a Set node that records the failure.",
      "Optionally add retry logic or a fallback model path after the error branch.",
      "Re-run Drygate to confirm the workflow no longer fails silently on LLM errors.",
    ],
    effort: "minutes",
  },

  LLM_NO_FALLBACK_MODEL: {
    title: "Add fallback or error routing for the LLM node",
    steps: [
      "Enable Continue On Fail on the LLM node if appropriate.",
      "Add an IF node downstream to detect empty or error output.",
      "Route failures to a second LLM provider or a notification node.",
      "Document the fallback path for operators.",
    ],
    effort: "minutes",
  },

  VECTOR_STORE_NO_VALIDATION: {
    title: "Validate vector store retrieval results",
    steps: [
      "Add an IF node immediately after the vector store node.",
      "Condition: results array exists and length > 0 (match your node's output shape).",
      "On false, route to a safe default response or skip downstream RAG steps.",
      "Test with a query that returns no matches.",
    ],
    effort: "minutes",
  },

  WEBHOOK_NO_AUTHENTICATION: {
    title: "Protect the webhook trigger",
    steps: [
      "Open the Webhook node and set Authentication to Header Auth, Basic Auth, or JWT as appropriate.",
      "Create a credential and share the secret only with trusted callers.",
      "Reject requests without valid credentials at the edge (reverse proxy or API gateway) if possible.",
      "Test with both valid and invalid requests before going live.",
    ],
    effort: "minutes",
  },

  AI_PROMPT_INJECTION_RISK: {
    title: "Sanitize untrusted input before LLM prompts",
    steps: [
      "Add a Code node before the AI Agent node.",
      "Extract only the specific field needed from user input. Example: const message = $input.first().json.message ?? '';",
      "Sanitize for injection patterns: const safe = message.replace(/ignore|disregard|forget|you are now/gi, '[removed]');",
      "Limit input length: const truncated = safe.slice(0, 500);",
      "Pass the sanitized variable into the prompt — never $json directly.",
    ],
    effort: "minutes",
  },

  HTTP_REQUEST_RETRY_DISABLED: {
    title: "Enable retry on fail for HTTP Request",
    steps: [
      "Open the HTTP Request node.",
      "Go to Settings tab.",
      'Enable "Retry On Fail".',
      "Set Max Tries to 3.",
      "Set Wait Between Tries to 1000ms minimum.",
    ],
    effort: "minutes",
  },

  LOOP_NO_RATE_LIMITING: {
    title: "Add a Wait node to pace loop iterations",
    steps: [
      "Find the Wait node in the n8n editor node panel.",
      "Insert it between the loop output and the API call node.",
      "Set wait duration to at least 1000ms (1 second).",
      "For HubSpot: 100ms. Slack: 1000ms. OpenAI: 500ms.",
      "Test by running with a small dataset first.",
    ],
    effort: "minutes",
  },

  SPLIT_IN_BATCHES_NO_WAIT: {
    title: "Insert a Wait between batches and API calls",
    steps: [
      "Insert a Wait node between Split In Batches and the downstream API node.",
      "Use 1–2 seconds between batches unless the API documents a stricter limit.",
      "Ensure output 1 (done) is connected so the workflow completes cleanly.",
      "Validate batch size vs API quotas.",
    ],
    effort: "minutes",
  },

  SCHEDULE_TOO_AGGRESSIVE: {
    title: "Relax the schedule trigger frequency",
    steps: [
      "Open the Schedule Trigger node and confirm the interval or cron is intentional.",
      "Increase the interval to at least 30–60 seconds for polling-style jobs, or longer if the API is rate-limited.",
      "Prefer webhooks or push notifications instead of tight polling when possible.",
      "Monitor execution count and API usage after changes.",
    ],
    effort: "minutes",
  },

  WEBHOOK_NO_RESPONSE_HANDLING: {
    title: "Add Respond to Webhook or change response mode",
    steps: [
      "Add a Respond to Webhook node on the path that should answer the caller.",
      "Configure status code and JSON/body to match your API contract.",
      "Alternatively set the Webhook response mode to immediate if you do not need to wait for downstream nodes.",
      "Test with curl or Postman to confirm the client receives a timely response.",
    ],
    effort: "minutes",
  },

  WEBHOOK_EXPOSED_ON_PUBLIC_PATH: {
    title: "Use a hard-to-guess path and strong authentication",
    steps: [
      "Replace short or dictionary paths with a long random segment (UUID).",
      "Enable Header Auth, Basic Auth, or JWT on the Webhook node.",
      "If the URL must stay simple, put authentication and rate limiting at your reverse proxy or API gateway.",
    ],
    effort: "minutes",
  },

  NO_INPUT_VALIDATION: {
    title: "Validate trigger payload before side effects",
    steps: [
      "Add an IF or Switch node after the trigger to assert required fields and types.",
      "Route invalid payloads to logging, error response, or a dead-letter path.",
      "Use optional chaining and defaults in expressions as a second layer of defense.",
    ],
    effort: "minutes",
  },

  LARGE_DATASET_NO_BATCHING: {
    title: "Batch large reads before downstream processing",
    steps: [
      "Add Split In Batches after the node that returns many rows (e.g. batch size 10–50).",
      "Process each batch in the loop output; connect the done output to post-processing.",
      "If each batch calls external APIs, add a Wait inside the loop to avoid rate limits.",
    ],
    effort: "minutes",
  },

  DESTRUCTIVE_WITH_NO_GUARD: {
    title: "Guard destructive operations behind validation",
    steps: [
      "Add IF/Switch/Filter immediately after the trigger to verify identity, intent, and payload shape.",
      "Never run delete, send, charge, or refund paths on unvalidated input.",
      "Log rejected attempts and return a safe error to the caller.",
    ],
    effort: "minutes",
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
