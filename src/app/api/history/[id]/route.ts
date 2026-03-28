import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEMO_USER = "demo-user";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const result = await prisma.verification.deleteMany({
    where: { id, userId: DEMO_USER },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
