import { N8nWorkflow, Issue } from "@/types";
import { WorkflowGraph, hasCycle } from "../parser";

export function runLoopChecks(workflow: N8nWorkflow, graph: WorkflowGraph): Issue[] {
  const issues: Issue[] = [];

  // ── Unbounded loop detection ────────────────────────────────────────
  // We already catch cycles in structure checks. Here we look specifically
  // for SplitInBatches nodes without a downstream completion branch.
  for (const node of workflow.nodes) {
    if (
      !node.type.toLowerCase().includes("splitinbatches") &&
      !node.type.toLowerCase().includes("loopoveritems")
    )
      continue;

    const downstreamNames = graph.adjacency.get(node.name) ?? new Set();

    // SplitInBatches has two outputs: [0] = loop body, [1] = done
    // If there's only one downstream or zero, the "done" path is missing
    if (downstreamNames.size < 2) {
      issues.push({
        issueCode: "UNBOUNDED_LOOP",
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        severity: "high",
        title: `Loop node "${node.name}" may be missing its completion branch`,
        detail: `Split In Batches / Loop Over Items has two outputs: output 0 (loop body) and output 1 (done). Only ${downstreamNames.size} output(s) are connected. If the "done" branch is not connected, downstream processing after the loop will never trigger.`,
        remediationHint:
          "Connect output 1 (the 'done' port) of this node to the next step that should run after all batches complete.",
      });
    }
  }

  return issues;
}

export function runPerformanceChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];

  for (const node of workflow.nodes) {
    // ── Long synchronous waits ─────────────────────────────────────────
    if (node.type === "n8n-nodes-base.wait") {
      const amount = node.parameters?.amount as number | undefined;
      const unit = node.parameters?.unit as string | undefined;

      let waitSeconds = 0;
      if (amount && unit) {
        if (unit === "seconds") waitSeconds = amount;
        else if (unit === "minutes") waitSeconds = amount * 60;
        else if (unit === "hours") waitSeconds = amount * 3600;
        else if (unit === "days") waitSeconds = amount * 86400;
      }

      if (waitSeconds > 60) {
        issues.push({
          issueCode: "LONG_SYNCHRONOUS_WAIT",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `Wait node "${node.name}" pauses execution for ${Math.round(waitSeconds / 60)} minute(s)`,
          detail: `Long waits keep the execution record open and consume n8n worker resources. Waits over 60 seconds in production can cause timeout issues depending on your n8n deployment configuration.`,
          remediationHint:
            "For long delays, consider using n8n's webhook-resume pattern instead: emit an event and resume via an incoming webhook rather than holding the execution open.",
        });
      }
    }

    // ── HTTP Request with no timeout ──────────────────────────────────
    if (node.type === "n8n-nodes-base.httpRequest") {
      const opts = node.parameters?.options as Record<string, unknown> | undefined;
      const hasTimeout =
        (opts && opts.timeout !== undefined && opts.timeout !== "") ||
        (node.parameters as Record<string, unknown> | undefined)?.timeout !== undefined;

      if (!hasTimeout) {
        issues.push({
          issueCode: "MISSING_ASYNC_TIMEOUT",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "high",
          title: `HTTP Request "${node.name}" has no timeout configured`,
          detail:
            "Without a timeout, a slow or unresponsive external API can stall this execution and exhaust n8n workers.",
          remediationHint:
            "In HTTP Request → Options, set a timeout (e.g. 10000–30000 ms) appropriate for the upstream SLA.",
        });
      }
    }

    // ── Wait node: webhook/form resume holds execution until external event ──
    if (node.type === "n8n-nodes-base.wait") {
      const resume = node.parameters?.resume as string | undefined;
      if (resume === "webhook" || resume === "form") {
        issues.push({
          issueCode: "MISSING_ASYNC_TIMEOUT",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "low",
          title: `Wait "${node.name}" resumes on webhook/form (long-lived execution)`,
          detail:
            "Executions can remain open until an external callback arrives - a common source of 'zombie' runs under load.",
          remediationHint:
            "Ensure global execution timeouts and monitoring are set; prefer bounded patterns where possible.",
        });
      }
    }
  }

  return issues;
}
