// ─────────────────────────────────────────────
// n8n Workflow shape (subset we care about)
// ─────────────────────────────────────────────

export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  settings?: Record<string, unknown>;
  staticData?: unknown;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string; // e.g. "n8n-nodes-base.httpRequest"
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  continueOnFail?: boolean;
  disabled?: boolean;
  notes?: string;
}

export type N8nConnections = {
  [sourceNodeName: string]: {
    [outputType: string]: Array<Array<{ node: string; type: string; index: number }>>;
  };
};

// ─────────────────────────────────────────────
// Node classification
// ─────────────────────────────────────────────

export type NodeClass =
  | "fully_simulatable" // Set, IF, Switch, Merge, Code(JS), NoOp, Function, Wait
  | "mock_intercepted" // HTTP Request, GraphQL, Webhook trigger
  | "credential_blocked" // Gmail, Slack, Postgres, any node with credentials
  | "destructive_blocked" // Send Email, Write Binary File, DELETE ops
  | "structural_only"; // Execute Workflow, custom/community nodes

export interface NodeCoverage {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  class: NodeClass;
  blockReason?: string;
}

// ─────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export type IssueCode =
  // structural
  | "MISSING_TRIGGER"
  | "DISCONNECTED_NODE"
  | "CIRCULAR_DEPENDENCY"
  | "DISABLED_NODE_IN_PATH"
  // credentials
  | "HARDCODED_SECRET"
  | "CREDENTIAL_REF_MISSING"
  | "CREDENTIAL_REF_INCONSISTENT"
  // error handling
  | "MISSING_ERROR_OUTPUT"
  | "NO_GLOBAL_ERROR_WORKFLOW"
  // loops
  | "UNBOUNDED_LOOP"
  // performance
  | "LONG_SYNCHRONOUS_WAIT"
  | "LARGE_PAYLOAD_RISK"
  | "MISSING_ASYNC_TIMEOUT"
  // production guardrails (manifest / egress / contract)
  | "CREDENTIAL_NOT_IN_MANIFEST"
  | "UNAUTHORIZED_EGRESS_DETECTED"
  | "INPUT_CONTRACT_FAILURE"
  // runtime (set by sandbox)
  | "NODE_ERRORED_IN_SANDBOX"
  | "BLOCKED_REQUIRES_CREDENTIALS"
  | "BLOCKED_DESTRUCTIVE_SIDE_EFFECT"
  | "BLOCKED_UNKNOWN_NODE";

export interface Issue {
  issueCode: IssueCode;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  remediationHint: string;
  // for hardcoded secrets - the field path, not the value
  fieldPath?: string;
}

// ─────────────────────────────────────────────
// Static report
// ─────────────────────────────────────────────

export interface StaticReport {
  issues: Issue[];
  coverageClassification: NodeCoverage[];
  checksRun: string[];
  passedChecks: string[];
  failedChecks: string[];
  totalNodes: number;
  simulatableNodeCount: number;
  blockedNodeCount: number;
}

// ─────────────────────────────────────────────
// Runtime / sandbox
// ─────────────────────────────────────────────

export type NodeTraceStatus = "success" | "error" | "blocked" | "skipped";

export interface NodeTrace {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: NodeTraceStatus;
  durationMs: number;
  inputSummary: unknown;
  outputSummary: unknown;
  errorMessage: string | null;
}

export interface EgressLog {
  timestamp: string;
  method: string;
  url: string;
  statusReturned: number;
  interceptType: "mocked" | "destructive_blocked" | "passthrough";
  nodeNameHint?: string;
}

export interface RuntimeReport {
  executionId: string;
  sandboxStartedAt: string;
  sandboxEndedAt: string;
  nodeTraces: NodeTrace[];
  egressInterceptions: EgressLog[];
  simulationCoverage: number; // 0–100
  sandboxError?: string;
  /** Issues from input fuzzing or other sandbox-side guardrails (merged into scoring). */
  guardrailIssues?: Issue[];
  /** Sandbox controller log lines (replayed over SSE when the client connects after completion). */
  executionLog?: string[];
}

// ─────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────

export type ScoreBand =
  | "production_ready" // 85–100
  | "needs_minor_fixes" // 65–84
  | "significant_issues" // 40–64
  | "not_ready"; // 0–39

export interface ScoreBreakdown {
  base: 100;
  deductions: Array<{ reason: string; amount: number; issueCode?: IssueCode }>;
  failClosedTriggered: boolean;
  failClosedReason?: string;
  final: number;
  band: ScoreBand;
}

// ─────────────────────────────────────────────
// Remediation
// ─────────────────────────────────────────────

export type EffortEstimate = "minutes" | "hours" | "days";

export interface RemediationItem {
  issueCode: IssueCode;
  nodeId: string;
  nodeName: string;
  priority: number; // 1 = most urgent
  title: string;
  steps: string[];
  estimatedEffort: EffortEstimate;
}

export interface RemediationPlan {
  items: RemediationItem[];
  generatedBy: "deterministic" | "ai_enhanced";
}

// ─────────────────────────────────────────────
// Full verification record
// ─────────────────────────────────────────────

export type VerificationStatus =
  | "pending"
  | "static_done"
  | "sandbox_running"
  | "runtime_done"
  | "failed";

export interface VerificationRecord {
  id: string;
  shareToken: string;
  createdAt: string;
  workflowName: string;
  nodeCount: number;
  triggerType: string | null;
  status: VerificationStatus;
  readinessScore: number | null;
  scoreband: ScoreBand | null;
  simulationCoverage: number | null;
  staticReport: StaticReport | null;
  runtimeReport: RuntimeReport | null;
  remediationPlan: RemediationPlan | null;
  scoreBreakdown: ScoreBreakdown | null;
  pipelineError: string | null;
}

// ─────────────────────────────────────────────
// SSE event shapes (streamed to frontend)
// ─────────────────────────────────────────────

export type SSEEventType =
  | "stage_update"
  | "static_complete"
  | "sandbox_start"
  | "sandbox_log"
  | "runtime_complete"
  | "remediation_complete"
  | "verification_complete"
  | "pipeline_error";

export interface SSEEvent {
  type: SSEEventType;
  timestamp: string;
  payload: unknown;
}

export interface StageUpdatePayload {
  stage: "parsing" | "static_analysis" | "sandbox_execution" | "remediation";
  message: string;
}
