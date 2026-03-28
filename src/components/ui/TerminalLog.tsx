"use client";

import { useEffect, useRef } from "react";

export function TerminalLog({ lines, isLive }: { lines: string[]; isLive?: boolean }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  return (
    <div className="terminal">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="text-xs font-semibold tracking-widest text-muted">SANDBOX CONSOLE</div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: isLive ? "var(--green)" : "var(--border-plus)",
              boxShadow: isLive ? "var(--green-glow)" : "none",
            }}
          />
          <span className="text-xs text-muted">{isLive ? "LIVE" : "IDLE"}</span>
        </div>
      </div>

      <div className="px-3 py-2 max-h-[340px] overflow-auto">
        {lines.length === 0 ? (
          <div className="text-sm text-muted">Awaiting sandbox logs…</div>
        ) : (
          lines.map((l, idx) => (
            <div key={idx} className="terminal-line whitespace-pre-wrap break-words">
              {l}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
