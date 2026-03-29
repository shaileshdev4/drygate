export type IssueCategory = "security" | "reliability" | "logic" | "configuration" | "ai_agents";

export const ISSUE_CATEGORY_MAP: Record<string, IssueCategory> = {
  HARDCODED_SECRET: "security",
  CREDENTIAL_REF_INCONSISTENT: "security",
  CREDENTIAL_REF_MISSING: "security",
  WEBHOOK_NO_AUTHENTICATION: "security",
  WEBHOOK_EXPOSED_ON_PUBLIC_PATH: "security",
  AI_PROMPT_INJECTION_RISK: "security",
  UNAUTHORIZED_EGRESS_DETECTED: "security",

  MISSING_ERROR_OUTPUT: "reliability",
  NO_GLOBAL_ERROR_WORKFLOW: "reliability",
  HTTP_REQUEST_RETRY_DISABLED: "reliability",
  LOOP_NO_RATE_LIMITING: "reliability",
  SPLIT_IN_BATCHES_NO_WAIT: "reliability",
  SCHEDULE_TOO_AGGRESSIVE: "reliability",
  MISSING_ASYNC_TIMEOUT: "reliability",
  UNBOUNDED_LOOP: "reliability",
  WEBHOOK_NO_RESPONSE_HANDLING: "reliability",
  LONG_SYNCHRONOUS_WAIT: "reliability",
  LARGE_PAYLOAD_RISK: "reliability",
  NODE_ERRORED_IN_SANDBOX: "reliability",
  INPUT_CONTRACT_FAILURE: "reliability",
  BLOCKED_DESTRUCTIVE_SIDE_EFFECT: "reliability",

  EXPRESSION_NULL_REFERENCE: "logic",
  EXPRESSION_ARRAY_INDEX: "logic",
  EXPRESSION_DEAD_NODE_REFERENCE: "logic",
  EXPRESSION_MISSING_FALLBACK: "logic",
  CIRCULAR_DEPENDENCY: "logic",
  NO_INPUT_VALIDATION: "logic",
  LARGE_DATASET_NO_BATCHING: "logic",
  DESTRUCTIVE_WITH_NO_GUARD: "logic",

  MISSING_TRIGGER: "configuration",
  DISABLED_NODE_IN_PATH: "configuration",
  DISCONNECTED_NODE: "configuration",
  CREDENTIAL_NOT_IN_MANIFEST: "configuration",
  BLOCKED_UNKNOWN_NODE: "configuration",
  BLOCKED_REQUIRES_CREDENTIALS: "configuration",

  AI_AGENT_NO_SYSTEM_PROMPT: "ai_agents",
  AI_AGENT_NO_MEMORY: "ai_agents",
  AI_AGENT_NO_ERROR_HANDLING: "ai_agents",
  LLM_NO_FALLBACK_MODEL: "ai_agents",
  VECTOR_STORE_NO_VALIDATION: "ai_agents",
};

export const CATEGORY_ORDER: IssueCategory[] = [
  "security",
  "reliability",
  "logic",
  "configuration",
  "ai_agents",
];

export const CATEGORY_META: Record<
  IssueCategory,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  security: {
    label: "Security",
    color: "#f87171",
    bgColor: "rgba(240,67,110,0.08)",
    borderColor: "rgba(240,67,110,0.2)",
  },
  reliability: {
    label: "Reliability",
    color: "#f5b942",
    bgColor: "rgba(245,185,66,0.08)",
    borderColor: "rgba(245,185,66,0.2)",
  },
  logic: {
    label: "Logic",
    color: "#c084fc",
    bgColor: "rgba(192,132,252,0.08)",
    borderColor: "rgba(192,132,252,0.2)",
  },
  configuration: {
    label: "Configuration",
    color: "#42b0f5",
    bgColor: "rgba(66,176,245,0.08)",
    borderColor: "rgba(66,176,245,0.2)",
  },
  ai_agents: {
    label: "AI / Agents",
    color: "#2ecf96",
    bgColor: "rgba(46,207,150,0.08)",
    borderColor: "rgba(46,207,150,0.2)",
  },
};

export function getIssueCategory(issueCode: string): IssueCategory {
  return ISSUE_CATEGORY_MAP[issueCode] ?? "reliability";
}
