import { Issue, NodeCoverage, RuntimeReport, ScoreBand, ScoreBreakdown } from "@/types";

interface ScoringInput {
  issues: Issue[];
  coverage: NodeCoverage[];
  runtimeReport: RuntimeReport | null;
}

// Per-severity deduction amounts
const DEDUCTIONS: Record<string, number> = {
  // Static issue deductions
  MISSING_TRIGGER: 25,
  HARDCODED_SECRET: 20,
  CIRCULAR_DEPENDENCY: 20,
  DISABLED_NODE_IN_PATH: 12,
  MISSING_ERROR_OUTPUT: 8,
  CREDENTIAL_REF_MISSING: 8,
  CREDENTIAL_REF_INCONSISTENT: 8,
  UNBOUNDED_LOOP: 15,
  DISCONNECTED_NODE: 5,
  NO_GLOBAL_ERROR_WORKFLOW: 10,
  LONG_SYNCHRONOUS_WAIT: 5,
  LARGE_PAYLOAD_RISK: 3,
  MISSING_ASYNC_TIMEOUT: 15,
  CREDENTIAL_NOT_IN_MANIFEST: 12,
  UNAUTHORIZED_EGRESS_DETECTED: 40,
  INPUT_CONTRACT_FAILURE: 25,
  // Runtime deductions
  NODE_ERRORED_IN_SANDBOX: 15,
  // expression analysis
  EXPRESSION_DEAD_NODE_REFERENCE: 20,
  EXPRESSION_NULL_REFERENCE: 8,
  EXPRESSION_ARRAY_INDEX: 8,
  EXPRESSION_MISSING_FALLBACK: 3,
  // AI / LangChain
  AI_AGENT_NO_ERROR_HANDLING: 12,
  AI_AGENT_NO_SYSTEM_PROMPT: 8,
  AI_AGENT_NO_MEMORY: 5,
  LLM_NO_FALLBACK_MODEL: 5,
  VECTOR_STORE_NO_VALIDATION: 8,
  WEBHOOK_NO_AUTHENTICATION: 12,
  WEBHOOK_NO_RESPONSE_HANDLING: 8,
  WEBHOOK_EXPOSED_ON_PUBLIC_PATH: 5,
  AI_PROMPT_INJECTION_RISK: 20,
  HTTP_REQUEST_RETRY_DISABLED: 8,
  LOOP_NO_RATE_LIMITING: 18,
  SPLIT_IN_BATCHES_NO_WAIT: 15,
  SCHEDULE_TOO_AGGRESSIVE: 5,
  NO_INPUT_VALIDATION: 15,
  LARGE_DATASET_NO_BATCHING: 10,
  DESTRUCTIVE_WITH_NO_GUARD: 18,
};

// Maximum total deduction per issue CODE (prevents one repeated issue from zeroing score)
const MAX_DEDUCTION_PER_CODE: Partial<Record<string, number>> = {
  DISCONNECTED_NODE: 20,
  MISSING_ERROR_OUTPUT: 24,
  LARGE_PAYLOAD_RISK: 9,
  NODE_ERRORED_IN_SANDBOX: 30,
  INPUT_CONTRACT_FAILURE: 50,
  EXPRESSION_DEAD_NODE_REFERENCE: 40,
  EXPRESSION_NULL_REFERENCE: 16,
  EXPRESSION_ARRAY_INDEX: 16,
  EXPRESSION_MISSING_FALLBACK: 6,
  WEBHOOK_NO_AUTHENTICATION: 24,
  WEBHOOK_NO_RESPONSE_HANDLING: 16,
  WEBHOOK_EXPOSED_ON_PUBLIC_PATH: 5,
  AI_PROMPT_INJECTION_RISK: 40,
  LOOP_NO_RATE_LIMITING: 36,
  SPLIT_IN_BATCHES_NO_WAIT: 30,
  HTTP_REQUEST_RETRY_DISABLED: 16,
  SCHEDULE_TOO_AGGRESSIVE: 5,
  NO_INPUT_VALIDATION: 30,
  LARGE_DATASET_NO_BATCHING: 20,
  DESTRUCTIVE_WITH_NO_GUARD: 36,
};

// Fail-closed codes: if any of these are present, score is capped at 40
export const FAIL_CLOSED_ISSUE_CODES = new Set([
  "MISSING_TRIGGER",
  "HARDCODED_SECRET",
  "CIRCULAR_DEPENDENCY",
  "UNAUTHORIZED_EGRESS_DETECTED",
]);

export function hasFailClosedIssue(issues: { issueCode: string }[]): boolean {
  return issues.some((i) => FAIL_CLOSED_ISSUE_CODES.has(i.issueCode));
}

function getBand(score: number): ScoreBand {
  if (score >= 85) return "production_ready";
  if (score >= 65) return "needs_minor_fixes";
  if (score >= 40) return "significant_issues";
  return "not_ready";
}

export function computeScore(input: ScoringInput): ScoreBreakdown {
  const deductions: ScoreBreakdown["deductions"] = [];
  const codeAccumulator = new Map<string, number>();

  // ── Static issue deductions ──────────────────────────────────────
  for (const issue of input.issues) {
    const baseAmount = DEDUCTIONS[issue.issueCode] ?? 5;
    const maxForCode = MAX_DEDUCTION_PER_CODE[issue.issueCode] ?? Infinity;
    const alreadyDeducted = codeAccumulator.get(issue.issueCode) ?? 0;

    if (alreadyDeducted >= maxForCode) continue;

    const actualAmount = Math.min(baseAmount, maxForCode - alreadyDeducted);
    codeAccumulator.set(issue.issueCode, alreadyDeducted + actualAmount);

    deductions.push({
      reason: `${issue.issueCode} on node "${issue.nodeName}"`,
      amount: actualAmount,
      issueCode: issue.issueCode,
    });
  }

  // ── Runtime deductions ───────────────────────────────────────────
  if (input.runtimeReport) {
    const erroredNodes = input.runtimeReport.nodeTraces.filter((t) => t.status === "error");
    for (const trace of erroredNodes) {
      const code = "NODE_ERRORED_IN_SANDBOX";
      const baseAmount = DEDUCTIONS[code];
      const maxForCode = MAX_DEDUCTION_PER_CODE[code] ?? Infinity;
      const alreadyDeducted = codeAccumulator.get(code) ?? 0;

      if (alreadyDeducted >= maxForCode) continue;

      const actualAmount = Math.min(baseAmount, maxForCode - alreadyDeducted);
      codeAccumulator.set(code, alreadyDeducted + actualAmount);

      deductions.push({
        reason: `Node "${trace.nodeName}" errored in sandbox: ${trace.errorMessage?.substring(0, 60) ?? "unknown error"}`,
        amount: actualAmount,
        issueCode: "NODE_ERRORED_IN_SANDBOX",
      });
    }
  }

  // ── Over-blocked penalty ────────────────────────────────────────
  // If >60% of nodes are blocked, we can't trust the score - soft fail
  const total = input.coverage.length;
  const blocked = input.coverage.filter(
    (c) =>
      c.class === "credential_blocked" ||
      c.class === "destructive_blocked" ||
      c.class === "structural_only",
  ).length;

  const blockedRatio = total > 0 ? blocked / total : 0;
  if (blockedRatio > 0.6) {
    deductions.push({
      reason: `${Math.round(blockedRatio * 100)}% of nodes could not be verified (blocked). Score reliability is low.`,
      amount: 10,
    });
  }

  // ── Sum up ───────────────────────────────────────────────────────
  const totalDeduction = deductions.reduce((acc, d) => acc + d.amount, 0);

  // Cap total deductions at 90 — minimum meaningful score is 10.
  // Prevents >100 deductions collapsing to 0 on issue-heavy workflows.
  const cappedDeduction = Math.min(90, totalDeduction);
  let rawScore = Math.max(10, 100 - cappedDeduction);

  // ── Fail-closed check ────────────────────────────────────────────
  const failClosedIssue = input.issues.find((i) => FAIL_CLOSED_ISSUE_CODES.has(i.issueCode));
  let failClosedTriggered = false;
  let failClosedReason: string | undefined;

  // Fail-closed caps score at 40 regardless of arithmetic.
  if (failClosedIssue) {
    failClosedTriggered = true;
    failClosedReason = `Score capped at 40: fail-closed rule triggered by ${failClosedIssue.issueCode}. This class of issue makes a workflow fundamentally unsafe for production regardless of other scores.`;
    rawScore = Math.min(rawScore, 40);
  }

  return {
    base: 100,
    deductions,
    failClosedTriggered,
    failClosedReason,
    final: rawScore,
    band: getBand(rawScore),
  };
}
