import { Issue, N8nNode } from "@/types";

const CODES_WORTH_AI_FIXING = new Set<string>([
  "EXPRESSION_NULL_REFERENCE",
  "EXPRESSION_ARRAY_INDEX",
  "EXPRESSION_DEAD_NODE_REFERENCE",
  "EXPRESSION_MISSING_FALLBACK",
  "HARDCODED_SECRET",
  "CREDENTIAL_REF_INCONSISTENT",
  "LOOP_NO_RATE_LIMITING",
  "MISSING_ERROR_OUTPUT",
  "AI_AGENT_NO_SYSTEM_PROMPT",
  "WEBHOOK_NO_AUTHENTICATION",
]);

const MAX_AI_SUGGESTIONS = 5;

function buildNodeSummary(node: N8nNode): string {
  const params = (node.parameters ?? {}) as Record<string, unknown>;
  const safeFields: Record<string, unknown> = {};

  if (params.url) {
    const url = String(params.url);
    safeFields.url = url.replace(
      /([?&](key|token|secret|password|api_key)=)[^&]*/gi,
      "$1[REDACTED]",
    );
  }
  if (params.authentication !== undefined) safeFields.authentication = params.authentication;
  if (params.method !== undefined) safeFields.method = params.method;
  if (params.operation !== undefined) safeFields.operation = params.operation;
  if (params.resource !== undefined) safeFields.resource = params.resource;

  let allParams = "";
  try {
    allParams = JSON.stringify(params);
  } catch {
    allParams = "";
  }
  const expressions = allParams.match(/\{\{[^}]+\}\}/g)?.slice(0, 5) ?? [];
  if (expressions.length > 0) safeFields.expressions = expressions;

  try {
    return JSON.stringify(safeFields, null, 2);
  } catch {
    return "{}";
  }
}

function buildPrompt(issue: Issue, node: N8nNode | undefined): string {
  const nodeContext = node
    ? `
Node name: ${node.name}
Node type: ${node.type}
Relevant parameters:
${buildNodeSummary(node)}`
    : `Node: ${issue.nodeName} (type: ${issue.nodeType})`;

  return `You are an n8n workflow expert. A production readiness check found this issue:

Issue code: ${issue.issueCode}
Severity: ${issue.severity}
Problem: ${issue.title}
Detail: ${issue.detail}

${nodeContext}

Provide a SPECIFIC, ACTIONABLE fix for THIS exact node configuration.
Do not give generic advice. Look at the actual parameters and expressions above 
and tell the user exactly what to change.

Respond in this exact JSON format with no other text:
{
  "specificFix": "One clear sentence describing exactly what to change in this specific node",
  "exampleCode": "Optional: show before/after if relevant, e.g. {{ $json.user.email }} → {{ $json.user?.email ?? '' }}. Omit if not applicable."
}

Keep specificFix under 150 characters. Keep exampleCode under 200 characters.
If exampleCode is not applicable, set it to null.`;
}

export async function generateAiFixSuggestions(
  issues: Issue[],
  nodes: Map<string, N8nNode>,
): Promise<Issue[]> {
  const targetIssues = issues
    .filter(
      (i) =>
        (i.severity === "high" || i.severity === "critical") &&
        CODES_WORTH_AI_FIXING.has(i.issueCode),
    )
    .slice(0, MAX_AI_SUGGESTIONS);

  if (targetIssues.length === 0) return issues;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return issues;

  const results = await Promise.allSettled(
    targetIssues.map(async (issue) => {
      const node = nodes.get(issue.nodeId) ?? nodes.get(issue.nodeName);
      const prompt = buildPrompt(issue, node);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      const text =
        data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
      const clean = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(clean) as {
        specificFix: string;
        exampleCode: string | null;
      };

      return { issueId: issue.nodeId + issue.issueCode, suggestion: parsed };
    }),
  );

  const suggestionMap = new Map<
    string,
    { specificFix: string; exampleCode: string | null }
  >();

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      suggestionMap.set(result.value.issueId, result.value.suggestion);
    }
  }

  return issues.map((issue) => {
    const key = issue.nodeId + issue.issueCode;
    const suggestion = suggestionMap.get(key);
    if (!suggestion) return issue;
    return {
      ...issue,
      aiSuggestion: {
        specificFix: suggestion.specificFix,
        exampleCode: suggestion.exampleCode ?? undefined,
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
