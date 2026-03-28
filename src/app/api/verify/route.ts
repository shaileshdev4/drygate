import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeScore } from "@/lib/scorer";
import { validateWorkflow } from "@/lib/validator";
import { generateRemediationPlan } from "@/lib/remediation/deterministic";
import { runSandbox } from "@/lib/sandbox/controller";
import { clearSseHistory, pushSseEvent } from "@/lib/sse/streams";
import { buildEgressPolicyIssues } from "@/lib/guardrails/egress-policy";

function broadcast(verificationId: string, event: unknown) {
  pushSseEvent(verificationId, event);
}

function broadcastStreamEnd(verificationId: string) {
  broadcast(verificationId, { type: "stream_end" });
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled =
    typeof publishableKey === "string" &&
    publishableKey.trim() !== "" &&
    !publishableKey.includes("your_key");

  const { userId } = clerkEnabled ? auth() : { userId: null as string | null };
  const effectiveUserId = userId ?? (clerkEnabled ? null : "demo-user");

  if (!effectiveUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawWorkflow =
    (body as any)?.workflow ??
    (body as any)?.workflowJson ??
    (body as any)?.data ??
    body;

  const shareToken = nanoid();

  // Create a record immediately so the SSE stream route can find it.
  const created = await prisma.verification.create({
    data: {
      shareToken,
      userId: effectiveUserId,
      workflowName: (body as any)?.name ? String((body as any).name) : "Uploaded Workflow",
      nodeCount: Array.isArray((rawWorkflow as any)?.nodes)
        ? (rawWorkflow as any).nodes.length
        : 0,
      triggerType: null,
      status: "pending",
      readinessScore: null,
      scoreband: null,
      simulationCoverage: null,
      staticReportJson: null,
      runtimeReportJson: null,
      remediationJson: null,
      pipelineError: null,
    },
  });
  const verificationId = created.id;
  clearSseHistory(verificationId);

  // Start the verification pipeline in the background.
  void (async () => {
    let workflowName = "Uploaded Workflow";
    let staticReport: any = null;
    let remediationPlan: any = null;
    let runtimeReport: any = null;
    let readinessScore: number | null = null;
    let scoreband: string | null = null;
    let sandboxFailed = false;
    let sandboxFailureMessage: string | null = null;
    const executionLog: string[] = [];

    try {
      broadcast(verificationId, {
        type: "stage_update",
        timestamp: nowIso(),
        payload: { stage: "parsing", message: "Parsing and validating workflow JSON…" },
      });

      const { report, workflow } = validateWorkflow(rawWorkflow);
      workflowName = workflow.name;
      staticReport = report;

      broadcast(verificationId, {
        type: "stage_update",
        timestamp: nowIso(),
        payload: { stage: "static_analysis", message: "Running static production checks…" },
      });

      const staticScore = computeScore({
        issues: report.issues,
        coverage: report.coverageClassification,
        runtimeReport: null,
      });
      readinessScore = staticScore.final;
      scoreband = staticScore.band;

      await prisma.verification.update({
        where: { id: verificationId },
        data: {
          workflowName,
          nodeCount: workflow.nodes.length,
          triggerType: null,
          status: "static_done",
          readinessScore,
          scoreband,
          simulationCoverage: null,
          staticReportJson: JSON.stringify(staticReport),
          runtimeReportJson: null,
          remediationJson: JSON.stringify(remediationPlan),
          pipelineError: null,
        },
      });

      broadcast(verificationId, {
        type: "static_complete",
        timestamp: nowIso(),
        payload: { status: "static_done" },
      });

      // Sandbox runtime verification.
      broadcast(verificationId, {
        type: "sandbox_start",
        timestamp: nowIso(),
        payload: { message: "Starting sandbox execution…" },
      });
      broadcast(verificationId, {
        type: "stage_update",
        timestamp: nowIso(),
        payload: { stage: "sandbox_execution", message: "Executing workflow in sandbox…" },
      });

      await prisma.verification.update({
        where: { id: verificationId },
        data: { status: "sandbox_running" },
      });

      try {
        const { runtimeReport: runtime } = await runSandbox(
          verificationId,
          workflow,
          report.coverageClassification,
          (msg) => {
            executionLog.push(msg);
            broadcast(verificationId, {
              type: "sandbox_log",
              timestamp: nowIso(),
              payload: { message: msg },
            });
          }
        );
        runtimeReport = { ...runtime, executionLog: [...executionLog] };
      } catch (sandboxErr) {
        const message =
          sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr);
        sandboxFailed = true;
        sandboxFailureMessage = message;
        const degradedLine = `Sandbox degraded mode: ${message}`;
        executionLog.push(degradedLine);
        broadcast(verificationId, {
          type: "sandbox_log",
          timestamp: nowIso(),
          payload: { message: degradedLine },
        });
        runtimeReport = {
          executionId: "unavailable",
          sandboxStartedAt: nowIso(),
          sandboxEndedAt: nowIso(),
          nodeTraces: [],
          egressInterceptions: [],
          simulationCoverage: 0,
          guardrailIssues: [],
          sandboxError: message,
          executionLog: [...executionLog],
        };
      }

      const egressIssues = buildEgressPolicyIssues(
        runtimeReport.egressInterceptions ?? []
      );
      const fuzzIssues = runtimeReport.guardrailIssues ?? [];
      const mergedIssues = [...report.issues, ...egressIssues, ...fuzzIssues];
      staticReport = {
        ...report,
        issues: mergedIssues,
      };

      const runtimeScore = computeScore({
        issues: mergedIssues,
        coverage: report.coverageClassification,
        runtimeReport: runtimeReport,
      });
      readinessScore = runtimeScore.final;
      scoreband = runtimeScore.band;

      // Generate remediation after runtime so stage ordering remains deterministic.
      broadcast(verificationId, {
        type: "stage_update",
        timestamp: nowIso(),
        payload: { stage: "remediation", message: "Generating remediation steps…" },
      });
      remediationPlan = await generateRemediationPlan(mergedIssues);

      if (sandboxFailed) {
        const message = sandboxFailureMessage ?? "Sandbox execution failed.";
        await prisma.verification.update({
          where: { id: verificationId },
          data: {
            status: "failed",
            readinessScore,
            scoreband,
            simulationCoverage: runtimeReport.simulationCoverage,
            staticReportJson: JSON.stringify(staticReport),
            runtimeReportJson: JSON.stringify(runtimeReport),
            remediationJson: JSON.stringify(remediationPlan),
            pipelineError: message,
          },
        });

        broadcast(verificationId, {
          type: "pipeline_error",
          timestamp: nowIso(),
          payload: {
            status: "failed",
            readinessScore,
            scoreband,
            staticReport,
            runtimeReport,
            remediationPlan,
            pipelineError: message,
          },
        });
      } else {
        await prisma.verification.update({
          where: { id: verificationId },
          data: {
            status: "runtime_done",
            readinessScore,
            scoreband,
            simulationCoverage: runtimeReport.simulationCoverage,
            staticReportJson: JSON.stringify(staticReport),
            runtimeReportJson: JSON.stringify(runtimeReport),
            remediationJson: JSON.stringify(remediationPlan),
            pipelineError: null,
          },
        });

        broadcast(verificationId, {
          type: "runtime_complete",
          timestamp: nowIso(),
          payload: { status: "runtime_done" },
        });

        broadcast(verificationId, {
          type: "verification_complete",
          timestamp: nowIso(),
          payload: {
            status: "runtime_done",
            readinessScore,
            scoreband,
            staticReport,
            runtimeReport,
            remediationPlan,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await prisma.verification.update({
        where: { id: verificationId },
        data: {
          status: "failed",
          pipelineError: message,
          readinessScore,
          scoreband,
          staticReportJson: staticReport ? JSON.stringify(staticReport) : null,
          runtimeReportJson: runtimeReport ? JSON.stringify(runtimeReport) : null,
          remediationJson: remediationPlan ? JSON.stringify(remediationPlan) : null,
        },
      });

      broadcast(verificationId, {
        type: "pipeline_error",
        timestamp: nowIso(),
        payload: {
          status: "failed",
          readinessScore,
          scoreband,
          staticReport,
          runtimeReport,
          remediationPlan,
          pipelineError: message,
        },
      });
    } finally {
      broadcastStreamEnd(verificationId);
    }
  })();

  return NextResponse.json({ id: verificationId, shareToken }, { status: 200 });
}

