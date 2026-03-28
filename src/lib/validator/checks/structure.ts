import { N8nWorkflow, Issue } from "@/types";
import { WorkflowGraph, reachableFrom, hasCycle, isTriggerNode } from "../parser";

/** n8n Sticky Notes are annotations only: no wires, no execution - not a defect. */
function isStickyNoteNode(nodeType: string): boolean {
  return nodeType.toLowerCase() === "n8n-nodes-base.stickynote";
}

export function runStructureChecks(workflow: N8nWorkflow, graph: WorkflowGraph): Issue[] {
  const issues: Issue[] = [];

  // ── 1. Missing trigger ──────────────────────────────────────────────
  if (graph.triggerNodes.length === 0) {
    issues.push({
      issueCode: "MISSING_TRIGGER",
      nodeId: "__workflow__",
      nodeName: workflow.name,
      nodeType: "__workflow__",
      severity: "critical",
      title: "No trigger node found",
      detail:
        "This workflow has no trigger. Without a trigger (Webhook, Schedule, Manual, etc.) the workflow can never be executed in production.",
      remediationHint:
        "Add a trigger node as the entry point. For APIs use Webhook. For timed jobs use Schedule Trigger.",
    });
  }

  // ── 2. Disconnected nodes ───────────────────────────────────────────
  // Any node with no upstream AND no downstream connections (except triggers)
  for (const node of workflow.nodes) {
    if (isTriggerNode(node.type)) continue;
    if (isStickyNoteNode(node.type)) continue;
    if (node.disabled) continue;

    const hasUpstream = (graph.reverseAdjacency.get(node.name)?.size ?? 0) > 0;
    const hasDownstream = (graph.adjacency.get(node.name)?.size ?? 0) > 0;

    if (!hasUpstream && !hasDownstream) {
      issues.push({
        issueCode: "DISCONNECTED_NODE",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "medium",
        title: `Node "${node.name}" is disconnected`,
        detail:
          "This node has no incoming or outgoing connections. It will never execute and adds confusion to the workflow.",
        remediationHint:
          "Connect this node into the workflow or remove it. Orphaned nodes are a maintenance risk.",
      });
    }
  }

  // ── 3. Nodes unreachable from any trigger ───────────────────────────
  if (graph.triggerNodes.length > 0) {
    const reachable = new Set<string>();
    for (const trigger of graph.triggerNodes) {
      reachableFrom(trigger.name, graph.adjacency).forEach((name) => {
        reachable.add(name);
      });
    }

    for (const node of workflow.nodes) {
      if (isTriggerNode(node.type)) continue;
      if (isStickyNoteNode(node.type)) continue;
      if (node.disabled) continue;
      if (reachable.has(node.name)) continue;

      const hasUpstream = (graph.reverseAdjacency.get(node.name)?.size ?? 0) > 0;
      const hasDownstream = (graph.adjacency.get(node.name)?.size ?? 0) > 0;

      // Fully disconnected (no in, no out) is already one DISCONNECTED_NODE in §2.
      // Unreachable-from-trigger is implied; do not emit a second issue for the same node.
      if (!hasUpstream && !hasDownstream) continue;

      if (hasUpstream) {
        // Subgraph not reachable from trigger but this node has a parent - same as before:
        // do not duplicate many issues along the chain.
        continue;
      }

      issues.push({
        issueCode: "DISCONNECTED_NODE",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "medium",
        title: `Node "${node.name}" is unreachable from any trigger`,
        detail:
          "This node cannot be reached from any trigger node. It will never execute in production.",
        remediationHint:
          "Trace back the connection chain from this node and ensure it connects to an active trigger.",
      });
    }
  }

  // ── 4. Circular dependencies ────────────────────────────────────────
  if (hasCycle(graph.adjacency)) {
    issues.push({
      issueCode: "CIRCULAR_DEPENDENCY",
      nodeId: "__workflow__",
      nodeName: workflow.name,
      nodeType: "__workflow__",
      severity: "high",
      title: "Circular dependency detected in workflow",
      detail:
        "The workflow contains a cycle - a path that loops back to a node already in the execution chain. Without a proper exit condition this will run indefinitely.",
      remediationHint:
        "Add an IF node with an explicit exit condition before any back-edge connection. n8n's Split In Batches node is the correct pattern for controlled looping.",
    });
  }

  // ── 5. Disabled nodes in the critical path ──────────────────────────
  for (const node of workflow.nodes) {
    if (!node.disabled) continue;
    if (isStickyNoteNode(node.type)) continue;

    const hasUpstream = (graph.reverseAdjacency.get(node.name)?.size ?? 0) > 0;
    const hasDownstream = (graph.adjacency.get(node.name)?.size ?? 0) > 0;

    if (hasUpstream && hasDownstream) {
      issues.push({
        issueCode: "DISABLED_NODE_IN_PATH",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "high",
        title: `Disabled node "${node.name}" is in the middle of a path`,
        detail:
          "This node is disabled but sits between connected nodes. Data flow will be broken at this point in production.",
        remediationHint:
          "Either re-enable this node, remove it and reconnect the path, or use n8n's NoOp node as a placeholder.",
      });
    }
  }

  // Deduplicate by issueCode + nodeId - a node that is fully disconnected will
  // sometimes also appear in the unreachable check; keep the first occurrence only.
  const seen = new Set<string>();
  const deduped = issues.filter((issue) => {
    const key = `${issue.issueCode}:${issue.nodeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped;
}
