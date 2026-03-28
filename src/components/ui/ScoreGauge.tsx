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
    <div className="flex items-center gap-4">
      <div className="relative h-[132px] w-[132px]">
        <div className="absolute inset-0 rounded-full bg-green-glow/0" />
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            className="score-arc-track"
          />
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

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold tracking-tight">{safeScore}</div>
          <div className="text-[11px] text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}

