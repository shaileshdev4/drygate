import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const record = await prisma.verification.findUnique({
    where: { id: params.id },
  });

  if (!record) {
    return NextResponse.json({ error: "Verification not found" }, { status: 404 });
  }

  const isTerminal = record.status === "runtime_done" || record.status === "failed";

  return NextResponse.json(
    {
      id: record.id,
      status: record.status,
      terminal: isTerminal,
      readinessScore: record.readinessScore,
      scoreband: record.scoreband,
      pipelineError: record.pipelineError,
      workflow: record.workflowJson ? JSON.parse(record.workflowJson) : null,
      staticReport: record.staticReportJson ? JSON.parse(record.staticReportJson) : null,
      runtimeReport: record.runtimeReportJson ? JSON.parse(record.runtimeReportJson) : null,
      remediationPlan: record.remediationJson ? JSON.parse(record.remediationJson) : null,
    },
    { status: 200 },
  );
}
