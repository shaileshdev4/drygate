import { ScoreBand } from "@/types";
import { scoreBandLabel, scoreBandColor } from "@/lib/utils";

export function ScoreGauge({
  score,
  scoreband,
}: {
  score: number | null;
  scoreband: ScoreBand | null;
}) {
  const safeScore = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const r = 56;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - safeScore / 100);

  const color = scoreBandColor(scoreband);
  const label = scoreBandLabel(scoreband);

  return (
    <div className="flex items-center justify-center">
      {/* Circular frame + padding so round stroke caps are not clipped by a square box */}
      <div
        className="relative grid shrink-0 place-items-center overflow-visible rounded-full"
        style={{
          width: 152,
          height: 152,
          background: "transparent",
          border: "1px solid var(--border-mid)",
          boxSizing: "border-box",
        }}
      >
        <svg
          viewBox="0 0 120 120"
          width={128}
          height={128}
          className="col-start-1 row-start-1 overflow-visible"
          aria-hidden
        >
          <circle cx={cx} cy={cy} r={r} className="score-arc-track" />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            className="score-arc-fill"
            style={{
              stroke: color,
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
              transform: "rotate(-90deg)",
              transformOrigin: "60px 60px",
            }}
          />
        </svg>

        <div className="pointer-events-none col-start-1 row-start-1 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-bold tracking-tight tabular-nums">{safeScore}</div>
          <div className="max-w-[100px] px-1 text-[11px] leading-tight text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}

