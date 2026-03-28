import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await prisma.verification.findMany({
    where: { userId: "demo-user" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      shareToken: true,
      createdAt: true,
      workflowName: true,
      nodeCount: true,
      status: true,
      readinessScore: true,
      scoreband: true,
      simulationCoverage: true,
    },
  });

  return NextResponse.json({ records });
}
