"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface WorkflowUploaderProps {
  onWorkflow: (json: unknown) => void;
  disabled?: boolean;
}

const SAMPLE_WORKFLOW_KEY = "__drygate_sample__";

export function WorkflowUploader({ onWorkflow, disabled }: WorkflowUploaderProps) {
  const [mode, setMode] = useState<"drop" | "paste">("drop");
  const [dragging, setDragging] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseAndSubmit(raw: string) {
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.nodes || !parsed.connections) {
        setError(
          'This doesn\'t look like an n8n workflow. Make sure you exported via "Download" from the n8n workflow editor.'
        );
        return;
      }
      onWorkflow(parsed);
    } catch {
      setError("Invalid JSON. Please paste the raw workflow JSON from n8n.");
    }
  }

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Please upload a .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => parseAndSubmit(e.target?.result as string);
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  async function loadSample() {
    try {
      const res = await fetch("/sample-workflow.json");
      const json = await res.json();
      setPasteValue(JSON.stringify(json, null, 2));
      setMode("paste");
      setError(null);
    } catch {
      setError("Could not load sample workflow.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div
        className="flex rounded-lg p-1 gap-1"
        style={{ background: "var(--surface-plus)", border: "1px solid var(--border)" }}
      >
        {(["drop", "paste"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200",
              mode === m
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-2)]"
            )}
          >
            {m === "drop" ? "Upload File" : "Paste JSON"}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      {mode === "drop" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !disabled && fileRef.current?.click()}
          className={cn(
            "relative rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200",
            dragging && "scale-[1.01]"
          )}
          style={{
            height: 200,
            border: `2px dashed ${dragging ? "var(--green)" : "var(--border-plus)"}`,
            background: dragging ? "var(--green-dim)" : "var(--surface)",
            boxShadow: dragging ? "var(--green-glow)" : undefined,
          }}
        >
          {/* Grid background */}
          <div
            className="absolute inset-0 rounded-xl opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(26,32,53,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(26,32,53,0.6) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: dragging ? "rgba(5,226,122,0.15)" : "var(--surface-plus)",
                border: `1px solid ${dragging ? "rgba(5,226,122,0.3)" : "var(--border)"}`,
              }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: dragging ? "var(--green)" : "var(--text-muted)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div className="text-sm font-medium" style={{ color: dragging ? "var(--green)" : "var(--text)" }}>
              {dragging ? "Drop it" : "Drop your workflow JSON here"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              or click to browse · .json files only
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Paste zone */}
      {mode === "paste" && (
        <div className="relative">
          <textarea
            value={pasteValue}
            onChange={(e) => {
              setPasteValue(e.target.value);
              setError(null);
            }}
            placeholder={`{
  "name": "My Workflow",
  "nodes": [...],
  "connections": {...}
}`}
            disabled={disabled}
            rows={10}
            spellCheck={false}
            className="w-full font-mono text-xs p-4 resize-none outline-none transition-all duration-200"
            style={{
              background: "#020308",
              border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
              borderRadius: 10,
              color: "var(--text-2)",
              lineHeight: 1.7,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--border-plus)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? "var(--red)" : "var(--border)";
            }}
          />
          {pasteValue && (
            <button
              onClick={() => { setPasteValue(""); setError(null); }}
              className="absolute top-3 right-3 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2 text-xs p-3 rounded-lg"
          style={{
            background: "var(--red-dim)",
            border: "1px solid rgba(255,61,61,0.2)",
            color: "var(--red)",
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          {error}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={loadSample} className="btn-ghost text-xs" disabled={disabled}>
          Try sample workflow →
        </button>

        {mode === "paste" && (
          <button
            className="btn-primary"
            disabled={disabled || !pasteValue.trim()}
            onClick={() => parseAndSubmit(pasteValue)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verify Workflow
          </button>
        )}
      </div>
    </div>
  );
}