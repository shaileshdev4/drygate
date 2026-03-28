import { N8nWorkflow, N8nNode, N8nConnections } from "@/types";

export interface WorkflowGraph {
  nodes: Map<string, N8nNode>;           // keyed by node name (n8n uses names in connections)
  nodeById: Map<string, N8nNode>;        // keyed by node id
  adjacency: Map<string, Set<string>>;   // name → set of downstream node names
  reverseAdjacency: Map<string, Set<string>>; // name → set of upstream node names
  triggerNodes: N8nNode[];
  allNodeNames: string[];
}

export function parseWorkflow(workflow: N8nWorkflow): WorkflowGraph {
  const nodes = new Map<string, N8nNode>();
  const nodeById = new Map<string, N8nNode>();
  const adjacency = new Map<string, Set<string>>();
  const reverseAdjacency = new Map<string, Set<string>>();

  // Index all nodes
  for (const node of workflow.nodes) {
    nodes.set(node.name, node);
    nodeById.set(node.id, node);
    adjacency.set(node.name, new Set());
    reverseAdjacency.set(node.name, new Set());
  }

  // Build adjacency from connections
  buildAdjacency(workflow.connections, adjacency, reverseAdjacency);

  // Find trigger nodes
  const triggerNodes = workflow.nodes.filter((n) => isTriggerNode(n.type));

  return {
    nodes,
    nodeById,
    adjacency,
    reverseAdjacency,
    triggerNodes,
    allNodeNames: workflow.nodes.map((n) => n.name),
  };
}

function buildAdjacency(
  connections: N8nConnections,
  adjacency: Map<string, Set<string>>,
  reverseAdjacency: Map<string, Set<string>>
) {
  for (const [sourceName, outputTypes] of Object.entries(connections)) {
    for (const [, targets] of Object.entries(outputTypes)) {
      for (const targetGroup of targets) {
        for (const target of targetGroup) {
          if (!adjacency.has(sourceName)) adjacency.set(sourceName, new Set());
          if (!reverseAdjacency.has(target.node))
            reverseAdjacency.set(target.node, new Set());

          adjacency.get(sourceName)!.add(target.node);
          reverseAdjacency.get(target.node)!.add(sourceName);
        }
      }
    }
  }
}

export function isTriggerNode(nodeType: string): boolean {
  const triggerTypes = [
    "n8n-nodes-base.webhook",
    "n8n-nodes-base.scheduleTrigger",
    "n8n-nodes-base.manualTrigger",
    "n8n-nodes-base.emailTrigger",
    "n8n-nodes-base.cron",
    "n8n-nodes-base.interval",
    "n8n-nodes-base.start",
    "@n8n/n8n-nodes-langchain.chatTrigger",
  ];
  return (
    triggerTypes.includes(nodeType) ||
    nodeType.toLowerCase().includes("trigger")
  );
}

/**
 * Find all nodes reachable from the given start node (BFS)
 */
export function reachableFrom(
  startName: string,
  adjacency: Map<string, Set<string>>
): Set<string> {
  const visited = new Set<string>();
  const queue = [startName];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) queue.push(neighbor);
    });
  }
  return visited;
}

/**
 * Detect cycles using DFS. Returns true if a cycle exists.
 */
export function hasCycle(adjacency: Map<string, Set<string>>): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    stack.add(node);
    const neighbors = adjacency.get(node);
    if (!neighbors) {
      stack.delete(node);
      return false;
    }

    let found = false;
    neighbors.forEach((neighbor) => {
      if (found) return;
      if (!visited.has(neighbor) && dfs(neighbor)) {
        found = true;
        return;
      }
      if (stack.has(neighbor)) {
        found = true;
      }
    });

    if (found) return true;
    stack.delete(node);
    return false;
  }

  let found = false;
  adjacency.forEach((_neighbors, node) => {
    if (found) return;
    if (!visited.has(node) && dfs(node)) {
      found = true;
    }
  });
  return found;
}