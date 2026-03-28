import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate, scoreBandColor, scoreBandLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusPill(status: string) {
  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
  switch (status) {
    case "runtime_done":
      return `${base} border-green/40 bg-green/10 text-green`;
    case "static_done":
      return `${base} border-amber/40 bg-amber/10 text-amber`;
    case "sandbox_running":
      return `${base} border-blue/40 bg-blue/10 text-blue`;
    case "failed":
      return `${base} border-red/40 bg-red/10 text-red`;
    default:
      return `${base} border-border-plus bg-surface-plus/40 text-muted`;
  }
}

export default async function DashboardPage() {
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

  return (
    <main className="min-h-screen grid-bg relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-surface/20 to-bg" />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between gap-6">
          <div>
            <div className="mono-tag inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)" }} />
              DASHBOARD
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Your history</h1>
            <p className="mt-2 text-muted leading-relaxed max-w-prose">
              Past verifications and shareable report links.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/verify" className="btn-primary">
              New verification
            </Link>
          </div>
        </header>

        <section className="mt-8 space-y-4">
          {records.length === 0 ? (
            <div className="glass-plus rounded-3xl border p-8">
              <div className="text-lg font-semibold">Nothing yet</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">
                Run your first Drygate verification to see results here.
              </div>
              <div className="mt-6">
                <Link href="/verify" className="btn-primary">
                  Start verification
                </Link>
              </div>
            </div>
          ) : (
            records.map((r) => (
              <div
                key={r.id}
                className="glass-plus rounded-3xl border p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-muted tracking-widest uppercase">
                      {formatDate(r.createdAt.toISOString())}
                    </div>
                    <div className="mt-2 text-lg font-semibold break-words">
                      {r.workflowName}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={statusPill(r.status)}>{String(r.status).replaceAll("_", " ")}</span>
                      <span className="mono-tag">{r.nodeCount ?? 0} nodes</span>
                      <span className="mono-tag">
                        {typeof r.simulationCoverage === "number" ? `${r.simulationCoverage}% coverage` : "coverage —"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 lg:mt-0 flex flex-col items-start lg:items-end gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted">Score</div>
                      <div
                        className="mt-1 text-2xl font-bold"
                        style={{
                          color: scoreBandColor((r.scoreband as any) ?? null),
                        }}
                      >
                        {typeof r.readinessScore === "number" ? r.readinessScore : "—"}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {scoreBandLabel((r.scoreband as any) ?? null)}
                      </div>
                    </div>

                    {r.shareToken ? (
                      <Link
                        href={`/report/${r.shareToken}`}
                        className="btn-ghost"
                      >
                        Open report
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

