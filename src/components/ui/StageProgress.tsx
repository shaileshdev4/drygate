"use client";

import { cn } from "@/lib/utils";

type Stage = "parsing" | "static_analysis" | "sandbox_execution" | "remediation";

const STAGES: { key: Stage; label: string; sublabel: string }[] = [
  { key: "parsing", label: "Parse", sublabel: "Reading workflow JSON" },
  { key: "static_analysis", label: "Analyze", sublabel: "Static checks" },
  { key: "sandbox_execution", label: "Sandbox", sublabel: "n8n dry-run" },
  { key: "remediation", label: "Fix Plan", sublabel: "Generating fixes" },
];

interface StageProgressProps {
  currentStage: Stage | null;
  completedStages: Stage[];
  failed?: boolean;
}

export function StageProgress({
  currentStage,
  completedStages,
  failed,
}: StageProgressProps) {
  return (
    <div className="flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const isComplete = completedStages.includes(stage.key);
        const isActive = currentStage === stage.key;
        const isLast = i === STAGES.length - 1;

        let color = "var(--text-muted)";
        let dotBg = "var(--surface-plus)";
        let dotBorder = "var(--border)";

        if (isComplete) {
          color = "var(--green)";
          dotBg = "var(--green-dim)";
          dotBorder = "rgba(5,226,122,0.4)";
        } else if (isActive) {
          color = "var(--text)";
          dotBg = "var(--surface-plus)";
          dotBorder = "var(--border-plus)";
        }
        if (failed && isActive) {
          color = "var(--red)";
          dotBorder = "rgba(255,61,61,0.4)";
        }

        return (
          <div key={stage.key} className="flex items-center flex-1">
            {/* Stage node */}
            <div className="flex flex-col items-center gap-1.5 min-w-[64px]">
              {/* Dot / check */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: dotBg,
                  border: `1.5px solid ${dotBorder}`,
                  boxShadow: isActive && !failed
                    ? "0 0 12px rgba(255,255,255,0.1)"
                    : undefined,
                }}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" style={{ color: "var(--green)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive && !failed ? (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: "var(--text-2)",
                      animation: "pulseGlow 1.2s ease-in-out infinite",
                    }}
                  />
                ) : failed && isActive ? (
                  <svg className="w-4 h-4" style={{ color: "var(--red)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--border-plus)" }} />
                )}
              </div>

              {/* Label */}
              <div className="text-center">
                <div
                  className="text-xs font-semibold leading-tight"
                  style={{ color }}
                >
                  {stage.label}
                </div>
                <div
                  className="text-[10px] leading-tight mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {stage.sublabel}
                </div>
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="flex-1 h-px mx-1 transition-all duration-500"
                style={{
                  background: isComplete
                    ? "var(--green)"
                    : "var(--border)",
                  opacity: isComplete ? 0.5 : 1,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}