import { Issue, N8nWorkflow } from "@/types";

const INPUT_TRIGGER_TYPES = [
  "n8n-nodes-base.webhook",
  "n8n-nodes-base.formTrigger",
  "n8n-nodes-base.chatTrigger",
  "n8n-nodes-base.telegramTrigger",
  "n8n-nodes-base.whatsAppTrigger",
];

const LLM_CONSUMER_TYPES = [
  "@n8n/n8n-nodes-langchain.agent",
  "@n8n/n8n-nodes-langchain.chainLlm",
  "@n8n/n8n-nodes-langchain.chainSummarization",
  "@n8n/n8n-nodes-langchain.openAi",
  "n8n-nodes-base.openAi",
];

const RAW_INPUT_PATTERNS = [
  /\$json\.(?:message|text|body|content|input|query|prompt|data|payload)/i,
  /\$input\.(?:all|first|last|item)/i,
  /\{\{\s*\$json\s*\}\}/,
  /\$\('.*'\)\.first\(\)\.json\.(?:message|text)/i,
];

const SANITIZATION_PATTERNS = [/sanitize/i, /escape/i, /strip/i, /clean/i, /validate/i, /replace.*</i];

function expressionHasRawInput(expr: string): boolean {
  return RAW_INPUT_PATTERNS.some((p) => p.test(expr));
}

function expressionHasSanitization(expr: string): boolean {
  return SANITIZATION_PATTERNS.some((p) => p.test(expr));
}

function allStringValues(obj: unknown): string[] {
  if (typeof obj === "string") return [obj];
  if (Array.isArray(obj)) return obj.flatMap(allStringValues);
  if (obj && typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).flatMap(allStringValues);
  }
  return [];
}

function isStickyType(nodeType: string): boolean {
  return nodeType === "n8n-nodes-base.stickyNote";
}

export function checkAiPromptInjection(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];
  try {
    const hasInputTrigger = workflow.nodes.some(
      (n) => !isStickyType(n.type) && INPUT_TRIGGER_TYPES.some((t) => n.type === t),
    );

    if (!hasInputTrigger) return issues;

    const llmNodes = workflow.nodes.filter(
      (n) =>
        !isStickyType(n.type) &&
        LLM_CONSUMER_TYPES.some(
          (t) =>
            n.type === t ||
            n.type.toLowerCase().includes(t.split(".").pop()?.toLowerCase() ?? ""),
        ),
    );

    for (const node of llmNodes) {
      const params = (node.parameters ?? {}) as Record<string, unknown>;
      const allValues = allStringValues(params);

      const riskyValues = allValues.filter((v) => {
        const expressions = v.match(/\{\{([\s\S]+?)\}\}/g) ?? [];
        return expressions.some(
          (expr) => expressionHasRawInput(expr) && !expressionHasSanitization(expr),
        );
      });

      if (riskyValues.length > 0) {
        const example = riskyValues[0].slice(0, 120);

        issues.push({
          issueCode: "AI_PROMPT_INJECTION_RISK",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "high",
          title: `"${node.name}" passes unsanitized user input to LLM prompt`,
          detail: `This AI node embeds raw user input directly into its prompt without sanitization. An attacker can send "Ignore all previous instructions" or similar payloads to hijack the agent's behavior. Example: ${example}`,
          remediationHint: `Add a Code node before this AI node to sanitize user input. Remove prompt injection patterns: strip instructions prefixed with "Ignore", "Disregard", "Forget", "You are now". Limit input length. Never pass $json directly into system prompts — extract only the specific field you need.`,
        });
      }
    }
  } catch {
    return [];
  }

  return issues;
}

// Node type patterns for AI node detection
const AI_AGENT_TYPES = [
  "@n8n/n8n-nodes-langchain.agent",
  "n8n-nodes-base.agent",
  "@n8n/n8n-nodes-langchain.chainLlm",
  "@n8n/n8n-nodes-langchain.chainSummarization",
];

const LLM_TYPES = [
  "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  "@n8n/n8n-nodes-langchain.lmChatAnthropic",
  "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
  "@n8n/n8n-nodes-langchain.lmChatOllama",
  "@n8n/n8n-nodes-langchain.lmOpenAi",
  "@n8n/n8n-nodes-langchain.openAi",
];

const MEMORY_TYPES = [
  "@n8n/n8n-nodes-langchain.memoryBufferWindow",
  "@n8n/n8n-nodes-langchain.memoryMotorhead",
  "@n8n/n8n-nodes-langchain.memoryPostgresChat",
  "@n8n/n8n-nodes-langchain.memoryRedisChat",
  "@n8n/n8n-nodes-langchain.memorySqlite",
  "@n8n/n8n-nodes-langchain.memoryXata",
];

const VECTOR_STORE_TYPES = [
  "@n8n/n8n-nodes-langchain.vectorStoreInMemory",
  "@n8n/n8n-nodes-langchain.vectorStorePinecone",
  "@n8n/n8n-nodes-langchain.vectorStoreQdrant",
  "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
  "@n8n/n8n-nodes-langchain.vectorStoreWeaviate",
];

function isType(nodeType: string, types: string[]): boolean {
  return types.some(
    (t) =>
      nodeType.toLowerCase().includes(t.toLowerCase()) ||
      t.toLowerCase().includes(nodeType.split(".").pop()?.toLowerCase() ?? ""),
  );
}

// Helper: get types of all directly downstream nodes
function getDownstreamNodeTypes(nodeName: string, workflow: N8nWorkflow): string[] {
  const types: string[] = [];
  const outputs = workflow.connections[nodeName];
  if (!outputs) return types;
  for (const branches of Object.values(outputs)) {
    for (const branch of branches) {
      for (const conn of branch) {
        const target = workflow.nodes.find((n) => n.name === conn.node);
        if (target) types.push(target.type);
      }
    }
  }
  return types;
}

/** Match n8n IF / Switch / Error Trigger by type leaf — avoids false positives (e.g. "certificate"). */
function typeSuggestsBranching(nodeType: string): boolean {
  const leaf = nodeType.split(".").pop()?.toLowerCase() ?? "";
  return leaf === "if" || leaf.startsWith("switch") || leaf.includes("errortrigger");
}

// Get all sub-node connections for a given node (AI nodes use sub-node connections)
function getConnectedSubNodeTypes(nodeName: string, workflow: N8nWorkflow): string[] {
  const connected: string[] = [];
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    if (sourceName === nodeName) continue;
    for (const [outputType, branches] of Object.entries(outputs)) {
      if (!outputType.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          if (conn.node === nodeName) {
            const sourceNode = workflow.nodes.find((n) => n.name === sourceName);
            if (sourceNode) connected.push(sourceNode.type);
          }
        }
      }
    }
  }
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    if (sourceName !== nodeName) continue;
    for (const [outputType, branches] of Object.entries(outputs)) {
      if (!outputType.startsWith("ai_")) continue;
      for (const branch of branches) {
        for (const conn of branch) {
          const targetNode = workflow.nodes.find((n) => n.name === conn.node);
          if (targetNode) connected.push(targetNode.type);
        }
      }
    }
  }
  return connected;
}

/** True when the node's error output has at least one connection. */
function hasErrorOutput(nodeName: string, workflow: N8nWorkflow): boolean {
  const outputs = workflow.connections[nodeName];
  if (!outputs) return false;
  const errorBranches = outputs.error;
  if (!Array.isArray(errorBranches)) return false;
  return errorBranches.some(
    (branch) => Array.isArray(branch) && branch.some((c) => c && typeof c.node === "string"),
  );
}

function hasContinueOnFail(node: { parameters?: Record<string, unknown>; continueOnFail?: boolean }): boolean {
  return node.continueOnFail === true;
}

export function runAiChecks(workflow: N8nWorkflow): Issue[] {
  const issues: Issue[] = [];

  for (const node of workflow.nodes) {
    // ── Check 1: AI Agent has no system prompt ──
    if (isType(node.type, AI_AGENT_TYPES)) {
      const params = node.parameters as Record<string, unknown>;
      const optionsSys =
        typeof (params?.options as Record<string, unknown>)?.systemMessage === "string"
          ? String((params.options as Record<string, unknown>).systemMessage).trim().length > 0
          : false;
      const hasSystemPrompt =
        (typeof params?.systemMessage === "string" && params.systemMessage.trim().length > 0) ||
        (typeof params?.prompt === "string" && params.prompt.trim().length > 0) ||
        optionsSys;

      if (!hasSystemPrompt) {
        issues.push({
          issueCode: "AI_AGENT_NO_SYSTEM_PROMPT",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "medium",
          title: `AI Agent "${node.name}" has no system prompt`,
          detail: `Without a system prompt, the AI agent uses default model behavior. In production this produces inconsistent, often unhelpful responses. Every agent needs explicit instructions defining its role, constraints, and output format.`,
          remediationHint: `Open the AI Agent node and add a system prompt. Define what the agent should do, what format to respond in, and what it should NOT do.`,
        });
      }

      // ── Check 2: AI Agent has no memory ──
      const connectedSubNodeTypes = getConnectedSubNodeTypes(node.name, workflow);
      const hasMemory = connectedSubNodeTypes.some((t) => isType(t, MEMORY_TYPES));

      if (!hasMemory) {
        const workflowNameLower = workflow.name?.toLowerCase() ?? "";
        const isConversational =
          workflowNameLower.includes("chat") ||
          workflowNameLower.includes("assistant") ||
          workflowNameLower.includes("bot") ||
          workflowNameLower.includes("conversation") ||
          workflow.nodes.some(
            (n) =>
              n.type.includes("chatTrigger") ||
              n.type.includes("telegramTrigger") ||
              n.type.includes("whatsApp"),
          );

        if (isConversational) {
          issues.push({
            issueCode: "AI_AGENT_NO_MEMORY",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "medium",
            title: `Conversational AI Agent "${node.name}" has no memory`,
            detail: `This looks like a conversational workflow but the AI Agent has no memory sub-node attached. Without memory, each message is processed in isolation — the agent has no context of previous turns, making multi-turn conversations impossible.`,
            remediationHint: `Add a Window Buffer Memory node (or Postgres/Redis Chat Memory for persistence) as a sub-node to the AI Agent.`,
          });
        }
      }

      // ── Check 3: AI Agent has no error handling ──
      if (!hasContinueOnFail(node) && !hasErrorOutput(node.name, workflow)) {
        issues.push({
          issueCode: "AI_AGENT_NO_ERROR_HANDLING",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "high",
          title: `AI Agent "${node.name}" has no error handling`,
          detail: `LLM API calls fail in production. Rate limits, quota exhaustion, model timeouts, and provider outages are common. Without an error branch, a single LLM failure silently kills the entire workflow with no notification and no retry.`,
          remediationHint: `Enable "Continue On Fail" in the node settings, or connect the error output to a notification node (Slack, email) and optionally a retry mechanism.`,
        });
      }
    }

    // ── Check 4: Single LLM node with no fallback routing ──
    if (isType(node.type, LLM_TYPES)) {
      const downstreamNodes = getDownstreamNodeTypes(node.name, workflow);
      const hasFallbackRouting = downstreamNodes.some((t) => typeSuggestsBranching(t));

      if (!hasFallbackRouting && !hasContinueOnFail(node)) {
        issues.push({
          issueCode: "LLM_NO_FALLBACK_MODEL",
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          severity: "low",
          title: `LLM node "${node.name}" has no fallback on failure`,
          detail: `This LLM node has no error routing or fallback. If this provider is down or rate-limited, the workflow will fail with no recovery path.`,
          remediationHint: `Enable "Continue On Fail" and add an IF node to check for errors, then route to a fallback model or notification.`,
        });
      }
    }

    // ── Check 5: Vector store retrieve with no validation ──
    if (isType(node.type, VECTOR_STORE_TYPES)) {
      const params = node.parameters as Record<string, unknown>;
      const isRetrieval =
        String(params?.mode ?? "").toLowerCase().includes("retrieve") ||
        String(params?.operation ?? "").toLowerCase().includes("retrieve") ||
        String(params?.operation ?? "").toLowerCase().includes("search");

      if (isRetrieval) {
        const downstreamNodes = getDownstreamNodeTypes(node.name, workflow);
        const hasValidation = downstreamNodes.some((t) => typeSuggestsBranching(t));

        if (!hasValidation) {
          issues.push({
            issueCode: "VECTOR_STORE_NO_VALIDATION",
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            severity: "medium",
            title: `Vector store "${node.name}" retrieval has no empty-result check`,
            detail: `Vector store retrievals can return zero results if the query doesn't match anything in the index. Without a downstream check, empty results propagate silently and cause downstream nodes to process null data.`,
            remediationHint: `Add an IF node after the vector store to check if results array length > 0. Route the false branch to a fallback response.`,
          });
        }
      }
    }
  }

  issues.push(...checkAiPromptInjection(workflow));

  return issues;
}
