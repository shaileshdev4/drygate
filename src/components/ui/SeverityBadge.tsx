import { IssueSeverity } from "@/types";
import { severityBgClass } from "@/lib/utils";

export function SeverityBadge({
  severity,
}: {
  severity: IssueSeverity;
}) {
  const cls = severityBgClass(severity);
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold",
        "border",
        cls,
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          severity === "critical"
            ? "bg-red"
            : severity === "high"
              ? "bg-orange"
              : severity === "medium"
                ? "bg-amber"
                : severity === "low"
                  ? "bg-blue"
                  : "bg-border-plus",
        ].join(" ")}
      />
      {severity.toUpperCase()}
    </span>
  );
}

