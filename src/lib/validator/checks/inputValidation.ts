import { Issue, N8nWorkflow, N8nNode } from "@/types";

const TRIGGER_TYPES = [
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-base.chatTrigger",
  "n8n-nodes-base.emailTrigger",
];

const DESTRUCTIVE_NODE_TYPES = [
  "n8n-nodes-base.gmail",
  "n8n-nodes-base.sendEmail",
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.mysql",
  "n8n-nodes-base.mongoDb",
  "n8n-nodes-base.googleSheets",
  "n8n-nodes-base.airtable",
  "n8n-nodes-base.notion",
  "n8n-nodes-base.hubspot",
  "n8n-nodes-base.salesforce",
  "n8n-nodes-base.stripe",
  "n8n-nodes-base.slack",
  "n8n-nodes-base.telegram",
  "n8n-nodes-base.twilio",
];

const LARGE_DATASET_TYPES = [
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.mysql",
  "n8n-nodes-base.mongoDb",
  "n8n-nodes-base.googleSheets",
  "n8n-nodes-base.airtable",
  "n8n-nodes-base.httpRequest",
];

const VALIDATION_NODE_TYPES = [
  "n8n-nodes-base.if",
  "n8n-nodes-base.switch",
  "n8n-nodes-base.filter",
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

function pathBetween(
  from: string,
  to: string,
  adj: Map<string, string[]>,
  nodeMap: Map<string, { type: string }>,
): string[] | null {
  const queue: Array<{ name: string; path: string[] }> = [{ name: from, path: [] }];
  const visited = new Set<string>();
  while (queue.length) {
    const { name, path } = queue.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);
    if (name === to) return path;
    for (const next of adj.get(name) ?? []) {
      const node = nodeMap.get(next);
      queue.push({ name: next, path: [...path, node?.type ?? ""] });
    }
  }
  return null;
}

function isDestructive(nodeType: string): boolean {
  return DESTRUCTIVE_NODE_TYPES.some(
    (t) =>
      nodeType === t ||
      nodeType.toLowerCase().includes(t.split(".").pop()?.toLowerCase() ?? ""),
  );
}

function isLargeDataset(nodeType: string): boolean {
  return LARGE_DATASET_TYPES.some(
    (t) =>
      nodeType === t ||
      nodeType.toLowerCase().includes(t.split(".").pop()?.toLowerCase() ?? ""),
  );
}

function hasValidationNode(path: string[]): boolean {
  return path.some((type) =>
    VALIDATION_NODE_TYPES.some(
      (v) =>
        type === v ||
        type.toLowerCase().includes(v.split(".").pop()?.toLowerCase() ?? ""),
    ),
  );
}

const HIGH_RISK_OPS = [
  "delete",
  "remove",
  "drop",
  "truncate",
  "destroy",
  "refund",
  "charge",
  "send",
];

function isHighRiskDestructiveOperation(node: N8nNode): boolean {
  if (!isDestructive(node.type)) return false;
  const params = (node.parameters ?? {}) as Record<string, unknown>;
  const op = String(params.operation ?? params.action ?? params.resource ?? "").toLowerCase();
  if (HIGH_RISK_OPS.some((k) => op.includes(k))) return true;
  if (node.type.includes("sendEmail") || node.type.includes("gmail")) return true;
  if (node.type.includes("twilio") && op.includes("send")) return true;
  return false;
}

export function runInputValidationChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  try {
    const adj = buildAdjacency(workflow);
    const typeByName = new Map(workflow.nodes.map((n) => [n.name, { type: n.type }]));

    const triggerNodes = workflow.nodes.filter(
      (n) => !isSticky(n.type) && TRIGGER_TYPES.some((t) => n.type === t),
    );

    const destructiveNodes = workflow.nodes.filter(
      (n) => !isSticky(n.type) && isDestructive(n.type),
    );

    const seenPairs = new Set<string>();

    for (const trigger of triggerNodes) {
      for (const dest of destructiveNodes) {
        const path = pathBetween(trigger.name, dest.name, adj, typeByName);
        if (path === null || hasValidationNode(path)) continue;

        const pairKey = `${trigger.id}:${dest.id}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        if (isHighRiskDestructiveOperation(dest)) {
          issues.push({
            issueCode: "DESTRUCTIVE_WITH_NO_GUARD",
            nodeId: dest.id,
            nodeName: dest.name,
            nodeType: dest.type,
            severity: "high",
            title: `"${dest.name}" performs a high-risk action with no validation after "${trigger.name}"`,
            detail: `Data flows from the external trigger to "${dest.name}" with no IF, Switch, or Filter in between. Malformed or malicious payloads can drive destructive or irreversible operations.`,
            remediationHint: `Add an IF or Switch after "${trigger.name}" to validate required fields and safe values before reaching "${dest.name}". Route invalid input to logging or a safe error response.`,
          });
        } else {
          issues.push({
            issueCode: "NO_INPUT_VALIDATION",
            nodeId: dest.id,
            nodeName: dest.name,
            nodeType: dest.type,
            severity: "high",
            title: `"${dest.name}" receives unvalidated input from "${trigger.name}"`,
            detail: `Data flows directly from the trigger to "${dest.name}" with no IF, Switch, or Filter node in between. A malformed or unexpected payload will reach this operation unguarded.`,
            remediationHint: `Add an IF node between "${trigger.name}" and "${dest.name}". Check that required fields exist and are the expected type before allowing the flow to proceed. Route invalid data to a logging/error branch.`,
          });
        }
      }
    }

    for (const node of workflow.nodes) {
      if (isSticky(node.type) || !isLargeDataset(node.type)) continue;

      const params = (node.parameters ?? {}) as Record<string, unknown>;
      const operation = String(params.operation ?? params.action ?? "");
      const returnAll = params.returnAll === true;
      const limit = params.limit;
      const isReadAll =
        operation.includes("getAll") ||
        operation.includes("fetchAll") ||
        operation.includes("list") ||
        operation.includes("search") ||
        operation === "executeQuery" ||
        operation === "" ||
        (returnAll && limit === undefined);

      if (!isReadAll) continue;

      const downstream = [...(adj.get(node.name) ?? [])];
      const hasDownstreamProcessing = downstream.some((name) => {
        const n = workflow.nodes.find((x) => x.name === name);
        return n && !isSticky(n.type) && (isDestructive(n.type) || n.type.includes("httpRequest"));
      });

      const hasBatchingNode = downstream.some((name) => {
        const n = workflow.nodes.find((x) => x.name === name);
        return (
          n &&
          (n.type === "n8n-nodes-base.splitInBatches" || n.type === "n8n-nodes-base.loopOverItems")
        );
      });

      if (hasDownstreamProcessing && !hasBatchingNode) {
        issues.push({
          issueCode: "LARGE_DATASET_NO_BATCHING",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `"${node.name}" may return large dataset without batching`,
          detail: `This node retrieves all records and feeds them directly into downstream processing nodes. With large datasets, this loads everything into memory at once, risks hitting n8n's execution memory limit, and can cause timeouts.`,
          remediationHint: `Add a "Split In Batches" node after "${node.name}" with a batch size of 10-50 items. Add a Wait node inside the loop to prevent rate limit issues on downstream API calls.`,
        });
      }
    }
  } catch {
    return [];
  }

  return issues;
}
