import { optionalSalesDimension } from "./rpc-parameters";
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
  source: "supabase-sql" | "legacy" | "unavailable";
  rowCount: number;
  years: number[];
  series: Array<Record<string, string | number | null>>;
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

type RpcObservationPoint = {
  month?: number | string;
  counts?: Record<string, number | string | null>;
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
  series?: Array<Record<string, string | number | null>>;
  seriesObservationCounts?: RpcObservationPoint[];
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

// Observation-count metadata is optional until an approved SQL migration is deployed.
// If present it must align exactly with the chart or the RPC is unavailable.
function validObservationCounts(
  input: RpcObservationPoint[] | undefined,
  years: Array<number | string> | undefined,
  series: Array<Record<string, string | number | null>> | undefined,
  grain: GrainMode
): boolean {
  if (grain !== "month" || !Array.isArray(input) || input.length !== 12 ||
      !Array.isArray(series) || series.length !== 12 || !Array.isArray(years) || !years.length) return false;
  const keys = years.map(String);
  if (new Set(keys).size !== keys.length || keys.some((key) => !/^\d{4}$/.test(key))) return false;
  for (let index = 0; index < 12; index += 1) {
    const point = input[index];
    const plotted = series[index];
    const month = index + 1;
    if (!point || !plotted || (point.month !== month && point.month !== String(month)) ||
        !point.counts || Array.isArray(point.counts) ||
        typeof plotted.label !== "string") return false;
    const countKeys = Object.keys(point.counts);
    const seriesKeys = Object.keys(plotted).filter((key) => key !== "label");
    if (countKeys.length !== keys.length || seriesKeys.length !== keys.length ||
        keys.some((key) => !Object.hasOwn(point.counts!, key) || !Object.hasOwn(plotted, key))) return false;
    for (const key of keys) {
      const count = point.counts[key];
      if (typeof count === "number" ? !Number.isSafeInteger(count) || count < 0 :
          typeof count !== "string" || !/^(0|[1-9]\d*)$/.test(count) ||
          !Number.isSafeInteger(Number(count))) return false;
    }
  }
  return true;
}

// SQL currently emits 0 for every unobserved calendar-month grid cell.
// Future months *after the filtered source's latest observed date* are known to be
// missing, not measured zero. Other historical holes still require SQL provenance.
function normalizeSeries(
  input: Array<Record<string, string | number | null>> | undefined,
  { grain, latestYear, latestSourceDate, observationCounts }: {
    grain: GrainMode; latestYear: number; latestSourceDate: string;
    observationCounts?: RpcObservationPoint[];
  }
): Array<Record<string, string | number | null>> {
  const validCutoff = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(latestSourceDate);
  const cutoffYear = Number(latestSourceDate.slice(0, 4));
  const cutoffMonth = Number(latestSourceDate.slice(5, 7));
  const orderedMonths = grain === "month" && input?.length === 12;
  const pointValue = (value: unknown): number | null => {
    if (value === null || value === undefined ||
      (typeof value === "string" && value.trim() === "")) return null;
    if (typeof value !== "number" && typeof value !== "string") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return (input ?? []).map((point, index) => {
    const next: Record<string, string | number | null> = {};
    const futureUnobservedMonth = orderedMonths && validCutoff &&
      latestYear === cutoffYear && index + 1 > cutoffMonth;
    for (const [key, value] of Object.entries(point)) {
      next[key] = key === "label" ? String(value)
        : (observationCounts && Number(observationCounts[index].counts?.[key]) === 0) ||
          (futureUnobservedMonth && key === String(latestYear)) ? null
        : pointValue(value);
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
    series: normalizeSeries(series, { grain: query.grain, latestYear, latestSourceDate }),
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
        p_channel: optionalSalesDimension(query.channel),
        p_order_type: optionalSalesDimension(query.orderType),
        p_location: optionalSalesDimension(query.location),
        p_brand: optionalSalesDimension(query.brand),
        p_ownership: optionalSalesDimension(query.ownership),
        p_lfl: query.lfl
      }),
      ["bi-dynamics-sql-v1", key],
      { revalidate: 180, tags: ["sales-data", "dynamics-data"] }
    )();

    // The installed SQL RPC returns JSON null when a valid filter combination has
    // no matching sales: year_totals is empty, so its grouped totals CTE has no row.
    // Do not mistake an absent contract for measured zero or silently substitute
    // the Google Sheets legacy path.
    if (
      !payload || typeof payload !== "object" || Array.isArray(payload) ||
      !payload.meta || !Array.isArray(payload.meta.years) ||
      !Array.isArray(payload.series) || !payload.summary ||
      (payload.seriesObservationCounts !== undefined &&
        !validObservationCounts(payload.seriesObservationCounts, payload.meta.years, payload.series, query.grain))
    ) {
      return {
        source: "unavailable",
        rowCount: 0,
        years: [],
        series: [],
        channels: [],
        orderTypes: [],
        locations: [],
        brands: [],
        ownerships: [],
        latestYear: 0,
        latestSourceDate: "",
        latestYearTotal: 0,
        previousYearTotal: 0,
        totalGrowth: null
      };
    }

    const meta = payload.meta ?? {};
    const previousYearRaw = meta.previousYear;

    return {
      source: "supabase-sql",
      rowCount: num(meta.rowCount),
      years: (meta.years ?? []).map(num),
      series: normalizeSeries(payload.series, {
        grain: query.grain,
        latestYear: num(meta.latestYear),
        latestSourceDate: meta.latestSourceDate ?? "",
        observationCounts: payload.seriesObservationCounts
      }),
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
