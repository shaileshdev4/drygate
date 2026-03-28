import {
    Issue,
    NodeCoverage,
    RuntimeReport,
    ScoreBand,
    ScoreBreakdown,
  } from "@/types";
  
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
  };
  
  // Maximum total deduction per issue CODE (prevents one repeated issue from zeroing score)
  const MAX_DEDUCTION_PER_CODE: Partial<Record<string, number>> = {
    DISCONNECTED_NODE: 20,
    MISSING_ERROR_OUTPUT: 24,
    LARGE_PAYLOAD_RISK: 9,
    NODE_ERRORED_IN_SANDBOX: 30,
    INPUT_CONTRACT_FAILURE: 50,
  };
  
  // Fail-closed codes: if any of these are present, score is capped at 40
  const FAIL_CLOSED_CODES = new Set([
    "MISSING_TRIGGER",
    "HARDCODED_SECRET",
    "CIRCULAR_DEPENDENCY",
    "UNAUTHORIZED_EGRESS_DETECTED",
  ]);
  
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
      const erroredNodes = input.runtimeReport.nodeTraces.filter(
        (t) => t.status === "error"
      );
      for (const trace of erroredNodes) {
        const code = "NODE_ERRORED_IN_SANDBOX";
        const baseAmount = DEDUCTIONS[code];
        const maxForCode = MAX_DEDUCTION_PER_CODE[code] ?? Infinity;
        const alreadyDeducted = codeAccumulator.get(code) ?? 0;
  
        if (alreadyDeducted >= maxForCode) continue;
  
        const actualAmount = Math.min(
          baseAmount,
          maxForCode - alreadyDeducted
        );
        codeAccumulator.set(code, alreadyDeducted + actualAmount);
  
        deductions.push({
          reason: `Node "${trace.nodeName}" errored in sandbox: ${trace.errorMessage?.substring(0, 60) ?? "unknown error"}`,
          amount: actualAmount,
          issueCode: "NODE_ERRORED_IN_SANDBOX",
        });
      }
    }
  
    // ── Over-blocked penalty ────────────────────────────────────────
    // If >60% of nodes are blocked, we can't trust the score — soft fail
    const total = input.coverage.length;
    const blocked = input.coverage.filter(
      (c) =>
        c.class === "credential_blocked" ||
        c.class === "destructive_blocked" ||
        c.class === "structural_only"
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
    let rawScore = Math.max(0, 100 - totalDeduction);
  
    // ── Fail-closed check ────────────────────────────────────────────
    const failClosedIssue = input.issues.find((i) =>
      FAIL_CLOSED_CODES.has(i.issueCode)
    );
    let failClosedTriggered = false;
    let failClosedReason: string | undefined;
  
    if (failClosedIssue && rawScore > 40) {
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