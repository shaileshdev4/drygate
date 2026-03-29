import { Issue, N8nWorkflow, N8nNode } from "@/types";

const EXTERNAL_CALL_TYPES = [
  "n8n-nodes-base.httpRequest",
  "n8n-nodes-base.gmail",
  "n8n-nodes-base.slack",
  "n8n-nodes-base.hubspot",
  "n8n-nodes-base.salesforce",
  "n8n-nodes-base.notion",
  "n8n-nodes-base.airtable",
  "n8n-nodes-base.googleSheets",
  "n8n-nodes-base.sendEmail",
  "n8n-nodes-base.telegram",
  "n8n-nodes-base.discord",
  "n8n-nodes-base.openAi",
  "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  "@n8n/n8n-nodes-langchain.lmChatAnthropic",
];

const LOOP_NODE_TYPES = [
  "n8n-nodes-base.splitInBatches",
  "n8n-nodes-base.loopOverItems",
  "n8n-nodes-base.itemLists",
];

const WAIT_NODE_TYPES = ["n8n-nodes-base.wait", "n8n-nodes-base.noOp"];

const SCHEDULE_TRIGGER_TYPES = ["n8n-nodes-base.scheduleTrigger", "n8n-nodes-base.cron"];

function isSticky(nodeType: string): boolean {
  return nodeType === "n8n-nodes-base.stickyNote";
}

function isExternalCall(nodeType: string): boolean {
  return EXTERNAL_CALL_TYPES.some(
    (t) =>
      nodeType === t ||
      nodeType.toLowerCase().includes(t.split(".").pop()?.toLowerCase() ?? ""),
  );
}

function isLoopNode(nodeType: string): boolean {
  return LOOP_NODE_TYPES.some((t) => nodeType === t);
}

function isWaitNode(nodeType: string): boolean {
  return WAIT_NODE_TYPES.some((t) => nodeType === t);
}

function buildAdjacency(workflow: N8nWorkflow): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    if (!isSticky(node.type)) adj.set(node.name, []);
  }
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    if (!adj.has(sourceName)) continue;
    for (const [outputType, branches] of Object.entries(outputs)) {
      if (outputType.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          if (!conn?.node || !adj.has(conn.node)) continue;
          const existing = adj.get(sourceName) ?? [];
          existing.push(conn.node);
          adj.set(sourceName, existing);
        }
      }
    }
  }
  return adj;
}

function bfsNodes(start: string, adj: Map<string, string[]>, maxHops: number): string[] {
  const visited = new Set<string>();
  const queue: Array<{ name: string; depth: number }> = [{ name: start, depth: 0 }];
  while (queue.length > 0) {
    const { name, depth } = queue.shift()!;
    if (visited.has(name) || depth > maxHops) continue;
    visited.add(name);
    for (const neighbor of adj.get(name) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push({ name: neighbor, depth: depth + 1 });
      }
    }
  }
  visited.delete(start);
  return Array.from(visited);
}

export function runRateLimitingChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  try {
    const adj = buildAdjacency(workflow);
    const nodeMap = new Map(workflow.nodes.map((n) => [n.name, n]));

    for (const node of workflow.nodes) {
      if (isSticky(node.type)) continue;

      if (isLoopNode(node.type)) {
        const downstream = bfsNodes(node.name, adj, 3);
        const hasExternalCall = downstream.some((name) => {
          const n = nodeMap.get(name);
          return n && !isSticky(n.type) && isExternalCall(n.type);
        });
        const hasWait = downstream.some((name) => {
          const n = nodeMap.get(name);
          return n && isWaitNode(n.type);
        });

        if (hasExternalCall && !hasWait) {
          const externalCallNode = downstream
            .map((n) => nodeMap.get(n))
            .find((n) => n && isExternalCall(n.type));

          issues.push({
            issueCode: "LOOP_NO_RATE_LIMITING",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "high",
            title: `Loop "${node.name}" calls external API with no rate limiting`,
            detail: `This loop feeds items into "${externalCallNode?.name ?? "an API call"}" with no Wait node between iterations. At scale this will trigger 429 rate limit errors, potentially banning the API account. This is the most common cause of production workflow failure.`,
            remediationHint: `Add a Wait node between the loop body and the API call. Set wait time to match the API's rate limit — typically 1000ms for most SaaS APIs. For HubSpot: 100ms. For Slack: 1000ms. For OpenAI: depends on tier.`,
          });
        }
      }

      if (node.type === "n8n-nodes-base.splitInBatches") {
        const directChildren = adj.get(node.name) ?? [];
        const directExternalCalls = directChildren.filter((name) => {
          const n = nodeMap.get(name);
          return n && !isSticky(n.type) && isExternalCall(n.type);
        });
        const hasWaitDirectly = directChildren.some((name) => {
          const n = nodeMap.get(name);
          return n && isWaitNode(n.type);
        });

        if (directExternalCalls.length > 0 && !hasWaitDirectly) {
          const first = nodeMap.get(directExternalCalls[0]);
          issues.push({
            issueCode: "SPLIT_IN_BATCHES_NO_WAIT",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "high",
            title: `Split In Batches directly feeds API calls with no Wait`,
            detail: `"${node.name}" sends each batch directly to "${first?.name ?? directExternalCalls[0]}" with no Wait node. Each batch will fire immediately, producing a burst of requests that will trigger rate limit errors.`,
            remediationHint: `Insert a Wait node between "${node.name}" and the API call node. A 1-2 second wait between batches prevents rate limit errors on most APIs.`,
          });
        }
      }

      if (node.type === "n8n-nodes-base.httpRequest") {
        const params = (node.parameters ?? {}) as Record<string, unknown>;
        const options = params.options as Record<string, unknown> | undefined;
        const nodeAny = node as N8nNode & { retryOnFail?: boolean };
        const retryEnabled =
          options?.retryOnFail === true || nodeAny.retryOnFail === true;

        if (!retryEnabled) {
          const url = String(params.url ?? "");
          const isExpressionOrUnknown = url.startsWith("{{") || url.trim() === "";
          const isInternal =
            url.includes("localhost") ||
            url.includes("127.0.0.1") ||
            url.includes(".internal");

          if (!isExpressionOrUnknown && !isInternal) {
            issues.push({
              issueCode: "HTTP_REQUEST_RETRY_DISABLED",
              nodeId: node.id,
              nodeName: node.name,
              nodeType: node.type,
              severity: "medium",
              title: `HTTP Request "${node.name}" has no retry logic`,
              detail: `Retry on fail is disabled. Transient failures — network timeouts, 503s, momentary rate limits — will immediately fail the workflow instead of retrying. In production, most transient failures resolve on the second or third attempt.`,
              remediationHint: `Open the node → Settings → enable "Retry On Fail". Set max retries to 3 and wait between tries to 1000ms minimum. For APIs that return 429, set wait to match their retry-after window.`,
            });
          }
        }
      }

      if (SCHEDULE_TRIGGER_TYPES.some((t) => node.type === t)) {
        const params = (node.parameters ?? {}) as Record<string, unknown>;
        const rule = params.rule as Record<string, unknown> | undefined;
        const triggerTimes = params.triggerTimes as Record<string, unknown> | undefined;
        const item0 = Array.isArray(triggerTimes?.item) ? (triggerTimes.item as unknown[])[0] : undefined;
        const secondVal =
          item0 && typeof item0 === "object" && item0 !== null
            ? (item0 as Record<string, unknown>).second
            : undefined;
        const interval = Number(params.interval ?? secondVal ?? 0);
        const cronExpression = String(params.cronExpression ?? rule?.cronExpression ?? "");
        const isAggressive =
          (Number.isFinite(interval) && interval > 0 && interval < 30) ||
          cronExpression.trim().split(/\s+/).filter(Boolean).length === 6;

        if (isAggressive) {
          issues.push({
            issueCode: "SCHEDULE_TOO_AGGRESSIVE",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "low",
            title: `Schedule trigger may fire too frequently`,
            detail: `"${node.name}" is configured to trigger at a very high frequency. If this workflow makes external API calls, it will quickly exhaust rate limits. Consider whether this frequency is genuinely needed or is a configuration mistake.`,
            remediationHint: `Verify the trigger interval is intentional. If polling, consider using webhooks instead — they push events in real time without polling overhead.`,
          });
        }
      }
    }
  } catch {
    return [];
  }

  return issues;
}
