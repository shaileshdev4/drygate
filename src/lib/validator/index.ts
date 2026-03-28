import { N8nWorkflow, StaticReport, Issue } from "@/types";
import { parseWorkflow } from "./parser";
import { classifyAllNodes } from "./classifier";
import { runStructureChecks } from "./checks/structure";
import { runCredentialChecks } from "./checks/credentials";
import { runErrorHandlingChecks } from "./checks/error-handling";
import { runLoopChecks, runPerformanceChecks } from "./checks/loops";
import { runProductionManifestChecks } from "@/lib/guardrails/production-manifest";

export interface ValidatorResult {
  report: StaticReport;
  workflow: N8nWorkflow; // returned for downstream use
}

export function validateWorkflow(rawJson: unknown): ValidatorResult {
  // ── Parse & validate input shape ──────────────────────────────────
  const workflow = parseAndValidateInput(rawJson);
  const graph = parseWorkflow(workflow);
  const coverage = classifyAllNodes(workflow.nodes);

  const checksRun: string[] = [];
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const allIssues: Issue[] = [];

  // Helper to run a check and record results
  function runCheck(name: string, issues: Issue[]) {
    checksRun.push(name);
    if (issues.length === 0) {
      passedChecks.push(name);
    } else {
      failedChecks.push(name);
    }
    allIssues.push(...issues);
  }

  runCheck("structure", runStructureChecks(workflow, graph));
  runCheck("credentials", runCredentialChecks(workflow));
  runCheck("production_manifest", runProductionManifestChecks(workflow));
  runCheck("error_handling", runErrorHandlingChecks(workflow));
  runCheck("loops", runLoopChecks(workflow, graph));
  runCheck("performance", runPerformanceChecks(workflow));

  const simulatableCount = coverage.filter(
    (c) => c.class === "fully_simulatable" || c.class === "mock_intercepted"
  ).length;

  const blockedCount = coverage.filter(
    (c) =>
      c.class === "credential_blocked" ||
      c.class === "destructive_blocked" ||
      c.class === "structural_only"
  ).length;

  const report: StaticReport = {
    issues: allIssues,
    coverageClassification: coverage,
    checksRun,
    passedChecks,
    failedChecks,
    totalNodes: workflow.nodes.length,
    simulatableNodeCount: simulatableCount,
    blockedNodeCount: blockedCount,
  };

  return { report, workflow };
}

function parseAndValidateInput(raw: unknown): N8nWorkflow {
  if (!raw || typeof raw !== "object") {
    throw new Error("Workflow must be a JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.nodes)) {
    throw new Error(
      'Invalid n8n workflow JSON: missing "nodes" array. Make sure you exported a workflow (not a credential or other resource) from n8n.'
    );
  }

  if (!obj.connections || typeof obj.connections !== "object") {
    throw new Error(
      'Invalid n8n workflow JSON: missing "connections" object.'
    );
  }

  // Ensure every node has required fields
  for (const node of obj.nodes as unknown[]) {
    const n = node as Record<string, unknown>;
    if (!n.id || !n.name || !n.type) {
      throw new Error(
        `Malformed node found: every node must have id, name, and type. Got: ${JSON.stringify(
          node
        ).substring(0, 100)}`
      );
    }
  }

  return {
    name: (obj.name as string) ?? "Unnamed Workflow",
    nodes: obj.nodes as N8nWorkflow["nodes"],
    connections: obj.connections as N8nWorkflow["connections"],
    settings: obj.settings as N8nWorkflow["settings"],
  };
}