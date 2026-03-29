import { N8nWorkflow, ComplexityReport, ComplexityRating } from "@/types";

const BRANCH_NODE_TYPES = [
  "n8n-nodes-base.if",
  "n8n-nodes-base.switch",
  "n8n-nodes-base.filter",
];

const LOOP_NODE_TYPES = [
  "n8n-nodes-base.splitInBatches",
  "n8n-nodes-base.loopOverItems",
  "n8n-nodes-base.itemLists",
];

const SUBWORKFLOW_NODE_TYPES = [
  "n8n-nodes-base.executeWorkflow",
  "n8n-nodes-base.executeWorkflowTrigger",
];

function isSticky(type: string): boolean {
  return type === "n8n-nodes-base.stickyNote" || type.toLowerCase() === "n8n-nodes-base.stickynote";
}

function buildAdj(workflow: N8nWorkflow): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of workflow.nodes) {
    if (!isSticky(n.type)) adj.set(n.name, []);
  }
  for (const [src, outputs] of Object.entries(workflow.connections)) {
    if (!adj.has(src)) continue;
    for (const [type, branches] of Object.entries(outputs)) {
      if (type.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          if (!adj.has(conn.node)) continue;
          const list = adj.get(src) ?? [];
          list.push(conn.node);
          adj.set(src, list);
        }
      }
    }
  }
  return adj;
}

function longestPath(workflow: N8nWorkflow, adj: Map<string, string[]>): number {
  const triggerNodes = workflow.nodes.filter(
    (n) =>
      !isSticky(n.type) &&
      (n.type.includes("Trigger") ||
        n.type.includes("trigger") ||
        n.type === "n8n-nodes-base.manualTrigger"),
  );

  let maxDepth = 0;

  function dfs(nodeName: string, depth: number, visited: Set<string>): void {
    if (visited.has(nodeName) || !adj.has(nodeName)) return;
    visited.add(nodeName);
    maxDepth = Math.max(maxDepth, depth);
    for (const next of adj.get(nodeName) ?? []) {
      dfs(next, depth + 1, new Set(visited));
    }
  }

  for (const trigger of triggerNodes) {
    if (adj.has(trigger.name)) dfs(trigger.name, 0, new Set());
  }

  return maxDepth;
}

export function computeComplexity(workflow: N8nWorkflow): ComplexityReport {
  const adj = buildAdj(workflow);

  const realNodes = workflow.nodes.filter((n) => !isSticky(n.type));

  const nodeCount = realNodes.length;
  const branchCount = realNodes.filter((n) =>
    BRANCH_NODE_TYPES.some((t) => n.type === t),
  ).length;
  const loopCount = realNodes.filter((n) => LOOP_NODE_TYPES.some((t) => n.type === t)).length;
  const subWorkflowCount = realNodes.filter((n) =>
    SUBWORKFLOW_NODE_TYPES.some((t) => n.type === t),
  ).length;
  const maxDepth = longestPath(workflow, adj);

  let score = 0;
  const reasons: string[] = [];

  const nodeScore = Math.min(35, (nodeCount / 40) * 35);
  score += nodeScore;
  if (nodeCount > 25) reasons.push(`${nodeCount} nodes — consider splitting into sub-workflows`);
  else if (nodeCount > 15) reasons.push(`${nodeCount} nodes — approaching complex territory`);

  const branchScore = Math.min(25, (branchCount / 8) * 25);
  score += branchScore;
  if (branchCount > 5) reasons.push(`${branchCount} conditional branches — high decision complexity`);
  else if (branchCount > 3) reasons.push(`${branchCount} conditional branches`);

  const loopScore = Math.min(20, (loopCount / 4) * 20);
  score += loopScore;
  if (loopCount > 2) reasons.push(`${loopCount} loop nodes — potential performance risk`);
  else if (loopCount > 0) reasons.push(`${loopCount} loop node${loopCount > 1 ? "s" : ""}`);

  const depthScore = Math.min(10, (maxDepth / 20) * 10);
  score += depthScore;
  if (maxDepth > 15) reasons.push(`Execution depth of ${maxDepth} — long chains are hard to debug`);

  const subScore = Math.min(10, subWorkflowCount * 3);
  score += subScore;
  if (subWorkflowCount > 0) {
    reasons.push(`${subWorkflowCount} sub-workflow call${subWorkflowCount > 1 ? "s" : ""}`);
  }

  const roundedScore = Math.round(score);

  let rating: ComplexityRating;
  if (roundedScore < 25) rating = "low";
  else if (roundedScore < 50) rating = "medium";
  else if (roundedScore < 75) rating = "high";
  else rating = "very_high";

  if (reasons.length === 0) reasons.push("Well within maintainability limits");

  return {
    rating,
    score: roundedScore,
    nodeCount,
    branchCount,
    loopCount,
    maxDepth,
    subWorkflowCount,
    reasons,
  };
}
