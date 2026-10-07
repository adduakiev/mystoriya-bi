import type { Kpi } from "@/lib/data/types";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const deltaText =
    kpi.delta === null
      ? "—"
      : `${kpi.delta > 0 ? "+" : ""}${kpi.delta.toFixed(1)} ${kpi.deltaLabel}`;

  return (
    <button className="kpi-card" type="button">
      <span className="kpi-label">{kpi.label}</span>
      <strong>{kpi.value}</strong>
      <span className={`delta ${kpi.direction === "up" ? "positive" : kpi.direction === "down" ? "negative" : ""}`}>
        {deltaText}
      </span>
    </button>
  );
}
