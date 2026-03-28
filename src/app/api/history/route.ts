import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled =
    typeof publishableKey === "string" &&
    publishableKey.trim() !== "" &&
    !publishableKey.includes("your_key");

  const { userId } = clerkEnabled
    ? (await import("@clerk/nextjs/server")).auth()
    : { userId: null as string | null };
  const effectiveUserId = userId ?? (clerkEnabled ? null : "demo-user");

  if (!effectiveUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await prisma.verification.findMany({
    where: { userId: effectiveUserId },
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