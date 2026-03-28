import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    port: process.env.PORT ?? "(defaulting to 3000)",
    env_vars: {
      DATABASE_URL:    process.env.DATABASE_URL  ? "set" : "MISSING",
      DIRECT_URL:      process.env.DIRECT_URL    ? "set" : "MISSING",
      SANDBOX_N8N_URL: process.env.SANDBOX_N8N_URL || "(not set — sandbox disabled)",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "(not set)",
    },
  };

  let dbStatus: "ok" | "error" = "ok";
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : String(err);
  }

  checks.database = { status: dbStatus, error: dbError };

  const allOk = dbStatus === "ok";
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
