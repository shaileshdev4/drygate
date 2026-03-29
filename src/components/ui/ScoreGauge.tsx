import { ScoreBand } from "@/types";
import { scoreBandLabel, scoreBandColor } from "@/lib/utils";

function bandShortLabel(band: ScoreBand | null): string {
  switch (band) {
    case "production_ready":
      return "Production ready";
    case "needs_minor_fixes":
      return "Minor fixes";
    case "significant_issues":
      return "Significant issues";
    case "not_ready":
      return "Not ready";
    default:
      return "—";
  }
}

export function ScoreGauge({
  score,
  scoreband,
  compact,
}: {
  score: number | null;
  scoreband: ScoreBand | null;
  /** Smaller arc for report score hero (reference layout). */
  compact?: boolean;
}) {
  const safeScore = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const color = scoreBandColor(scoreband);
  const label = scoreBandLabel(scoreband);
  const shortBand = bandShortLabel(scoreband);

  if (compact) {
    const r = 42;
    const cx = 55;
    const cy = 55;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference * (1 - safeScore / 100);

    return (
      <div className="report-score-arc-wrap flex items-center justify-center">
        <svg width={110} height={110} viewBox="0 0 110 110" aria-hidden>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={7}
            strokeLinecap="round"
            style={{
              strokeDasharray: `${circumference}`,
              strokeDashoffset: 0,
              transform: "rotate(-90deg)",
              transformOrigin: "55px 55px",
            }}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: dashOffset,
              transform: "rotate(-90deg)",
              transformOrigin: "55px 55px",
              filter: "drop-shadow(0 0 8px rgba(240,67,110,0.35))",
            }}
          />
          <text
            x={55}
            y={49}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-ui, 'DM Sans', sans-serif)",
              fontSize: 26,
              fontWeight: 800,
              fill: "white",
              letterSpacing: "-1px",
            }}
          >
            {safeScore}
          </text>
          <text
            x={55}
            y={63}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-data, 'DM Mono', monospace)",
              fontSize: 8,
              fill: "rgba(255,255,255,0.2)",
              letterSpacing: "0.04em",
            }}
          >
            / 100
          </text>
          <text
            x={55}
            y={76}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-ui, 'DM Sans', sans-serif)",
              fontSize: 9,
              fontWeight: 600,
              fill: color,
            }}
          >
            {shortBand}
          </text>
        </svg>
        <span className="sr-only">
          {label}: {safeScore} out of 100
        </span>
      </div>
    );
  }

  const r = 56;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - safeScore / 100);

  return (
    <div className="flex items-center justify-center">
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
