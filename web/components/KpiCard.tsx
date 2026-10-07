import type { Kpi } from "@/lib/metrics";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const positive = kpi.delta >= 0;

  return (
    <button className="kpi-card" type="button">
      <span className="kpi-label">{kpi.label}</span>
      <strong>{kpi.value}</strong>
      <span className={positive ? "delta positive" : "delta negative"}>
        {positive ? "↑" : "↓"} {Math.abs(kpi.delta)} {kpi.deltaLabel}
      </span>
    </button>
  );
}
