"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { scoreBandLabel } from "@/lib/utils";

type StatusFilter = "all" | "runtime_done" | "failed";

interface VerificationRow {
  id: string;
  shareToken: string | null;
  createdAt: string;
  workflowName: string | null;
  nodeCount: number | null;
  status: string;
  readinessScore: number | null;
  scoreband: string | null;
  simulationCoverage: number | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-muted)";
  if (score >= 85) return "var(--jade)";
  if (score >= 65) return "var(--violet-light)";
  if (score >= 40) return "var(--amber)";
  return "var(--rose)";
}

function scoreBg(score: number | null): string {
  if (score === null) return "rgba(255,255,255,0.04)";
  if (score >= 85) return "var(--jade-dim)";
  if (score >= 65) return "var(--violet-dim)";
  if (score >= 40) return "var(--amber-dim)";
  return "var(--rose-dim)";
}

function relativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    runtime_done:   { label: "Completed",    color: "var(--jade-light)",  bg: "var(--jade-dim)",   border: "rgba(46,207,150,0.3)"  },
    static_done:    { label: "Static only",  color: "var(--amber)",       bg: "var(--amber-dim)",  border: "rgba(245,185,66,0.3)"  },
    sandbox_running:{ label: "Running",      color: "var(--sky)",         bg: "var(--sky-dim)",    border: "rgba(66,176,245,0.3)"  },
    failed:         { label: "Failed",       color: "var(--rose-light)",  bg: "var(--rose-dim)",   border: "rgba(240,67,110,0.3)"  },
  };
  const s = map[status] ?? { label: status.replaceAll("_", " "), color: "var(--text-muted)", bg: "rgba(255,255,255,0.04)", border: "var(--border)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        fontFamily: "var(--font-data)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.color,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const [records, setRecords]     = useState<VerificationRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => {
        const rows = Array.isArray(d) ? d : Array.isArray(d?.records) ? d.records : [];
        // Normalize createdAt to ISO string
        setRecords(rows.map((row: any) => ({ ...row, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = records.filter((r) => {
    if (filter === "all") return true;
    if (filter === "runtime_done") return r.status === "runtime_done";
    if (filter === "failed") return r.status === "failed";
    return true;
  });

  // Group by date label
  const grouped: Array<{ dateLabel: string; rows: VerificationRow[] }> = [];
  for (const row of filtered) {
    const label = relativeDate(row.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.dateLabel === label) {
      last.rows.push(row);
    } else {
      grouped.push({ dateLabel: label, rows: [row] });
    }
  }

  const completedCount = records.filter((r) => r.status === "runtime_done").length;
  const failedCount    = records.filter((r) => r.status === "failed").length;

  return (
    <main className="min-h-screen grid-bg relative">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(138,99,255,0.08) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-[1] mx-auto max-w-5xl px-5 sm:px-8 py-12 sm:py-16">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p
              style={{
                fontSize: 10,
                fontFamily: "var(--font-data)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 10,
              }}
            >
              Verification history
            </p>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
              Your runs
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Every workflow you've verified, with score, status, and shareable report.
            </p>
          </div>
          <Link href="/verify" className="btn-primary shrink-0" style={{ padding: "10px 22px", fontSize: 13 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            New verification
          </Link>
        </div>

        {/* ── Filter tabs ─────────────────────────────── */}
        {records.length > 0 && (
          <div
            className="flex items-center gap-1 mb-8 p-1 rounded-xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              width: "fit-content",
            }}
          >
            {(
              [
                { key: "all",          label: `All  (${records.length})` },
                { key: "runtime_done", label: `Completed  (${completedCount})` },
                { key: "failed",       label: `Failed  (${failedCount})` },
              ] as { key: StatusFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: filter === key ? 600 : 400,
                  color: filter === key ? "var(--text)" : "var(--text-muted)",
                  background: filter === key ? "var(--surface-high)" : "transparent",
                  border: filter === key ? "1px solid var(--border-plus)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-ui)",
                  letterSpacing: "-0.01em",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ──────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl"
                style={{ height: 88, background: "var(--surface)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div
            className="rounded-3xl p-14 text-center"
            style={{ background: "var(--surface)", border: "1px dashed var(--border-plus)" }}
          >
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--violet-dim)", border: "1px solid rgba(138,99,255,0.2)" }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 4v14M4 11h14" stroke="var(--violet)" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>Nothing yet</div>
            <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Run your first verification to see results here.
            </div>
            <Link href="/verify" className="btn-primary" style={{ fontSize: 13 }}>
              Start verification
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No {filter === "failed" ? "failed" : "completed"} verifications.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ dateLabel, rows }) => (
              <div key={dateLabel}>
                {/* Date group header */}
                <div
                  className="mb-3 flex items-center gap-3"
                  style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}
                >
                  {dateLabel}
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>

                <div className="space-y-3">
                  {rows.map((r) => {
                    const isFailed = r.status === "failed";
                    const sc = r.readinessScore;
                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl overflow-hidden transition-all"
                        style={{
                          background: "var(--surface-mid)",
                          border: "1px solid var(--border)",
                          borderLeft: isFailed ? "3px solid var(--rose)" : "3px solid var(--border)",
                        }}
                      >
                        <div className="flex items-center gap-4 px-5 py-4">
                          {/* Score block */}
                          <div
                            className="flex flex-col items-center justify-center rounded-xl shrink-0"
                            style={{
                              width: 64,
                              height: 64,
                              background: scoreBg(sc),
                              border: `1px solid ${scoreColor(sc)}30`,
                            }}
                          >
                            <div
                              className="font-bold tabular-nums leading-none"
                              style={{ fontSize: sc !== null ? 28 : 16, color: scoreColor(sc) }}
                            >
                              {sc !== null ? sc : "—"}
                            </div>
                            {sc !== null && (
                              <div
                                style={{
                                  fontSize: 9,
                                  color: scoreColor(sc),
                                  opacity: 0.7,
                                  fontFamily: "var(--font-data)",
                                  marginTop: 3,
                                  textAlign: "center",
                                  lineHeight: 1.2,
                                  maxWidth: 56,
                                }}
                              >
                                {scoreBandLabel((r.scoreband as any) ?? null)}
                              </div>
                            )}
                          </div>

                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-semibold text-sm truncate mb-1.5"
                              style={{ color: "var(--text)" }}
                            >
                              {r.workflowName ?? "Unnamed workflow"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill status={r.status} />
                              {typeof r.nodeCount === "number" && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "var(--font-data)",
                                    color: "var(--text-muted)",
                                    background: "var(--surface-plus)",
                                    border: "1px solid var(--border)",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  {r.nodeCount} nodes
                                </span>
                              )}
                              {typeof r.simulationCoverage === "number" && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "var(--font-data)",
                                    color: "var(--text-muted)",
                                    background: "var(--surface-plus)",
                                    border: "1px solid var(--border)",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                  }}
                                >
                                  {r.simulationCoverage}% coverage
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Time + open button */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "var(--font-data)",
                                color: "var(--text-faint)",
                              }}
                            >
                              {new Date(r.createdAt).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {r.shareToken && (
                              <Link
                                href={`/report/${r.shareToken}`}
                                className="btn-ghost"
                                style={{ fontSize: 12, padding: "5px 14px" }}
                              >
                                Open report
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
