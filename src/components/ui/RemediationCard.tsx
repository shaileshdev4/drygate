"use client";

import { useState } from "react";
import { RemediationItem } from "@/types";
import { SeverityBadge } from "./SeverityBadge";
import { effortLabel, cn } from "@/lib/utils";

interface RemediationCardProps {
  item: RemediationItem;
  index: number;
}

const effortColors: Record<string, string> = {
  minutes: "text-green bg-green/10 border-green/25",
  hours: "text-amber bg-amber/10 border-amber/25",
  days: "text-red bg-red/10 border-red/25",
};

export function RemediationCard({ item, index }: RemediationCardProps) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div
      className="glass rounded-xl overflow-hidden transition-all duration-200 hover:border-[var(--border-plus)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-4 p-5 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Priority number */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono mt-0.5"
          style={{
            background: "var(--surface-plus)",
            border: "1px solid var(--border-plus)",
            color: "var(--text-muted)",
          }}
        >
          {item.priority}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="mono-tag">{item.issueCode}</span>
            <span
              className={cn(
                "text-[10px] font-mono font-semibold px-2 py-0.5 rounded border",
                effortColors[item.estimatedEffort] ?? "text-muted border-border"
              )}
            >
              {effortLabel(item.estimatedEffort)}
            </span>
          </div>
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {item.title}
          </div>
          <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
            {item.nodeName}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={cn(
            "w-4 h-4 flex-shrink-0 mt-1 transition-transform duration-200",
            expanded ? "rotate-180" : "rotate-0"
          )}
          style={{ color: "var(--text-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded steps */}
      {expanded && (
        <div
          className="px-5 pb-5 pt-0 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <ol className="space-y-3 mt-4">
            {item.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold mt-0.5"
                  style={{
                    background: "var(--green-dim)",
                    border: "1px solid rgba(5,226,122,0.2)",
                    color: "var(--green)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="leading-relaxed pt-0.5"
                  style={{ color: "var(--text-2)" }}
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}