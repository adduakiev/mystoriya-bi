import { unstable_cache } from "next/cache";
import { buildDashboardSnapshot } from "@/lib/analytics";
import { filterSalesRows } from "@/lib/filters";
import type { ComparisonMode, DashboardSnapshot, Kpi, MetricSet, PeriodMode, SalesRow } from "@/lib/data/types";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type AggregatorCard = {
  name: string;
  revenue: number;
  checks: number;
  averageCheck: number;
  markupRate: number;
  growth: number | null;
  share: number;
};

export type AggregatorsData = {
  source: "supabase-sql" | "legacy";
  rowCount: number;
  snapshot: DashboardSnapshot;
  aggregators: AggregatorCard[];
};

type RpcMetricSet = {
  revenue?: number | string;
  checks?: number | string;
  markup?: number | string;
  averageCheck?: number | string;
  markupRate?: number | string;
};

type RpcPayload = {
  meta?: {
    rowCount?: number | string;
    cutoffDate?: string;
    period?: PeriodMode;
    comparison?: ComparisonMode;
    periodLabel?: string;
    comparisonLabel?: string;
    currentYear?: number | string;
    previousYear?: number | string;
  };
  current?: RpcMetricSet;
  previous?: RpcMetricSet;
  trend?: Array<{ label?: string; current?: number | string; previous?: number | string }>;
  locations?: Array<{ name?: string; revenue?: number | string; growth?: number | string | null; share?: number | string }>;
  aggregators?: Array<{
    name?: string;
    revenue?: number | string;
    checks?: number | string;
    averageCheck?: number | string;
    markupRate?: number | string;
    growth?: number | string | null;
    share?: number | string;
  }>;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function pp(current: number, previous: number): number | null {
  if (!Number.isFinite(previous)) return null;
  return current - previous;
}

function compactUah(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₴ ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₴ ${(value / 1_000).toFixed(1)}K`;
  return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;
}

function kpi(label: string, value: string, delta: number | null, deltaLabel: string): Kpi {
  return {
    label,
    value,
    delta,
    deltaLabel,
    direction: delta === null || Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down"
  };
}

function metricSet(raw?: RpcMetricSet): MetricSet {
  return {
    revenue: num(raw?.revenue),
    checks: num(raw?.checks),
    markup: num(raw?.markup),
    averageCheck: num(raw?.averageCheck),
    markupRate: num(raw?.markupRate)
  };
}

function signal(current: MetricSet, previous: MetricSet, label: string): DashboardSnapshot["signal"] {
  const revenueGrowth = pct(current.revenue, previous.revenue) ?? 0;
  const markupPp = pp(current.markupRate, previous.markupRate) ?? 0;
  const checksGrowth = pct(current.checks, previous.checks) ?? 0;
  const aovGrowth = pct(current.averageCheck, previous.averageCheck) ?? 0;

  if (revenueGrowth > 0 && markupPp < -0.5) {
    return {
      severity: "warning",
      title: "Оборот росте швидше за націнку %",
      body: `Оборот +${revenueGrowth.toFixed(1)}% vs ${label}, але націнка % змінилась на ${markupPp.toFixed(1)} п.п.`
    };
  }

  return {
    severity: "info",
    title: revenueGrowth >= 0 ? "Позитивна динаміка" : "Період нижче бази порівняння",
    body: `Оборот: ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%. Чеки: ${checksGrowth >= 0 ? "+" : ""}${checksGrowth.toFixed(1)}%. Середній чек: ${aovGrowth >= 0 ? "+" : ""}${aovGrowth.toFixed(1)}% vs ${label}.`
  };
}

function snapshotFromRpc(payload: RpcPayload): DashboardSnapshot {
  const meta = payload.meta ?? {};
  const current = metricSet(payload.current);
  const previous = metricSet(payload.previous);
  const comparisonLabel = meta.comparisonLabel ?? "LY";

  return {
    sourceRows: num(meta.rowCount),
    cutoffDate: meta.cutoffDate ?? "",
    currentYear: num(meta.currentYear),
    previousYear: num(meta.previousYear),
    period: meta.period ?? "ytd",
    comparison: meta.comparison ?? "ly",
    periodLabel: meta.periodLabel ?? "",
    comparisonLabel,
    current,
    previous,
    kpis: [
      kpi("Оборот", compactUah(current.revenue), pct(current.revenue, previous.revenue), comparisonLabel),
      kpi("Чеки", Math.round(current.checks).toLocaleString("uk-UA"), pct(current.checks, previous.checks), comparisonLabel),
      kpi("Середній чек", `₴ ${Math.round(current.averageCheck).toLocaleString("uk-UA")}`, pct(current.averageCheck, previous.averageCheck), comparisonLabel),
      kpi("Націнка", compactUah(current.markup), pct(current.markup, previous.markup), comparisonLabel),
      kpi("Націнка %", `${current.markupRate.toFixed(1)}%`, pp(current.markupRate, previous.markupRate), `п.п. vs ${comparisonLabel}`)
    ],
    trend: (payload.trend ?? []).map((point) => ({
      label: point.label ?? "",
      current: num(point.current),
      previous: num(point.previous)
    })),
    channels: [],
    locations: (payload.locations ?? []).map((item) => ({
      name: item.name ?? "",
      revenue: num(item.revenue),
      growth: nullableNum(item.growth),
      share: num(item.share)
    })),
    monthlyTable: [],
    signal: signal(current, previous, comparisonLabel)
  };
}

function groupLegacy(rows: SalesRow[], period: PeriodMode, comparison: ComparisonMode): AggregatorCard[] {
  const names = [...new Set(rows.map((row) => row.orderType))].sort((a,b)=>a.localeCompare(b,"uk"));
  const total = buildDashboardSnapshot(rows,{period,comparison}).current.revenue;
  return names.map((name)=>{
    const s=buildDashboardSnapshot(rows.filter((row)=>row.orderType===name),{period,comparison});
    return {
      name,
      revenue:s.current.revenue,
      checks:s.current.checks,
      averageCheck:s.current.averageCheck,
      markupRate:s.current.markupRate,
      growth:pct(s.current.revenue,s.previous.revenue),
      share:total>0?s.current.revenue/total*100:0
    };
  }).sort((a,b)=>b.revenue-a.revenue);
}

export async function loadAggregatorsData(
  period: PeriodMode,
  comparison: ComparisonMode,
  lfl: boolean
): Promise<AggregatorsData> {
  const key = JSON.stringify([period,comparison,lfl?1:0]);

  try {
    const payload = await unstable_cache(
      () => callBiRpc<RpcPayload>("bi_aggregators_payload_v2", {
        p_period: period,
        p_comparison: comparison,
        p_lfl: lfl
      }),
      ["bi-aggregators-sql-v1",key],
      { revalidate:180, tags:["sales-data","aggregators-data"] }
    )();

    return {
      source:"supabase-sql",
      rowCount:num(payload.meta?.rowCount),
      snapshot:snapshotFromRpc(payload),
      aggregators:(payload.aggregators ?? []).map((item)=>({
        name:item.name ?? "",
        revenue:num(item.revenue),
        checks:num(item.checks),
        averageCheck:num(item.averageCheck),
        markupRate:num(item.markupRate),
        growth:nullableNum(item.growth),
        share:num(item.share)
      }))
    };
  } catch (error) {
    console.error("SQL-first Aggregators failed; using legacy fallback.", error);
    const allRows = await loadSalesData();
    const rows = filterSalesRows(allRows,{channel:"Агрегатор",lfl});
    return {
      source:"legacy",
      rowCount:rows.length,
      snapshot:buildDashboardSnapshot(rows,{period,comparison}),
      aggregators:groupLegacy(rows,period,comparison)
    };
  }
}
