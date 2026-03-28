import { N8nWorkflow, Issue } from "@/types";
import { N8nConnections } from "@/types";

/**
 * n8n connections have two output types: "main" (success) and "error".
 * We check that nodes with failure risk have their error output connected.
 */

// Node types that are high-failure-risk and MUST have error handling
const HIGH_RISK_TYPES = [
  "n8n-nodes-base.httpRequest",
  "n8n-nodes-base.graphql",
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.mysql",
  "n8n-nodes-base.mongodb",
  "n8n-nodes-base.redis",
  "n8n-nodes-base.code",
  "n8n-nodes-base.function",
  "n8n-nodes-base.executeWorkflow",
  "n8n-nodes-base.slack",
  "n8n-nodes-base.gmail",
];

function hasErrorOutputConnected(nodeName: string, connections: N8nConnections): boolean {
  const nodeConnections = connections[nodeName];
  if (!nodeConnections) return false;

  // n8n error output is stored under the "error" key in connections
  const errorOutputs = nodeConnections["error"];
  if (!errorOutputs) return false;

  // Check if any error output actually connects to something
  return errorOutputs.some((group) => Array.isArray(group) && group.length > 0);
}

export function runErrorHandlingChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  let hasGlobalErrorWorkflow = false;

  // Check workflow-level error workflow setting
  if (workflow.settings && (workflow.settings as Record<string, unknown>).errorWorkflow) {
    hasGlobalErrorWorkflow = true;
  }

  for (const node of workflow.nodes) {
    if (node.disabled) continue;

    const isHighRisk = HIGH_RISK_TYPES.some((t) =>
      node.type.toLowerCase().includes(t.toLowerCase()),
    );

    if (!isHighRisk) continue;

    const hasContinueOnFail = node.continueOnFail === true;
    const hasErrorOutput = hasErrorOutputConnected(node.name, workflow.connections);

    if (!hasContinueOnFail && !hasErrorOutput) {
      issues.push({
        issueCode: "MISSING_ERROR_OUTPUT",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "high",
        title: `No error handling on "${node.name}"`,
        detail: `This node can fail at runtime (network errors, timeouts, permission issues) but has no error output connected and "Continue On Fail" is off. A single failure here will crash the entire workflow silently.`,
        remediationHint: `Either: (1) connect the error output to a notification or logging node, (2) enable "Continue On Fail" in the node settings if failure is acceptable, or (3) set a global error workflow in the workflow settings.`,
      });
    }
  }

  // Workflow-level: if no global error workflow and there are high-risk nodes
  const highRiskNodes = workflow.nodes.filter((n) =>
    HIGH_RISK_TYPES.some((t) => n.type.toLowerCase().includes(t.toLowerCase())),
  );

  if (!hasGlobalErrorWorkflow && highRiskNodes.length > 0) {
    issues.push({
      issueCode: "NO_GLOBAL_ERROR_WORKFLOW",
      nodeId: "__workflow__",
      nodeName: workflow.name,
      nodeType: "__workflow__",
      severity: "medium",
      title: "No global error workflow configured",
      detail: `The workflow has ${highRiskNodes.length} high-risk node(s) but no fallback error workflow is set. Unhandled errors will fail silently with no alerting.`,
      remediationHint:
        "In Workflow Settings → Error Workflow, set a notification workflow that sends an alert (Slack, email, etc.) when this workflow fails.",
    });
  }

  return issues;
}
