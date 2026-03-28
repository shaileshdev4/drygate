import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  const record = await prisma.verification.findUnique({
    where: { shareToken: params.shareToken },
  });

  if (!record) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: record.id,
    shareToken: record.shareToken,
    createdAt: record.createdAt.toISOString(),
    workflowName: record.workflowName,
    nodeCount: record.nodeCount,
    status: record.status,
    readinessScore: record.readinessScore,
    scoreband: record.scoreband,
    simulationCoverage: record.simulationCoverage,
    staticReport: record.staticReportJson
      ? JSON.parse(record.staticReportJson)
      : null,
    runtimeReport: record.runtimeReportJson
      ? JSON.parse(record.runtimeReportJson)
      : null,
    remediationPlan: record.remediationJson
      ? JSON.parse(record.remediationJson)
      : null,
    pipelineError: record.pipelineError,
  });
}