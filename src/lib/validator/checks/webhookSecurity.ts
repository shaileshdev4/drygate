import { Issue, N8nWorkflow } from "@/types";

const WEBHOOK_TRIGGER_TYPES = [
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-base.chatTrigger",
];

const SENSITIVE_NODE_TYPES = [
  "n8n-nodes-base.gmail",
  "n8n-nodes-base.sendEmail",
  "n8n-nodes-base.slack",
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.mysql",
  "n8n-nodes-base.googleSheets",
  "n8n-nodes-base.airtable",
  "n8n-nodes-base.notion",
  "n8n-nodes-base.hubspot",
  "n8n-nodes-base.stripe",
  "n8n-nodes-base.httpRequest",
];

function isSticky(nodeType: string): boolean {
  return nodeType === "n8n-nodes-base.stickyNote";
}

function buildAdjacency(workflow: N8nWorkflow): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    if (!isSticky(node.type)) adj.set(node.name, []);
  }
  for (const [src, outputs] of Object.entries(workflow.connections)) {
    if (!adj.has(src)) continue;
    for (const [type, branches] of Object.entries(outputs)) {
      if (type.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          if (!conn?.node || !adj.has(conn.node)) continue;
          const list = adj.get(src) ?? [];
          list.push(conn.node);
          adj.set(src, list);
        }
      }
    }
  }
  return adj;
}

function reachable(start: string, adj: Map<string, string[]>, maxHops: number): Set<string> {
  const visited = new Set<string>();
  const queue: Array<{ name: string; hops: number }> = [{ name: start, hops: 0 }];
  while (queue.length) {
    const { name, hops } = queue.shift()!;
    if (visited.has(name) || hops > maxHops) continue;
    visited.add(name);
    for (const next of adj.get(name) ?? []) {
      queue.push({ name: next, hops: hops + 1 });
    }
  }
  return visited;
}

function isSensitive(nodeType: string): boolean {
  return SENSITIVE_NODE_TYPES.some(
    (t) =>
      nodeType === t ||
      nodeType.toLowerCase().includes(t.split(".").pop()?.toLowerCase() ?? ""),
  );
}

function hasRespondToWebhook(workflow: N8nWorkflow): boolean {
  return workflow.nodes.some((n) => n.type === "n8n-nodes-base.respondToWebhook");
}

export function runWebhookSecurityChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  try {
    const adj = buildAdjacency(workflow);
    const nodeMap = new Map(workflow.nodes.map((n) => [n.name, n]));

    for (const node of workflow.nodes) {
      if (isSticky(node.type)) continue;
      if (!WEBHOOK_TRIGGER_TYPES.includes(node.type)) continue;

      const params = (node.parameters ?? {}) as Record<string, unknown>;

      const authValue = String(params.authentication ?? "none").toLowerCase();
      const hasNoAuth =
        authValue === "none" ||
        authValue === "" ||
        params.authentication === undefined;

      if (hasNoAuth) {
        const downstream = reachable(node.name, adj, 8);
        const sensitiveNames = Array.from(downstream)
          .map((name) => nodeMap.get(name))
          .filter((n) => n && !isSticky(n.type) && isSensitive(n.type))
          .map((n) => n!.name);

        const hasSensitiveDownstream = sensitiveNames.length > 0;

        issues.push({
          issueCode: "WEBHOOK_NO_AUTHENTICATION",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: hasSensitiveDownstream ? "high" : "medium",
          title: `Webhook "${node.name}" has no authentication`,
          detail: hasSensitiveDownstream
            ? `This webhook endpoint has no authentication and connects to sensitive operations (${sensitiveNames.slice(0, 2).join(", ")}). Any caller who knows this URL can trigger these operations.`
            : `This webhook endpoint has no authentication. Any caller who knows the URL can trigger this workflow.`,
          remediationHint: `Open the Webhook node → Authentication. Set to "Header Auth" for API-to-API calls, or "Basic Auth" for simple use cases. Configure your caller to include the credential in every request.`,
        });
      }

      const responseMode = String(params.responseMode ?? "");
      const isWaitingMode = responseMode === "responseNode" || responseMode === "lastNode";

      if (isWaitingMode && !hasRespondToWebhook(workflow)) {
        issues.push({
          issueCode: "WEBHOOK_NO_RESPONSE_HANDLING",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `Webhook response mode set but no Respond To Webhook node exists`,
          detail: `"${node.name}" is configured to respond via a "Respond to Webhook" node, but no such node exists in the workflow. The caller will hang waiting for a response that never arrives, then time out.`,
          remediationHint: `Add a "Respond to Webhook" node at the end of the workflow path. Configure it to return the appropriate response body and status code.`,
        });
      }

      const path = String(params.path ?? "");
      const isGuessable =
        path.length > 0 &&
        (path.length < 8 ||
          /^(test|demo|webhook|api|trigger|hook|n8n)$/i.test(path) ||
          /^[a-z]+$/i.test(path));

      if (isGuessable) {
        issues.push({
          issueCode: "WEBHOOK_EXPOSED_ON_PUBLIC_PATH",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "low",
          title: `Webhook "${node.name}" uses a predictable URL path`,
          detail: `The webhook path "${path}" is short or guessable. Combined with weak or no authentication, this makes the endpoint easier to discover. n8n generates random UUIDs by default — a manually set simple path removes this protection.`,
          remediationHint: `Either add authentication, or change the path to a long random string (e.g., a UUID). Never use paths like "test", "webhook", or "trigger".`,
        });
      }
    }
  } catch {
    return [];
  }

  return issues;
}
