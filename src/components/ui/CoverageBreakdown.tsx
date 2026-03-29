"use client";

import { NodeTrace, NodeCoverage } from "@/types";

interface Props {
  nodeTraces: NodeTrace[];
  coverageClassification: NodeCoverage[];
  simulationCoverage: number | null;
  /** Match reference report coverage card (sidebar). */
  reportLayout?: boolean;
}

export function CoverageBreakdown({
  nodeTraces,
  coverageClassification,
  simulationCoverage,
  reportLayout,
}: Props) {
  const ran = nodeTraces.filter((t) => t.status === "success" || t.status === "error");
  const blocked = nodeTraces.filter((t) => t.status === "blocked");
  const skipped = nodeTraces.filter((t) => t.status === "skipped");
  const triggers = nodeTraces.filter((t) => t.status === "workflow_trigger");

  const blockReasonMap = new Map(coverageClassification.map((c) => [c.nodeName, c]));

  const credentialHint = (nodeName: string): string | null => {
    const cov = blockReasonMap.get(nodeName);
    if (!cov || cov.class !== "credential_blocked") return null;
    const parts = cov.nodeType.split(".");
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
  };

  const pct = simulationCoverage ?? 0;
  const covColor =
    pct >= 70 ? "var(--jade)" : pct >= 30 ? "var(--amber)" : "var(--rose)";
  const covLabel = pct >= 70 ? "Good" : pct >= 30 ? "Moderate" : "Low";

  const sectionTitle = (text: string) =>
    reportLayout ? (
      <div
        className="font-mono text-[10px] uppercase tracking-widest mb-2"
        style={{ color: "#3d3a4d", letterSpacing: "0.06em" }}
      >
        {text}
      </div>
    ) : (
      <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">{text}</div>
    );

  const wrapClass = reportLayout ? "report-coverage-card" : "glass-plus rounded-3xl border border-border p-5";

  if (reportLayout) {
    return (
      <div className={wrapClass}>
        <div className="report-card-label mb-3">Simulation coverage</div>
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-2xl font-bold tabular-nums tracking-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            {typeof simulationCoverage === "number" ? `${simulationCoverage}%` : "—"}
          </span>
          <span
            className="report-pill"
            style={{
              ...(pct >= 70
                ? { background: "rgba(46,207,150,0.12)", color: "var(--jade)", border: "1px solid rgba(46,207,150,0.2)" }
                : pct >= 30
                  ? {
                      background: "rgba(245,185,66,0.12)",
                      color: "var(--amber)",
                      border: "1px solid rgba(245,185,66,0.2)",
                    }
                  : {
                      background: "rgba(240,67,110,0.12)",
                      color: "var(--rose)",
                      border: "1px solid rgba(240,67,110,0.2)",
                    }),
            }}
          >
            {typeof simulationCoverage === "number" ? covLabel : "—"}
          </span>
        </div>
        <div className="report-cov-bar-wrap">
          <div className="report-cov-bar-fill" style={{ width: `${pct}%`, background: covColor }} />
        </div>

        {ran.length > 0 && (
          <div className="mb-4">
            {sectionTitle(`Executed (${ran.length})`)}
            <div className="space-y-1.5">
              {ran.map((t) => (
                <div key={t.nodeId} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: t.status === "success" ? "var(--jade)" : "var(--rose)",
                      boxShadow:
                        t.status === "success"
                          ? "0 0 6px var(--jade)"
                          : "0 0 6px var(--rose)",
                    }}
                  />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.nodeName}
                  </span>
                  {t.status === "error" && t.errorMessage && (
                    <span className="text-[10px] ml-auto truncate max-w-[100px]" style={{ color: "var(--rose-light)" }}>
                      {t.errorMessage.slice(0, 40)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {blocked.length > 0 && (
          <div className="mb-4">
            {sectionTitle(`Blocked (${blocked.length})`)}
            <div className="space-y-1.5">
              {blocked.map((t) => (
                <div key={t.nodeId} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#3d3a4d" }}
                  />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.nodeName}
                  </span>
                  {credentialHint(t.nodeName) && (
                    <span className="font-mono text-[9px] ml-auto whitespace-nowrap" style={{ color: "#3d3a4d" }}>
                      needs: {credentialHint(t.nodeName)?.toLowerCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="mb-4">
            {sectionTitle(`Skipped (${skipped.length})`)}
            <div className="space-y-1.5">
              {skipped.map((t) => (
                <div key={t.nodeId} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.12)" }}
                  />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.nodeName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {triggers.length > 0 && (
          <div>
            {sectionTitle(`Trigger (${triggers.length})`)}
            <div className="space-y-1.5">
              {triggers.map((t) => (
                <div key={t.nodeId} className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--sky)", boxShadow: "0 0 6px rgba(66,176,245,0.35)" }}
                  />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.nodeName}
                  </span>
                  <span className="font-mono text-[9px] ml-auto whitespace-nowrap" style={{ color: "#3d3a4d" }}>
                    entry
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pct < 30 && blocked.length > 0 && (
          <div
            className="mt-3.5 p-2.5 rounded-lg text-[11px] leading-relaxed"
            style={{ background: "#18151f", color: "var(--text-muted)" }}
          >
            <strong style={{ color: "var(--text)" }}>Why is coverage low?</strong>{" "}
            {blocked.length} node{blocked.length > 1 ? "s" : ""} require real credentials to execute and were skipped
            for safety. Static analysis checks still applied to all {coverageClassification.length} nodes (sticky notes
            excluded).
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <div className="flex items-center justify-between mb-4">
        <div className="label">Simulation coverage</div>
        <div className="mono-tag">
          {typeof simulationCoverage === "number" ? `${simulationCoverage}%` : "—"}
        </div>
      </div>

      <div className="w-full h-1.5 rounded-full bg-surface-plus mb-5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${simulationCoverage ?? 0}%`,
            background: covColor,
          }}
        />
      </div>

      {ran.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">
            Executed ({ran.length})
          </div>
          <div className="space-y-1.5">
            {ran.map((t) => (
              <div key={t.nodeId} className="flex items-center gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: t.status === "success" ? "var(--jade)" : "var(--rose)",
                    boxShadow:
                      t.status === "success"
                        ? "0 0 6px var(--jade)"
                        : "0 0 6px var(--rose)",
                  }}
                />
                <span className="text-sm font-medium text-text truncate">{t.nodeName}</span>
                {t.status === "error" && t.errorMessage && (
                  <span className="text-xs text-rose-400 ml-auto truncate max-w-[160px]">
                    {t.errorMessage.slice(0, 60)}
                  </span>
                )}
                {t.status === "success" && (
                  <span className="mono-tag ml-auto" style={{ color: "var(--jade)" }}>
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">
            Blocked — credentials required ({blocked.length})
          </div>
          <div className="space-y-1.5">
            {blocked.map((t) => (
              <div key={t.nodeId} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted opacity-40" />
                <span className="text-sm text-muted truncate">{t.nodeName}</span>
                {credentialHint(t.nodeName) && (
                  <span className="mono-tag ml-auto text-muted">
                    needs: {credentialHint(t.nodeName)?.toLowerCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">
            Skipped ({skipped.length})
          </div>
          <div className="space-y-1.5">
            {skipped.map((t) => (
              <div key={t.nodeId} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted opacity-20" />
                <span className="text-sm text-muted truncate">{t.nodeName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {triggers.length > 0 && (
        <div>
          <div className="text-xs text-muted font-mono uppercase tracking-widest mb-2">
            Trigger ({triggers.length})
          </div>
          <div className="space-y-1.5">
            {triggers.map((t) => (
              <div key={t.nodeId} className="flex items-center gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--sky)", boxShadow: "0 0 6px rgba(66,176,245,0.35)" }}
                />
                <span className="text-sm text-muted truncate">{t.nodeName}</span>
                <span className="mono-tag ml-auto text-muted">entry</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(simulationCoverage ?? 0) < 30 && blocked.length > 0 && (
        <div className="mt-4 p-3 rounded-xl border border-border bg-surface text-xs text-muted leading-relaxed">
          <span className="text-text font-medium">Why is coverage low?</span>{" "}
          {blocked.length} node{blocked.length > 1 ? "s" : ""} require real credentials to execute and were skipped for
          safety. Static analysis checks still applied to all {coverageClassification.length} nodes (sticky notes
          excluded).
        </div>
      )}
    </div>
  );
}
