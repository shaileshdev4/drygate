import { N8nNode, NodeClass, NodeCoverage } from "@/types";

// Nodes we can run as-is — no external side effects, no credentials
const FULLY_SIMULATABLE: string[] = [
  "n8n-nodes-base.set",
  "n8n-nodes-base.if",
  "n8n-nodes-base.switch",
  "n8n-nodes-base.merge",
  "n8n-nodes-base.code",
  "n8n-nodes-base.function",
  "n8n-nodes-base.functionItem",
  "n8n-nodes-base.noOp",
  "n8n-nodes-base.wait",
  "n8n-nodes-base.start",
  "n8n-nodes-base.manualTrigger",
  "n8n-nodes-base.respondToWebhook",
  "n8n-nodes-base.itemLists",
  "n8n-nodes-base.dateTime",
  "n8n-nodes-base.crypto",
  "n8n-nodes-base.splitInBatches",
  "n8n-nodes-base.aggregate",
  "n8n-nodes-base.removeDuplicates",
  "n8n-nodes-base.sort",
  "n8n-nodes-base.limit",
  "n8n-nodes-base.summarize",
  "n8n-nodes-base.compareDatasets",
];

// We intercept outbound HTTP and return mocked responses
const MOCK_INTERCEPTED: string[] = [
  "n8n-nodes-base.httpRequest",
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.scheduleTrigger",
  "n8n-nodes-base.graphql",
];

// Known destructive nodes — blocked regardless of credentials
const DESTRUCTIVE_NODE_PATTERNS: string[] = [
  "n8n-nodes-base.sendEmail",
  "n8n-nodes-base.emailSend",
  "n8n-nodes-base.gmail",
  "n8n-nodes-base.writeBinaryFile",
  "n8n-nodes-base.moveFiles",
  "n8n-nodes-base.deleteFiles",
  "n8n-nodes-base.ftp",
  "n8n-nodes-base.ssh",
  "n8n-nodes-base.executeCommand",
];

// Nodes that need credentials but aren't inherently destructive
// We block these to be safe — they MIGHT be destructive (e.g. DB writes)
const CREDENTIAL_DEPENDENT_PATTERNS: string[] = [
  "n8n-nodes-base.postgres",
  "n8n-nodes-base.mysql",
  "n8n-nodes-base.mongodb",
  "n8n-nodes-base.redis",
  "n8n-nodes-base.slack",
  "n8n-nodes-base.notion",
  "n8n-nodes-base.airtable",
  "n8n-nodes-base.googleSheets",
  "n8n-nodes-base.googleDrive",
  "n8n-nodes-base.github",
  "n8n-nodes-base.jira",
  "n8n-nodes-base.trello",
  "n8n-nodes-base.hubspot",
  "n8n-nodes-base.salesforce",
  "n8n-nodes-base.stripe",
  "n8n-nodes-base.twilio",
  "n8n-nodes-base.discord",
  "n8n-nodes-base.telegram",
];

// Structural-only — we can parse them but can't run them
const STRUCTURAL_ONLY_PATTERNS: string[] = [
  "n8n-nodes-base.executeWorkflow",
  "n8n-nodes-base.executeWorkflowTrigger",
];

export function classifyNode(node: N8nNode): NodeCoverage {
  const type = node.type.toLowerCase();

  // Destructive — always block first, before checking credentials
  if (DESTRUCTIVE_NODE_PATTERNS.some((p) => type.includes(p.toLowerCase()))) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "destructive_blocked",
      blockReason:
        "This node type can cause irreversible side effects (email, file write, shell command). Blocked unconditionally.",
    };
  }

  // Structural only
  if (STRUCTURAL_ONLY_PATTERNS.some((p) => type.includes(p.toLowerCase()))) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "structural_only",
      blockReason:
        "Sub-workflow execution requires the referenced workflow to be present in the sandbox. Static analysis only.",
    };
  }

  // If node has credentials configured — block unless it's in mock_intercepted
  const hasCreds =
    node.credentials && Object.keys(node.credentials).length > 0;

  if (
    hasCreds &&
    !MOCK_INTERCEPTED.some((p) => type.includes(p.toLowerCase()))
  ) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "credential_blocked",
      blockReason:
        "Node requires live credentials. Sandbox has no access to credential store. Blocked for safety.",
    };
  }

  // Credential-dependent by type even without creds configured
  if (
    CREDENTIAL_DEPENDENT_PATTERNS.some((p) => type.includes(p.toLowerCase()))
  ) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "credential_blocked",
      blockReason:
        "Node type typically requires credentials and may perform writes. Blocked for safety.",
    };
  }

  // Mock intercepted
  if (MOCK_INTERCEPTED.some((p) => type.includes(p.toLowerCase()))) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "mock_intercepted",
    };
  }

  // Fully simulatable
  if (FULLY_SIMULATABLE.some((p) => type.includes(p.toLowerCase()))) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      class: "fully_simulatable",
    };
  }

  // Unknown — treat as structural only (community/custom nodes)
  return {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    class: "structural_only",
    blockReason:
      "Unknown or community node type. Cannot guarantee safe execution. Static analysis only.",
  };
}

export function classifyAllNodes(nodes: N8nNode[]): NodeCoverage[] {
  return nodes.map(classifyNode);
}

export function getSimulatableClasses(): NodeClass[] {
  return ["fully_simulatable", "mock_intercepted"];
}

export function isRunnable(coverage: NodeCoverage): boolean {
  return (
    coverage.class === "fully_simulatable" ||
    coverage.class === "mock_intercepted"
  );
}