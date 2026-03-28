import { ScoreBand } from "@/types";
import { scoreBandLabel, scoreBandColor } from "@/lib/utils";

export function GateStatus({
  scoreband,
  className,
}: {
  scoreband: ScoreBand | null;
  className?: string;
}) {
  const label = scoreBandLabel(scoreband);
  const color = scoreBandColor(scoreband);

  return (
    <div
      className={[
        "glass-plus rounded-xl border p-4",
        "relative overflow-hidden",
        className ?? "",
      ].join(" ")}
    >
      <div
        className="pointer-events-none absolute -inset-24 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 30%, ${color}33 0%, transparent 60%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">Production Gate</div>
          <div className="mt-1 text-lg font-semibold" style={{ color }}>
            {label}
          </div>
          <div className="mt-2 text-sm text-muted">
            Pass/fail is based on static issues + sandbox runtime.
          </div>
        </div>
        <div
          className="h-10 w-10 rounded-full border"
          style={{
            background: `radial-gradient(circle at center, ${color}22 0%, rgba(0,0,0,0) 60%)`,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        />
      </div>
    </div>
  );
}
