import { unstable_cache } from "next/cache";
import { availableMonths, availableYears } from "@/lib/analytics";
import { filterSalesRows } from "@/lib/filters";
import type { SalesRow } from "@/lib/data/types";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type DimensionMode = "location" | "channel" | "orderType" | "brand" | "ownership";
export type ExplorerMetric = "revenue" | "checks" | "averageCheck" | "markup" | "markupRate";
export type SortMode = "current" | "growth" | "share" | "name";

export type ExplorerQuery = {
  dimension: DimensionMode;
  metric: ExplorerMetric;
  sort: SortMode;
  year?: number;
  month?: number;
  channel?: string;
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  lfl: boolean;
};

export type ExplorerRow = {
  name: string;
  current: number;
  previous: number;
  growthValue: number | null;
  growthLabel: string;
  revenue: number;
  share: number;
  checks: number;
  averageCheck: number;
  markupRate: number;
};

export type ExplorerData = {
  source: "supabase-sql" | "legacy";
  years: number[];
  selectedYear: number;
  selectedMonth?: number;
  months: number[];
  channels: string[];
  orderTypes: string[];
  locations: string[];
  brands: string[];
  ownerships: string[];
  cutoffDate: string;
  totalMetricCurrent: number;
  totalMetricPrevious: number;
  totalGrowth: { value: number | null; label: string };
  rows: ExplorerRow[];
};

type RpcPayload = {
  meta?: {
    cutoffDate?: string;
    selectedYear?: number | string;
    selectedMonth?: number | string | null;
    years?: Array<number | string>;
    months?: Array<number | string>;
    channels?: string[];
    orderTypes?: string[];
    locations?: string[];
    brands?: string[];
    ownerships?: string[];
  };
  totals?: {
    current?: number | string;
    previous?: number | string;
    growthValue?: number | string | null;
    growthLabel?: string;
  };
  rows?: Array<{
    name?: string;
    current?: number | string;
    previous?: number | string;
    growthValue?: number | string | null;
    growthLabel?: string;
    revenue?: number | string;
    share?: number | string;
    checks?: number | string;
    averageCheck?: number | string;
    markupRate?: number | string;
  }>;
};

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function metricSet(rows: SalesRow[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const checks = rows.reduce((sum, row) => sum + row.checks, 0);
  const markup = rows.reduce((sum, row) => sum + row.markup, 0);
  return {
    revenue,
    checks,
    markup,
    averageCheck: checks > 0 ? revenue / checks : 0,
    markupRate: revenue > 0 ? markup / revenue * 100 : 0
  };
}

function metricValue(
  metrics: ReturnType<typeof metricSet>,
  metric: ExplorerMetric
): number {
  if (metric === "checks") return metrics.checks;
  if (metric === "averageCheck") return metrics.averageCheck;
  if (metric === "markup") return metrics.markup;
  if (metric === "markupRate") return metrics.markupRate;
  return metrics.revenue;
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current / previous - 1) * 100;
}

function formatGrowth(
  current: number,
  previous: number,
  metric: ExplorerMetric
): { value: number | null; label: string } {
  if (metric === "markupRate") {
    const value = current - previous;
    return {
      value,
      label: `${value >= 0 ? "+" : ""}${value.toFixed(1)} п.п.`
    };
  }

  const value = pct(current, previous);
  return {
    value,
    label: value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
  };
}

function dimensionValue(row: SalesRow, dimension: DimensionMode): string {
  if (dimension === "channel") return row.channelGroup;
  if (dimension === "orderType") return row.orderType;
  if (dimension === "brand") return row.brand;
  if (dimension === "ownership") return row.ownership;
  return row.location;
}

function periodRows(
  rows: SalesRow[],
  year: number,
  month: number | undefined,
  cutoffDate: string
): SalesRow[] {
  const cutoffMonth = Number(cutoffDate.slice(5, 7));
  const cutoffDay = Number(cutoffDate.slice(8, 10));

  return rows.filter((row) => {
    const rowYear = Number(row.date.slice(0, 4));
    const rowMonth = Number(row.date.slice(5, 7));
    const rowDay = Number(row.date.slice(8, 10));
    if (rowYear !== year) return false;
    if (month) return rowMonth === month && rowDay <= cutoffDay;
    return rowMonth < cutoffMonth || (rowMonth === cutoffMonth && rowDay <= cutoffDay);
  });
}

function resolveCutoff(rows: SalesRow[], year: number, month?: number): string {
  const candidates = rows
    .filter((row) => {
      const rowYear = Number(row.date.slice(0, 4));
      const rowMonth = Number(row.date.slice(5, 7));
      return rowYear === year && (!month || rowMonth === month);
    })
    .map((row) => row.date)
    .sort();

  if (candidates.length > 0) return candidates[candidates.length - 1];

  const fallback = rows.map((row) => row.date).sort();
  return fallback[fallback.length - 1] ?? "";
}

async function legacy(query: ExplorerQuery): Promise<ExplorerData> {
  const sourceRows = await loadSalesData();
  const years = availableYears(sourceRows);
  const selectedYear = query.year ?? years[years.length - 1];
  const filteredRows = filterSalesRows(sourceRows, {
    channel: query.channel,
    orderType: query.orderType,
    location: query.location,
    brand: query.brand,
    ownership: query.ownership,
    lfl: query.lfl
  });

  const dimensionRows = filterSalesRows(sourceRows, { lfl: query.lfl });
  const safeRows = filteredRows.length > 0 ? filteredRows : dimensionRows;
  const cutoffDate = resolveCutoff(safeRows, selectedYear, query.month);
  const previousCutoffDate = `${selectedYear - 1}${cutoffDate.slice(4)}`;
  const currentRows = periodRows(filteredRows, selectedYear, query.month, cutoffDate);
  const previousRows = periodRows(filteredRows, selectedYear - 1, query.month, previousCutoffDate);

  const currentTotal = metricSet(currentRows);
  const previousTotal = metricSet(previousRows);
  const totalMetricCurrent = metricValue(currentTotal, query.metric);
  const totalMetricPrevious = metricValue(previousTotal, query.metric);
  const totalGrowth = formatGrowth(totalMetricCurrent, totalMetricPrevious, query.metric);

  const currentMap = new Map<string, SalesRow[]>();
  const previousMap = new Map<string, SalesRow[]>();

  for (const row of currentRows) {
    const name = dimensionValue(row, query.dimension);
    currentMap.set(name, [...(currentMap.get(name) ?? []), row]);
  }
  for (const row of previousRows) {
    const name = dimensionValue(row, query.dimension);
    previousMap.set(name, [...(previousMap.get(name) ?? []), row]);
  }

  const names = [...new Set([...currentMap.keys(), ...previousMap.keys()])];
  const rows: ExplorerRow[] = names.map((name) => {
    const currentMetrics = metricSet(currentMap.get(name) ?? []);
    const previousMetrics = metricSet(previousMap.get(name) ?? []);
    const current = metricValue(currentMetrics, query.metric);
    const previous = metricValue(previousMetrics, query.metric);
    const growth = formatGrowth(current, previous, query.metric);
    return {
      name,
      current,
      previous,
      growthValue: growth.value,
      growthLabel: growth.label,
      revenue: currentMetrics.revenue,
      share: currentTotal.revenue > 0 ? currentMetrics.revenue / currentTotal.revenue * 100 : 0,
      checks: currentMetrics.checks,
      averageCheck: currentMetrics.averageCheck,
      markupRate: currentMetrics.markupRate
    };
  });

  rows.sort((a, b) => {
    if (query.sort === "name") return a.name.localeCompare(b.name, "uk");
    if (query.sort === "growth") return (b.growthValue ?? -Infinity) - (a.growthValue ?? -Infinity);
    if (query.sort === "share") return b.share - a.share;
    return b.current - a.current;
  });

  return {
    source: "legacy",
    years,
    selectedYear,
    selectedMonth: query.month,
    months: availableMonths(dimensionRows, selectedYear),
    channels: [...new Set(dimensionRows.map((row) => row.channelGroup))].sort((a,b)=>a.localeCompare(b,"uk")),
    orderTypes: [...new Set(
      dimensionRows.filter((row)=>!query.channel||row.channelGroup===query.channel).map((row)=>row.orderType)
    )].sort((a,b)=>a.localeCompare(b,"uk")),
    locations: [...new Set(dimensionRows.map((row)=>row.location))].sort((a,b)=>a.localeCompare(b,"uk")),
    brands: [...new Set(dimensionRows.map((row)=>row.brand))].sort((a,b)=>a.localeCompare(b,"uk")),
    ownerships: [...new Set(dimensionRows.map((row)=>row.ownership))].sort((a,b)=>a.localeCompare(b,"uk")),
    cutoffDate,
    totalMetricCurrent,
    totalMetricPrevious,
    totalGrowth,
    rows
  };
}

export async function loadExplorerData(query: ExplorerQuery): Promise<ExplorerData> {
  const key = JSON.stringify([
    query.dimension,
    query.metric,
    query.sort,
    query.year ?? 0,
    query.month ?? 0,
    query.channel ?? "",
    query.orderType ?? "",
    query.location ?? "",
    query.brand ?? "",
    query.ownership ?? "",
    query.lfl ? 1 : 0
  ]);

  try {
    const payload = await unstable_cache(
      () => callBiRpc<RpcPayload>("bi_explorer_payload", {
        p_dimension: query.dimension,
        p_metric: query.metric,
        p_sort: query.sort,
        p_focus_year: query.year ?? null,
        p_focus_month: query.month ?? null,
        p_channel: query.channel ?? null,
        p_order_type: query.orderType ?? null,
        p_location: query.location ?? null,
        p_brand: query.brand ?? null,
        p_ownership: query.ownership ?? null,
        p_lfl: query.lfl
      }),
      ["bi-explorer-sql-v1", key],
      { revalidate: 180, tags: ["sales-data", "explorer-data"] }
    )();

    const meta = payload.meta ?? {};
    return {
      source: "supabase-sql",
      years: (meta.years ?? []).map(num),
      selectedYear: num(meta.selectedYear),
      selectedMonth:
        meta.selectedMonth === null || meta.selectedMonth === undefined
          ? undefined
          : num(meta.selectedMonth),
      months: (meta.months ?? []).map(num),
      channels: meta.channels ?? [],
      orderTypes: meta.orderTypes ?? [],
      locations: meta.locations ?? [],
      brands: meta.brands ?? [],
      ownerships: meta.ownerships ?? [],
      cutoffDate: meta.cutoffDate ?? "",
      totalMetricCurrent: num(payload.totals?.current),
      totalMetricPrevious: num(payload.totals?.previous),
      totalGrowth: {
        value: nullableNum(payload.totals?.growthValue),
        label: payload.totals?.growthLabel ?? "—"
      },
      rows: (payload.rows ?? []).map((row) => ({
        name: row.name ?? "",
        current: num(row.current),
        previous: num(row.previous),
        growthValue: nullableNum(row.growthValue),
        growthLabel: row.growthLabel ?? "—",
        revenue: num(row.revenue),
        share: num(row.share),
        checks: num(row.checks),
        averageCheck: num(row.averageCheck),
        markupRate: num(row.markupRate)
      }))
    };
  } catch (error) {
    console.error("SQL-first Explorer failed; using legacy fallback.", error);
    return legacy(query);
  }
}
