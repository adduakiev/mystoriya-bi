import { unstable_cache } from "next/cache";
import {
  availableYears,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries
} from "@/lib/analytics";
import { filterSalesRows, type GrainMode, type MetricMode } from "@/lib/filters";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type DynamicsQuery = {
  metric: MetricMode;
  grain: GrainMode;
  channel?: string;
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  lfl: boolean;
};

export type DynamicsData = {
  source: "supabase-sql" | "legacy";
  rowCount: number;
  years: number[];
  series: Array<Record<string, string | number>>;
  channels: string[];
  orderTypes: string[];
  locations: string[];
  brands: string[];
  ownerships: string[];
  latestYear: number;
  previousYear?: number;
  latestSourceDate: string;
  latestYearTotal: number;
  previousYearTotal: number;
  totalGrowth: number | null;
};

type RpcPayload = {
  meta?: {
    rowCount?: number | string;
    latestSourceDate?: string;
    years?: Array<number | string>;
    latestYear?: number | string;
    previousYear?: number | string | null;
    channels?: string[];
    orderTypes?: string[];
    locations?: string[];
    brands?: string[];
    ownerships?: string[];
  };
  series?: Array<Record<string, string | number>>;
  summary?: {
    latestYearTotal?: number | string;
    previousYearTotal?: number | string;
    growth?: number | string | null;
  };
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

function normalizeSeries(
  input: Array<Record<string, string | number>> | undefined
): Array<Record<string, string | number>> {
  return (input ?? []).map((point) => {
    const next: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(point)) {
      next[key] = key === "label" ? String(value) : num(value);
    }
    return next;
  });
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current / previous - 1) * 100;
}

async function legacy(query: DynamicsQuery): Promise<DynamicsData> {
  const sourceRows = await loadSalesData();
  const rows = filterSalesRows(sourceRows, {
    channel: query.channel,
    orderType: query.orderType,
    location: query.location,
    brand: query.brand,
    ownership: query.ownership,
    lfl: query.lfl
  });

  const years = availableYears(rows);
  const series = query.grain === "week"
    ? buildMultiYearWeeklyMetricSeries(rows, years, query.metric)
    : buildMultiYearMetricSeries(rows, years, query.metric);

  const dimensionRows = filterSalesRows(sourceRows, { lfl: query.lfl });
  const channels = [...new Set(dimensionRows.map((row) => row.channelGroup))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const orderTypes = [...new Set(
    dimensionRows
      .filter((row) => !query.channel || row.channelGroup === query.channel)
      .map((row) => row.orderType)
  )].sort((a, b) => a.localeCompare(b, "uk"));
  const locations = [...new Set(dimensionRows.map((row) => row.location))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const brands = [...new Set(dimensionRows.map((row) => row.brand))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(dimensionRows.map((row) => row.ownership))]
    .sort((a, b) => a.localeCompare(b, "uk"));

  const latestYear = years[years.length - 1] ?? 0;
  const previousYear = years.length > 1 ? years[years.length - 2] : undefined;
  const latestSourceDate = rows.reduce(
    (max, row) => row.date > max ? row.date : max,
    rows[0]?.date ?? ""
  );
  const cutoffMonthDay = latestSourceDate.slice(4);

  const aggregate = (year: number): number => {
    const yearRows = rows.filter((row) => {
      const rowYear = Number(row.date.slice(0, 4));
      if (rowYear !== year) return false;
      if (year === latestYear) return row.date <= latestSourceDate;
      return row.date.slice(4) <= cutoffMonthDay;
    });

    const revenue = yearRows.reduce((sum, row) => sum + row.revenue, 0);
    const checks = yearRows.reduce((sum, row) => sum + row.checks, 0);
    const markup = yearRows.reduce((sum, row) => sum + row.markup, 0);

    if (query.metric === "checks") return checks;
    if (query.metric === "averageCheck") return checks > 0 ? revenue / checks : 0;
    if (query.metric === "markupRate") return revenue > 0 ? markup / revenue * 100 : 0;
    return revenue;
  };

  const latestYearTotal = latestYear ? aggregate(latestYear) : 0;
  const previousYearTotal = previousYear ? aggregate(previousYear) : 0;
  const totalGrowth = previousYear
    ? query.metric === "markupRate"
      ? latestYearTotal - previousYearTotal
      : pct(latestYearTotal, previousYearTotal)
    : null;

  return {
    source: "legacy",
    rowCount: rows.length,
    years,
    series,
    channels,
    orderTypes,
    locations,
    brands,
    ownerships,
    latestYear,
    previousYear,
    latestSourceDate,
    latestYearTotal,
    previousYearTotal,
    totalGrowth
  };
}

export async function loadDynamicsData(query: DynamicsQuery): Promise<DynamicsData> {
  const key = JSON.stringify([
    query.metric,
    query.grain,
    query.channel ?? "",
    query.orderType ?? "",
    query.location ?? "",
    query.brand ?? "",
    query.ownership ?? "",
    query.lfl ? 1 : 0
  ]);

  try {
    const payload = await unstable_cache(
      () => callBiRpc<RpcPayload>("bi_dynamics_payload", {
        p_metric: query.metric,
        p_grain: query.grain,
        p_channel: query.channel ?? null,
        p_order_type: query.orderType ?? null,
        p_location: query.location ?? null,
        p_brand: query.brand ?? null,
        p_ownership: query.ownership ?? null,
        p_lfl: query.lfl
      }),
      ["bi-dynamics-sql-v1", key],
      { revalidate: 180, tags: ["sales-data", "dynamics-data"] }
    )();

    const meta = payload.meta ?? {};
    const previousYearRaw = meta.previousYear;

    return {
      source: "supabase-sql",
      rowCount: num(meta.rowCount),
      years: (meta.years ?? []).map(num),
      series: normalizeSeries(payload.series),
      channels: meta.channels ?? [],
      orderTypes: meta.orderTypes ?? [],
      locations: meta.locations ?? [],
      brands: meta.brands ?? [],
      ownerships: meta.ownerships ?? [],
      latestYear: num(meta.latestYear),
      previousYear:
        previousYearRaw === null || previousYearRaw === undefined
          ? undefined
          : num(previousYearRaw),
      latestSourceDate: meta.latestSourceDate ?? "",
      latestYearTotal: num(payload.summary?.latestYearTotal),
      previousYearTotal: num(payload.summary?.previousYearTotal),
      totalGrowth: nullableNum(payload.summary?.growth)
    };
  } catch (error) {
    console.error("SQL-first Dynamics failed; using legacy fallback.", error);
    return legacy(query);
  }
}
