import { unstable_cache } from "next/cache";
import {
  availableMonths,
  availableYears,
  buildChannelMixSeries,
  buildDashboardSnapshot,
  buildGrowthDrivers,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries
} from "@/lib/analytics";
import { filterSalesRows, type DashboardFilters, type GrainMode, type MetricMode } from "@/lib/filters";
import type {
  ComparisonMode,
  DashboardSnapshot,
  Kpi,
  MetricSet,
  PeriodMode
} from "@/lib/data/types";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type OverviewQuery = {
  channel?: string;
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  year?: number;
  month?: number;
  period: PeriodMode;
  compare: ComparisonMode;
  metric: MetricMode;
  grain: GrainMode;
  lfl: boolean;
};

export type OverviewData = {
  source: "supabase-sql" | "legacy";
  sourceRowCount: number;
  filteredRowCount: number;
  years: number[];
  selectedYear: number;
  selectedMonth?: number;
  availableMonthNumbers: number[];
  brands: string[];
  ownerships: string[];
  locations: string[];
  orderTypes: string[];
  latestSourceDate: string;
  snapshot: DashboardSnapshot;
  multiYearData: Array<Record<string, string | number>>;
  channelMixData: Array<{
    label: string;
    venue: number;
    aggregator: number;
    delivery: number;
  }>;
  growthDrivers: {
    totalDelta: number;
    checksEffect: number;
    averageCheckEffect: number;
    channelDrivers: Array<{
      name: string;
      delta: number;
      contribution: number | null;
    }>;
    locationDrivers: Array<{
      name: string;
      delta: number;
      contribution: number | null;
    }>;
  };
};

type RpcMetricSet = {
  revenue?: number | string;
  checks?: number | string;
  markup?: number | string;
  averageCheck?: number | string;
  markupRate?: number | string;
};

type RpcChannel = {
  name?: string;
  revenue?: number | string;
  checks?: number | string;
  averageCheck?: number | string;
  markupRate?: number | string;
  share?: number | string;
};

type RpcLocation = {
  name?: string;
  revenue?: number | string;
  growth?: number | string | null;
  share?: number | string;
};

type RpcMonthlyRow = {
  month?: number | string;
  label?: string;
  revenue?: number | string;
  revenueGrowth?: number | string | null;
  checks?: number | string;
  checksGrowth?: number | string | null;
  averageCheck?: number | string;
  markupRate?: number | string;
  venueShare?: number | string;
  aggregatorShare?: number | string;
  deliveryShare?: number | string;
  isPartial?: boolean;
};

type RpcDriver = {
  name?: string;
  delta?: number | string;
  contribution?: number | string | null;
};

type RpcOverviewPayload = {
  source?: string;
  meta?: {
    sourceRowCount?: number | string;
    filteredRowCount?: number | string;
    latestSourceDate?: string;
    cutoffDate?: string;
    selectedYear?: number | string;
    selectedMonth?: number | string | null;
    years?: Array<number | string>;
    availableMonths?: Array<number | string>;
    period?: PeriodMode;
    comparison?: ComparisonMode;
    periodLabel?: string;
    comparisonLabel?: string;
    currentYear?: number | string;
    previousYear?: number | string;
    brands?: string[];
    ownerships?: string[];
    locations?: string[];
    orderTypes?: string[];
  };
  current?: RpcMetricSet;
  previous?: RpcMetricSet;
  channels?: RpcChannel[];
  locations?: RpcLocation[];
  monthlyTable?: RpcMonthlyRow[];
  multiYearData?: Array<Record<string, string | number>>;
  channelMixData?: Array<{
    label?: string;
    venue?: number | string;
    aggregator?: number | string;
    delivery?: number | string;
  }>;
  growthDrivers?: {
    totalDelta?: number | string;
    checksEffect?: number | string;
    averageCheckEffect?: number | string;
    channelDrivers?: RpcDriver[];
    locationDrivers?: RpcDriver[];
  };
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function ppDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous)) return null;
  return current - previous;
}

function formatCompactUah(value: number): string {
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

function toMetricSet(raw: RpcMetricSet | undefined): MetricSet {
  return {
    revenue: num(raw?.revenue),
    checks: num(raw?.checks),
    markup: num(raw?.markup),
    averageCheck: num(raw?.averageCheck),
    markupRate: num(raw?.markupRate)
  };
}

function buildSignal(
  current: MetricSet,
  previous: MetricSet,
  comparisonLabel: string
): DashboardSnapshot["signal"] {
  const revenueGrowth = pctDelta(current.revenue, previous.revenue) ?? 0;
  const markupPp = ppDelta(current.markupRate, previous.markupRate) ?? 0;
  const checksGrowth = pctDelta(current.checks, previous.checks) ?? 0;
  const aovGrowth = pctDelta(current.averageCheck, previous.averageCheck) ?? 0;

  if (revenueGrowth > 0 && markupPp < -0.5) {
    return {
      severity: "warning",
      title: "Оборот росте швидше за націнку %",
      body: `Оборот ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}% vs ${comparisonLabel}, але націнка % змінилась на ${markupPp.toFixed(1)} п.п. Потрібна декомпозиція по каналах і локаціях.`
    };
  }

  return {
    severity: "info",
    title: revenueGrowth >= 0 ? "Позитивна динаміка" : "Період нижче бази порівняння",
    body: `Оборот: ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%. Чеки: ${checksGrowth >= 0 ? "+" : ""}${checksGrowth.toFixed(1)}%. Середній чек: ${aovGrowth >= 0 ? "+" : ""}${aovGrowth.toFixed(1)}% vs ${comparisonLabel}.`
  };
}

function buildSnapshot(payload: RpcOverviewPayload): DashboardSnapshot {
  const meta = payload.meta ?? {};
  const current = toMetricSet(payload.current);
  const previous = toMetricSet(payload.previous);
  const comparisonLabel = meta.comparisonLabel ?? "LY";

  const kpis: Kpi[] = [
    kpi(
      "Оборот",
      formatCompactUah(current.revenue),
      pctDelta(current.revenue, previous.revenue),
      comparisonLabel
    ),
    kpi(
      "Чеки",
      Math.round(current.checks).toLocaleString("uk-UA"),
      pctDelta(current.checks, previous.checks),
      comparisonLabel
    ),
    kpi(
      "Середній чек",
      `₴ ${Math.round(current.averageCheck).toLocaleString("uk-UA")}`,
      pctDelta(current.averageCheck, previous.averageCheck),
      comparisonLabel
    ),
    kpi(
      "Націнка",
      formatCompactUah(current.markup),
      pctDelta(current.markup, previous.markup),
      comparisonLabel
    ),
    kpi(
      "Націнка %",
      `${current.markupRate.toFixed(1)}%`,
      ppDelta(current.markupRate, previous.markupRate),
      `п.п. vs ${comparisonLabel}`
    )
  ];

  return {
    sourceRows: num(meta.filteredRowCount),
    cutoffDate: meta.cutoffDate ?? "",
    currentYear: num(meta.currentYear),
    previousYear: num(meta.previousYear),
    period: meta.period ?? "ytd",
    comparison: meta.comparison ?? "ly",
    periodLabel: meta.periodLabel ?? "",
    comparisonLabel,
    current,
    previous,
    kpis,
    trend: [],
    channels: (payload.channels ?? []).map((item) => ({
      name: item.name ?? "",
      share: num(item.share),
      revenue: num(item.revenue),
      checks: num(item.checks),
      averageCheck: num(item.averageCheck),
      markupRate: num(item.markupRate)
    })),
    locations: (payload.locations ?? []).map((item) => ({
      name: item.name ?? "",
      revenue: num(item.revenue),
      growth: nullableNum(item.growth),
      share: num(item.share)
    })),
    monthlyTable: (payload.monthlyTable ?? []).map((item) => ({
      month: num(item.month),
      label: item.label ?? "",
      revenue: num(item.revenue),
      revenueGrowth: nullableNum(item.revenueGrowth),
      checks: num(item.checks),
      checksGrowth: nullableNum(item.checksGrowth),
      averageCheck: num(item.averageCheck),
      markupRate: num(item.markupRate),
      venueShare: num(item.venueShare),
      aggregatorShare: num(item.aggregatorShare),
      deliveryShare: num(item.deliveryShare),
      isPartial: Boolean(item.isPartial)
    })),
    signal: buildSignal(current, previous, comparisonLabel)
  };
}

function normalizeSeries(
  input: Array<Record<string, string | number>> | undefined
): Array<Record<string, string | number>> {
  return (input ?? []).map((point) => {
    const next: Record<string, string | number> = {};
    Object.entries(point).forEach(([key, value]) => {
      next[key] = key === "label" ? String(value) : num(value);
    });
    return next;
  });
}

function normalizeDrivers(input: RpcDriver[] | undefined) {
  return (input ?? []).map((item) => ({
    name: item.name ?? "",
    delta: num(item.delta),
    contribution: nullableNum(item.contribution)
  }));
}

function rpcArgs(query: OverviewQuery): Record<string, unknown> {
  return {
    p_channel: query.channel ?? null,
    p_order_type: query.orderType ?? null,
    p_location: query.location ?? null,
    p_brand: query.brand ?? null,
    p_ownership: query.ownership ?? null,
    p_focus_year: query.year ?? null,
    p_focus_month: query.month ?? null,
    p_period: query.period,
    p_comparison: query.compare,
    p_metric: query.metric,
    p_grain: query.grain,
    p_lfl: query.lfl
  };
}

function queryCacheKey(query: OverviewQuery): string {
  return JSON.stringify([
    query.channel ?? "",
    query.orderType ?? "",
    query.location ?? "",
    query.brand ?? "",
    query.ownership ?? "",
    query.year ?? 0,
    query.month ?? 0,
    query.period,
    query.compare,
    query.metric,
    query.grain,
    query.lfl ? 1 : 0
  ]);
}

async function fetchSqlOverview(query: OverviewQuery): Promise<OverviewData> {
  const key = queryCacheKey(query);

  const payload = await unstable_cache(
    () => callBiRpc<RpcOverviewPayload>("bi_overview_payload", rpcArgs(query), 10_000),
    ["bi-overview-sql-v1", key],
    {
      revalidate: 180,
      tags: ["sales-data", "overview-data"]
    }
  )();

  const meta = payload.meta ?? {};
  const selectedYear = num(meta.selectedYear);
  const selectedMonth = meta.selectedMonth === null || meta.selectedMonth === undefined
    ? undefined
    : num(meta.selectedMonth);

  return {
    source: "supabase-sql",
    sourceRowCount: num(meta.sourceRowCount),
    filteredRowCount: num(meta.filteredRowCount),
    years: (meta.years ?? []).map(num),
    selectedYear,
    selectedMonth,
    availableMonthNumbers: (meta.availableMonths ?? []).map(num),
    brands: meta.brands ?? [],
    ownerships: meta.ownerships ?? [],
    locations: meta.locations ?? [],
    orderTypes: meta.orderTypes ?? [],
    latestSourceDate: meta.latestSourceDate ?? "",
    snapshot: buildSnapshot(payload),
    multiYearData: normalizeSeries(payload.multiYearData),
    channelMixData: (payload.channelMixData ?? []).map((item) => ({
      label: item.label ?? "",
      venue: num(item.venue),
      aggregator: num(item.aggregator),
      delivery: num(item.delivery)
    })),
    growthDrivers: {
      totalDelta: num(payload.growthDrivers?.totalDelta),
      checksEffect: num(payload.growthDrivers?.checksEffect),
      averageCheckEffect: num(payload.growthDrivers?.averageCheckEffect),
      channelDrivers: normalizeDrivers(payload.growthDrivers?.channelDrivers),
      locationDrivers: normalizeDrivers(payload.growthDrivers?.locationDrivers)
    }
  };
}

async function fetchLegacyOverview(query: OverviewQuery): Promise<OverviewData> {
  const sourceRows = await loadSalesData();
  const years = availableYears(sourceRows);
  const latestYear = years[years.length - 1];
  const selectedYear = query.year ?? latestYear;
  const selectedMonth = query.month;
  const availableMonthNumbers = availableMonths(sourceRows, selectedYear);
  const period = selectedMonth ? "month" : query.period;
  const grain = selectedMonth ? "month" : query.grain;

  const filters: DashboardFilters = {
    channel: query.channel,
    orderType: query.orderType,
    location: query.location,
    brand: query.brand,
    ownership: query.ownership,
    year: selectedYear,
    month: selectedMonth,
    period,
    compare: query.compare,
    metric: query.metric,
    grain,
    lfl: query.lfl
  };

  const rows = filterSalesRows(sourceRows, filters);
  const channelMixRows = filterSalesRows(sourceRows, {
    location: filters.location,
    brand: filters.brand,
    ownership: filters.ownership,
    lfl: query.lfl
  });

  const snapshot = buildDashboardSnapshot(rows, {
    period,
    comparison: query.compare,
    focusYear: selectedYear,
    focusMonth: selectedMonth
  });

  const dimensionRows = filterSalesRows(sourceRows, { lfl: query.lfl });
  const brands = [...new Set(dimensionRows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(dimensionRows.map((row) => row.ownership))].sort((a, b) => a.localeCompare(b, "uk"));
  const locations = [...new Set(dimensionRows.map((row) => row.location))].sort((a, b) => a.localeCompare(b, "uk"));
  const orderTypes = [...new Set(
    sourceRows
      .filter((row) => !filters.channel || row.channelGroup === filters.channel)
      .map((row) => row.orderType)
  )].sort((a, b) => a.localeCompare(b, "uk"));

  const multiYearData = grain === "week" && !selectedMonth
    ? buildMultiYearWeeklyMetricSeries(rows, years, query.metric)
    : buildMultiYearMetricSeries(rows, years, query.metric, selectedMonth);

  const latestSourceDate = sourceRows.reduce(
    (max, row) => row.date > max ? row.date : max,
    sourceRows[0].date
  );

  return {
    source: "legacy",
    sourceRowCount: sourceRows.length,
    filteredRowCount: rows.length,
    years,
    selectedYear,
    selectedMonth,
    availableMonthNumbers,
    brands,
    ownerships,
    locations,
    orderTypes,
    latestSourceDate,
    snapshot,
    multiYearData,
    channelMixData: buildChannelMixSeries(channelMixRows, selectedYear, snapshot.cutoffDate),
    growthDrivers: buildGrowthDrivers(rows, {
      period,
      comparison: query.compare,
      focusYear: selectedYear,
      focusMonth: selectedMonth
    })
  };
}

export async function loadOverviewData(query: OverviewQuery): Promise<OverviewData> {
  try {
    return await fetchSqlOverview(query);
  } catch (error) {
    console.error("SQL-first Overview failed; using legacy analytics fallback.", error);
    return fetchLegacyOverview(query);
  }
}
