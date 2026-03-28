"use client";

import { useEffect, useRef, useState } from "react";
import { StaticReport, RuntimeReport, RemediationPlan, ScoreBand } from "@/types";

type Stage = "parsing" | "static_analysis" | "sandbox_execution" | "remediation";

export interface PipelineState {
  stage: Stage | null;
  completedStages: Stage[];
  logLines: Array<{
    text: string;
    type?: "info" | "success" | "warn" | "error" | "dim";
    ts?: string;
  }>;
  staticReport: StaticReport | null;
  runtimeReport: RuntimeReport | null;
  remediationPlan: RemediationPlan | null;
  readinessScore: number | null;
  scoreband: ScoreBand | null;
  simulationCoverage: number | null;
  complete: boolean;
  failed: boolean;
  errorMessage: string | null;
}

const STAGE_ORDER: Stage[] = ["parsing", "static_analysis", "sandbox_execution", "remediation"];

export function usePipelineStream(verificationId: string | null): PipelineState {
  const [state, setState] = useState<PipelineState>({
    stage: null,
    completedStages: [],
    logLines: [],
    staticReport: null,
    runtimeReport: null,
    remediationPlan: null,
    readinessScore: null,
    scoreband: null,
    simulationCoverage: null,
    complete: false,
    failed: false,
    errorMessage: null,
  });

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!verificationId) return;

    const es = new EventSource(`/api/verify/${verificationId}/stream`);
    esRef.current = es;

    function addLog(text: string, type: PipelineState["logLines"][0]["type"] = "info") {
      const ts = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setState((prev) => ({
        ...prev,
        logLines: [...prev.logLines, { text, type, ts }],
      }));
    }

    es.onmessage = (e) => {
      if (!e.data || e.data.trim() === "") return;

      let event: { type: string; payload: Record<string, unknown> };
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }

      const { type, payload } = event;

      switch (type) {
        case "stream_end":
          es.close();
          break;

        case "stage_update": {
          const { stage, message } = payload as { stage: Stage; message: string };
          addLog(message, "info");
          setState((prev) => {
            const currentIdx = STAGE_ORDER.indexOf(prev.stage ?? "parsing");
            const nextIdx = STAGE_ORDER.indexOf(stage);
            const newCompleted = [...prev.completedStages];

            // Mark previous stage(s) as complete
            if (prev.stage && nextIdx > currentIdx) {
              if (!newCompleted.includes(prev.stage)) {
                newCompleted.push(prev.stage);
              }
            }

            return { ...prev, stage, completedStages: newCompleted };
          });
          break;
        }

        case "static_complete": {
          const { staticReport } = payload as { staticReport: StaticReport };
          addLog(
            `Found ${staticReport.issues.length} issue(s) · ${staticReport.passedChecks.length} checks passed`,
            staticReport.issues.filter((i) => i.severity === "critical").length > 0
              ? "warn"
              : "success",
          );
          setState((prev) => ({
            ...prev,
            staticReport,
            completedStages: prev.completedStages.includes("static_analysis")
              ? prev.completedStages
              : [...prev.completedStages, "static_analysis"],
          }));
          break;
        }

        case "sandbox_start": {
          const { simulatableCount } = payload as { simulatableCount: number };
          addLog(`${simulatableCount} node(s) queued for sandbox execution`, "info");
          break;
        }

        case "sandbox_log": {
          const { message } = payload as { message: string };
          addLog(message, message.toLowerCase().includes("error") ? "warn" : "dim");
          break;
        }

        case "runtime_complete": {
          const { runtimeReport } = payload as { runtimeReport: RuntimeReport };
          const passed = runtimeReport.nodeTraces.filter((t) => t.status === "success").length;
          const errored = runtimeReport.nodeTraces.filter((t) => t.status === "error").length;
          addLog(
            `Sandbox complete · ${passed} passed, ${errored} errored · ${runtimeReport.simulationCoverage}% coverage`,
            errored > 0 ? "warn" : "success",
          );
          setState((prev) => ({
            ...prev,
            runtimeReport,
            simulationCoverage: runtimeReport.simulationCoverage,
            completedStages: prev.completedStages.includes("sandbox_execution")
              ? prev.completedStages
              : [...prev.completedStages, "sandbox_execution"],
          }));
          break;
        }

        case "remediation_complete": {
          const { remediationPlan } = payload as { remediationPlan: RemediationPlan };
          addLog(
            `Fix plan ready · ${remediationPlan.items.length} action(s) · generated by ${remediationPlan.generatedBy === "ai_enhanced" ? "AI" : "deterministic engine"}`,
            "success",
          );
          setState((prev) => ({
            ...prev,
            remediationPlan,
            completedStages: prev.completedStages.includes("remediation")
              ? prev.completedStages
              : [...prev.completedStages, "remediation"],
          }));
          break;
        }

        case "verification_complete": {
          const { record } = payload as {
            record: {
              readinessScore: number;
              scoreband: ScoreBand;
              simulationCoverage: number;
              staticReport?: StaticReport;
              runtimeReport?: RuntimeReport;
              remediationPlan?: RemediationPlan;
            };
          };
          addLog(
            `Verification complete · Score: ${record.readinessScore}/100`,
            record.readinessScore >= 65 ? "success" : "error",
          );
          setState((prev) => ({
            ...prev,
            readinessScore: record.readinessScore,
            scoreband: record.scoreband,
            simulationCoverage: record.simulationCoverage ?? prev.simulationCoverage,
            staticReport: record.staticReport ?? prev.staticReport,
            runtimeReport: record.runtimeReport ?? prev.runtimeReport,
            remediationPlan: record.remediationPlan ?? prev.remediationPlan,
            complete: true,
            completedStages: [...STAGE_ORDER],
          }));
          es.close();
          break;
        }

        case "pipeline_error": {
          const { message } = payload as { message: string };
          addLog(`Pipeline failed: ${message}`, "error");
          setState((prev) => ({
            ...prev,
            failed: true,
            errorMessage: message,
          }));
          es.close();
          break;
        }
      }
    };

    es.onerror = () => {
      addLog("Stream connection lost.", "warn");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [verificationId]);

  return state;
}
