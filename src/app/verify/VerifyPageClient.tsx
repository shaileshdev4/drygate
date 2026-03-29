"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import demoWorkflow from "@/data/demo-workflow.json";

/* ── Types ─────────────────────────────────────────────────── */
type Stage = "idle" | "parsing" | "static" | "sandbox" | "remediation" | "done" | "error";

interface PipelineStage {
  id: Stage;
  label: string;
  sublabel: string;
  color: string;
}

const STAGES: PipelineStage[] = [
  { id: "parsing", label: "Parsing", sublabel: "Validates JSON shape", color: "var(--sky)" },
  {
    id: "static",
    label: "Static analysis",
    sublabel: "Graph & security checks",
    color: "var(--amber)",
  },
  { id: "sandbox", label: "Sandbox run", sublabel: "Live n8n execution", color: "var(--violet)" },
  {
    id: "remediation",
    label: "Remediation",
    sublabel: "Generating fix plan",
    color: "var(--jade)",
  },
];

const STAGE_ETA: Record<string, string> = {
  parsing: "~2s",
  static: "~5s",
  sandbox: "~30s",
  remediation: "~5s",
};

const STAGE_ORDER: Stage[] = ["parsing", "static", "sandbox", "remediation", "done"];

const DEMO_FILE_NAME = "lead-scoring-crm-sync-demo.json";

const DEMO_WORKFLOW = JSON.stringify(demoWorkflow, null, 2);

/* ── Helpers ───────────────────────────────────────────────── */
function stageIndex(s: Stage): number {
  return STAGE_ORDER.indexOf(s);
}

function stageDot(current: Stage, target: Stage): "done" | "active" | "idle" {
  const ci = stageIndex(current);
  const ti = STAGE_ORDER.indexOf(target);
  if (ci > ti) return "done";
  if (ci === ti) return "active";
  return "idle";
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */
export default function VerifyPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [showSandboxLog, setShowSandboxLog] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  /* Demo prefill */
  useEffect(() => {
    if (searchParams?.get("demo") === "1" && !input) {
      setInput(DEMO_WORKFLOW);
      setFileName(DEMO_FILE_NAME);
    }
  }, [searchParams]);

  /* Power users: /verify?debug=1 opens the technical log automatically */
  useEffect(() => {
    if (searchParams?.get("debug") === "1") setShowSandboxLog(true);
  }, [searchParams]);

  /* Auto-scroll logs */
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  /* Cleanup SSE on unmount */
  useEffect(() => () => esRef.current?.close(), []);

  /* ── File drop ─────────────────────────────────────────── */
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Only .json files are accepted.");
      return;
    }
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setInput((e.target?.result as string) ?? "");
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /* ── Submit ────────────────────────────────────────────── */
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) {
      setError("Paste or upload a workflow JSON first.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      setError("Invalid JSON - check for syntax errors.");
      return;
    }

    setError(null);
    setLogs([]);
    setStage("parsing");

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: parsed }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any)?.error ?? `API error ${res.status}`);
      }

      const data = (await res.json()) as {
        id?: string;
        verificationId?: string;
        shareToken?: string;
      };
      const id = data.id ?? data.verificationId;
      const shareToken = data.shareToken;
      if (!id || typeof id !== "string") {
        throw new Error("Verify API did not return a verification id.");
      }
      if (!shareToken || typeof shareToken !== "string") {
        throw new Error("Verify API did not return a share token for the report.");
      }
      setVerificationId(id);
      setShareToken(shareToken);

      /* ── SSE stream (server sends default "message" events, not named event types) ── */
      const mapPipelineStage = (s: string): Stage | null => {
        if (s === "parsing") return "parsing";
        if (s === "static_analysis") return "static";
        if (s === "sandbox_execution") return "sandbox";
        if (s === "remediation") return "remediation";
        return null;
      };

      const es = new EventSource(`/api/verify/${id}/stream`);
      esRef.current = es;

      es.addEventListener("message", (e: MessageEvent<string>) => {
        let msg: { type?: string; payload?: Record<string, unknown> };
        try {
          msg = JSON.parse(e.data) as { type?: string; payload?: Record<string, unknown> };
        } catch {
          return;
        }

        switch (msg.type) {
          case "stage_update": {
            const raw = msg.payload?.stage;
            if (typeof raw === "string") {
              const mapped = mapPipelineStage(raw);
              if (mapped && STAGE_ORDER.includes(mapped)) setStage(mapped);
            }
            break;
          }
          case "sandbox_log": {
            const line =
              typeof msg.payload?.message === "string"
                ? msg.payload.message
                : String(msg.payload?.message ?? "");
            if (line) setLogs((prev) => [...prev.slice(-120), line]);
            break;
          }
          case "verification_complete": {
            es.close();
            setStage("done");
            break;
          }
          case "pipeline_error": {
            es.close();
            setStage("done");
            break;
          }
          case "stream_end":
            es.close();
            break;
          default:
            break;
        }
      });

      es.onerror = () => {
        es.close();
        setStage("error");
        setError("Stream connection lost. Check your network.");
      };
    } catch (err: unknown) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Unexpected error.");
    }
  }, [input, router]);

  const isRunning = !["idle", "done", "error"].includes(stage);
  const inputValid = input.trim().length > 0;

  /* ─────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────── */
  return (
    <main className="grid-bg" style={{ minHeight: "100vh", padding: "36px 0 80px" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 24,
          alignItems: "start",
        }}
        className="verify-layout"
      >
        {/* ══════════════════════════════════════════════════
            LEFT - Input panel
            ══════════════════════════════════════════════════ */}
        <div style={{ animation: "fadeSlideIn 0.5s both" }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Verify workflow
            </div>
            <h1
              style={{
                fontSize: "clamp(24px, 3vw, 34px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                lineHeight: 1.15,
              }}
            >
              Paste your n8n workflow JSON
            </h1>
            <p
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "var(--text-2)",
                letterSpacing: "-0.01em",
              }}
            >
              Export from n8n → Download → paste here, or drag a .json file.
            </p>
          </div>

          {/* Drop zone / textarea */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={(e) => {
              if (input) return;
              const t = e.target as HTMLElement;
              if (t.closest("textarea")) return;
              fileRef.current?.click();
            }}
            style={{
              position: "relative",
              borderRadius: 16,
              border: `1.5px dashed ${
                dragging
                  ? "var(--violet)"
                  : error
                    ? "var(--rose)"
                    : inputValid
                      ? "var(--border-plus)"
                      : "var(--border-mid)"
              }`,
              background: dragging ? "var(--violet-dim)" : "var(--surface)",
              transition: "border-color 0.2s, background 0.2s",
              overflow: "hidden",
              cursor: input ? "default" : "pointer",
              boxShadow: dragging ? "0 0 0 4px rgba(138,99,255,0.1)" : "none",
            }}
          >
            {/* File name badge */}
            {fileName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-plus)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect
                      x="2"
                      y="1"
                      width="8"
                      height="12"
                      rx="1.5"
                      stroke="var(--violet)"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M5 5h4M5 7.5h3"
                      stroke="var(--violet)"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>
                  <span
                    style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-2)" }}
                  >
                    {fileName}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInput("");
                    setFileName(null);
                    setError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: "2px 4px",
                    borderRadius: 4,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--rose)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  ×
                </button>
              </div>
            )}

            {/* Placeholder when empty */}
            {!input && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  pointerEvents: "none",
                  zIndex: 1,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "var(--violet-dim)",
                    border: "1px solid rgba(138,99,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M11 14V4M7 8l4-4 4 4"
                      stroke="var(--violet)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 16v1a1 1 0 001 1h12a1 1 0 001-1v-1"
                      stroke="var(--violet)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                  </svg>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-2)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    Drop .json file here
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    or click to browse · or paste below
                  </div>
                </div>
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
                if (!fileName) setFileName(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPaste={(e) => e.stopPropagation()}
              placeholder={!input ? "\n\n\n\n\n\n" : ""}
              disabled={isRunning}
              spellCheck={false}
              autoComplete="off"
              style={{
                position: "relative",
                zIndex: 2,
                width: "100%",
                minHeight: input ? 340 : 220,
                padding: "16px",
                background: "transparent",
                border: "none",
                color: "var(--text-2)",
                fontFamily: "var(--font-data)",
                fontSize: 12,
                lineHeight: 1.75,
                resize: "vertical",
                outline: "none",
                opacity: isRunning ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {/* Error message */}
          {error && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                background: "var(--rose-dim)",
                border: "1px solid rgba(240,67,110,0.2)",
                borderRadius: 10,
                fontSize: 13,
                color: "var(--rose-light)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ flexShrink: 0 }}>⚠</span>
              {error}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleSubmit}
              disabled={isRunning || !inputValid}
              className="btn-primary"
              style={{
                fontSize: 14,
                padding: "12px 28px",
                opacity: !inputValid || isRunning ? 0.45 : 1,
              }}
            >
              {isRunning ? (
                <>
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Running…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 7h8M7 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Run verification
                </>
              )}
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={isRunning}
              className="btn-ghost"
              style={{ fontSize: 13 }}
            >
              Browse file
            </button>

            {!input && (
              <button
                onClick={() => {
                  setInput(DEMO_WORKFLOW);
                  setFileName(DEMO_FILE_NAME);
                  setError(null);
                }}
                className="btn-ghost"
                style={{ fontSize: 13 }}
              >
                Load demo
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            RIGHT - Pipeline status panel
            ══════════════════════════════════════════════════ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            animation: "fadeSlideIn 0.55s 0.1s both",
          }}
        >
          {/* Pipeline card */}
          <div className="glass-plus" style={{ borderRadius: 20, padding: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 18,
              }}
            >
              Pipeline
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STAGES.map((s, i) => {
                const st = stageDot(stage, s.id);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 13,
                      padding: "11px 14px",
                      borderRadius: 11,
                      background:
                        st === "active"
                          ? `${s.color}10`
                          : st === "done"
                            ? "rgba(255,255,255,0.025)"
                            : "transparent",
                      border: `1px solid ${
                        st === "active"
                          ? `${s.color}30`
                          : st === "done"
                            ? "var(--border)"
                            : "transparent"
                      }`,
                      transition: "all 0.3s ease",
                    }}
                  >
                    {/* Status dot */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {st === "active" && (
                        <div
                          style={{
                            position: "absolute",
                            inset: -3,
                            borderRadius: "50%",
                            background: s.color,
                            opacity: 0.25,
                            animation: "pulseGlow 1.4s ease-in-out infinite",
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background:
                            st === "done"
                              ? "var(--jade)"
                              : st === "active"
                                ? s.color
                                : "var(--surface-high)",
                          boxShadow:
                            st === "active"
                              ? `0 0 10px ${s.color}`
                              : st === "done"
                                ? "0 0 8px var(--jade-glow)"
                                : "none",
                          transition: "background 0.3s, box-shadow 0.3s",
                          position: "relative",
                        }}
                      />
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: st !== "idle" ? 600 : 400,
                          color:
                            st === "done"
                              ? "var(--text)"
                              : st === "active"
                                ? "var(--text)"
                                : "var(--text-muted)",
                          letterSpacing: "-0.01em",
                          lineHeight: 1.3,
                          transition: "color 0.3s",
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {s.sublabel}
                      </div>
                    </div>

                    {/* Right status */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 2,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 10,
                          letterSpacing: "0.04em",
                          color:
                            st === "done"
                              ? "var(--jade)"
                              : st === "active"
                                ? s.color
                                : "var(--text-faint)",
                        }}
                      >
                        {st === "done" ? "✓" : st === "active" ? "…" : "-"}
                      </div>
                      {st === "active" && STAGE_ETA[s.id] && (
                        <div
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 9,
                            color: s.color,
                            opacity: 0.65,
                          }}
                        >
                          {STAGE_ETA[s.id]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Done state - dramatic completion + View Report button */}
            {stage === "done" && shareToken && (
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  animation: "fadeSlideIn 0.4s both",
                }}
              >
                {/* Glow success banner */}
                <div
                  style={{
                    padding: "14px 16px",
                    background:
                      "linear-gradient(135deg, rgba(46,207,150,0.15) 0%, rgba(46,207,150,0.06) 100%)",
                    border: "1px solid rgba(46,207,150,0.35)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow:
                      "0 0 32px rgba(46,207,150,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Inner glow orb */}
                  <div
                    style={{
                      position: "absolute",
                      right: -20,
                      top: -20,
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(46,207,150,0.25) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(46,207,150,0.2)",
                      border: "1px solid rgba(46,207,150,0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M2.5 6.5L5.5 9.5L10.5 3.5"
                        stroke="var(--jade)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--jade-light)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Verification complete
                    </div>
                    <div style={{ fontSize: 11, color: "var(--jade)", opacity: 0.7, marginTop: 1 }}>
                      Report ready - click below to view
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/report/${encodeURIComponent(shareToken)}`)}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    fontSize: 14,
                    padding: "13px 20px",
                    fontWeight: 700,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 7h10M8 3l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  View Report
                </button>
              </div>
            )}

            {stage === "error" && (
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  background: "var(--rose-dim)",
                  border: "1px solid rgba(240,67,110,0.22)",
                  borderRadius: 11,
                  fontSize: 13,
                  color: "var(--rose-light)",
                  animation: "fadeSlideIn 0.4s both",
                }}
              >
                Pipeline failed - check error above.
              </div>
            )}
          </div>

          {/* Optional technical log - hidden by default; not needed for normal use */}
          {(stage !== "idle" || logs.length > 0) && (
            <div className="glass-plus" style={{ borderRadius: 20, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setShowSandboxLog((o) => !o)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "transparent",
                  border: "none",
                  borderBottom: showSandboxLog ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    {isRunning && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--violet)",
                          boxShadow: "0 0 8px var(--violet)",
                          animation: "pulseGlow 1.2s ease-in-out infinite",
                          display: "inline-block",
                        }}
                      />
                    )}
                    Technical details
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-faint)",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    Optional - raw messages from the verification sandbox. Use{" "}
                    <code style={{ fontSize: 10 }}>?debug=1</code> on this page to expand
                    automatically.
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    color: "var(--text-faint)",
                  }}
                >
                  {logs.length > 0 ? `${logs.length} lines` : "-"}
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {showSandboxLog ? "▾" : "▸"}
                  </span>
                </div>
              </button>

              {showSandboxLog && (
                <div
                  ref={logRef}
                  style={{
                    height: 220,
                    overflowY: "auto",
                    padding: "12px 16px",
                    background: "var(--bg)",
                  }}
                >
                  {logs.length === 0 ? (
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-data)",
                        fontSize: 12,
                        color: "var(--text-faint)",
                      }}
                    >
                      Connecting to sandbox…
                    </div>
                  ) : (
                    logs.map((line, i) => (
                      <div
                        key={i}
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 11.5,
                          lineHeight: 1.7,
                          color: "var(--text-2)",
                          animation: "fadeSlideIn 0.18s both",
                        }}
                      >
                        <span style={{ color: "var(--violet)", opacity: 0.4, marginRight: 8 }}>
                          ›
                        </span>
                        {line}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "var(--violet)", flexShrink: 0 }}>·</span>
                <span>Score is heuristic - not a formal proof of safety.</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ color: "var(--violet)", flexShrink: 0 }}>·</span>
                <span>Real credentials are never validated in sandbox.</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--violet)", flexShrink: 0 }}>·</span>
                <span>Sandbox requires Docker + n8n containers running.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
