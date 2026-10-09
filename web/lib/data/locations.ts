import { unstable_cache } from "next/cache";
import { buildDashboardSnapshot } from "@/lib/analytics";
import { filterSalesRows } from "@/lib/filters";
import type { DashboardSnapshot, Kpi, MetricSet, SalesRow } from "@/lib/data/types";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type LocationPerformanceRow = {
  location: string;
  revenue: number;
  revenueGrowth: number | null;
  checks: number;
  checksGrowth: number | null;
  averageCheck: number;
  markup: number;
  markupRate: number;
  venueRevenue: number;
  venueChecks: number;
  venueAverageCheck: number;
  venueMarkupRate: number;
  deliveryRevenue: number;
  deliveryShare: number;
  aggregatorRevenue: number;
  aggregatorShare: number;
  previousRevenue: number;
  lflEligible: boolean;
};

export type LocationsData = {
  source: "supabase-sql" | "legacy";
  years: number[];
  selectedYear: number;
  selectedMonth?: number;
  months: number[];
  brands: string[];
  ownerships: string[];
  snapshot: DashboardSnapshot;
  locationRows: LocationPerformanceRow[];
  lflCount: number;
  lflCurrentRevenue: number;
  lflPreviousRevenue: number;
  lflGrowth: number | null;
};

type RpcMetric = {
  revenue?: number | string;
  checks?: number | string;
  markup?: number | string;
  averageCheck?: number | string;
  markupRate?: number | string;
};

type RpcPayload = {
  meta?: {
    cutoffDate?: string;
    selectedYear?: number | string;
    selectedMonth?: number | string | null;
    years?: Array<number | string>;
    months?: Array<number | string>;
    brands?: string[];
    ownerships?: string[];
    periodLabel?: string;
    currentYear?: number | string;
    previousYear?: number | string;
  };
  current?: RpcMetric;
  previous?: RpcMetric;
  lfl?: {
    count?: number | string;
    currentRevenue?: number | string;
    previousRevenue?: number | string;
    growth?: number | string | null;
  };
  locationRows?: Array<{
    location?: string;
    revenue?: number | string;
    revenueGrowth?: number | string | null;
    checks?: number | string;
    checksGrowth?: number | string | null;
    averageCheck?: number | string;
    markup?: number | string;
    markupRate?: number | string;
    venueRevenue?: number | string;
    venueChecks?: number | string;
    venueAverageCheck?: number | string;
    venueMarkupRate?: number | string;
    deliveryRevenue?: number | string;
    deliveryShare?: number | string;
    aggregatorRevenue?: number | string;
    aggregatorShare?: number | string;
    previousRevenue?: number | string;
    lflEligible?: boolean;
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

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current / previous - 1) * 100;
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

function metricSet(raw?: RpcMetric): MetricSet {
  return {
    revenue: num(raw?.revenue),
    checks: num(raw?.checks),
    markup: num(raw?.markup),
    averageCheck: num(raw?.averageCheck),
    markupRate: num(raw?.markupRate)
  };
}

function snapshotFromRpc(payload: RpcPayload): DashboardSnapshot {
  const meta = payload.meta ?? {};
  const current = metricSet(payload.current);
  const previous = metricSet(payload.previous);
  const comparisonLabel = String(meta.previousYear ?? "");

  const revenueGrowth = pct(current.revenue, previous.revenue) ?? 0;
  const checksGrowth = pct(current.checks, previous.checks) ?? 0;
  const aovGrowth = pct(current.averageCheck, previous.averageCheck) ?? 0;
  const markupDelta = pp(current.markupRate, previous.markupRate) ?? 0;

  return {
    sourceRows: 0,
    cutoffDate: meta.cutoffDate ?? "",
    currentYear: num(meta.currentYear),
    previousYear: num(meta.previousYear),
    period: meta.selectedMonth ? "month" : "ytd",
    comparison: "ly",
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
    trend: [],
    channels: [],
    locations: [],
    monthlyTable: [],
    signal: {
      severity: revenueGrowth > 0 && markupDelta < -0.5 ? "warning" : "info",
      title: revenueGrowth >= 0 ? "Позитивна динаміка" : "Період нижче бази порівняння",
      body: `Оборот: ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%. Чеки: ${checksGrowth >= 0 ? "+" : ""}${checksGrowth.toFixed(1)}%. Середній чек: ${aovGrowth >= 0 ? "+" : ""}${aovGrowth.toFixed(1)}% vs ${comparisonLabel}.`
    }
  };
}

function metrics(rows: SalesRow[]): MetricSet {
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

function periodRows(rows: SalesRow[], year: number, month: number | undefined, cutoff: string): SalesRow[] {
  const cutoffMonth = Number(cutoff.slice(5, 7));
  const cutoffDay = Number(cutoff.slice(8, 10));
  return rows.filter((row) => {
    const y = Number(row.date.slice(0, 4));
    const m = Number(row.date.slice(5, 7));
    const d = Number(row.date.slice(8, 10));
    if (y !== year) return false;
    if (month) return m === month && d <= cutoffDay;
    return m < cutoffMonth || (m === cutoffMonth && d <= cutoffDay);
  });
}

async function legacy(
  brand: string | undefined,
  ownership: string | undefined,
  year: number | undefined,
  month: number | undefined,
  lfl: boolean
): Promise<LocationsData> {
  const sourceRows = await loadSalesData();
  const years = [...new Set(sourceRows.map((row) => Number(row.date.slice(0, 4))))].sort((a,b)=>a-b);
  const selectedYear = year ?? years[years.length - 1];
  const dimensionRows = filterSalesRows(sourceRows, { brand, ownership, lfl });
  const snapshot = buildDashboardSnapshot(dimensionRows, {
    period: month ? "month" : "ytd",
    comparison: "ly",
    focusYear: selectedYear,
    focusMonth: month
  });
  const currentRows = periodRows(dimensionRows, selectedYear, month, snapshot.cutoffDate);
  const previousRows = periodRows(dimensionRows, selectedYear - 1, month, `${selectedYear - 1}${snapshot.cutoffDate.slice(4)}`);
  const names = [...new Set(dimensionRows.map((row)=>row.location))].sort((a,b)=>a.localeCompare(b,"uk"));

  const locationRows = names.map((location)=>{
    const current=currentRows.filter((row)=>row.location===location);
    const previous=previousRows.filter((row)=>row.location===location);
    const total=metrics(current);
    const prior=metrics(previous);
    const venue=metrics(current.filter((row)=>row.channelGroup==="Заклад"));
    const deliveryRevenue=current.filter((row)=>row.channelGroup==="Доставка").reduce((s,r)=>s+r.revenue,0);
    const aggregatorRevenue=current.filter((row)=>row.channelGroup==="Агрегатор").reduce((s,r)=>s+r.revenue,0);

    return {
      location,
      revenue:total.revenue,
      revenueGrowth:pct(total.revenue,prior.revenue),
      checks:total.checks,
      checksGrowth:pct(total.checks,prior.checks),
      averageCheck:total.averageCheck,
      markup:total.markup,
      markupRate:total.markupRate,
      venueRevenue:venue.revenue,
      venueChecks:venue.checks,
      venueAverageCheck:venue.averageCheck,
      venueMarkupRate:venue.markupRate,
      deliveryRevenue,
      deliveryShare:total.revenue>0?deliveryRevenue/total.revenue*100:0,
      aggregatorRevenue,
      aggregatorShare:total.revenue>0?aggregatorRevenue/total.revenue*100:0,
      previousRevenue:prior.revenue,
      lflEligible:total.revenue>0&&prior.revenue>0
    };
  }).filter((row)=>row.revenue>0).sort((a,b)=>b.revenue-a.revenue);

  const lflRows=locationRows.filter((row)=>row.lflEligible);
  const lflCurrentRevenue=lflRows.reduce((s,r)=>s+r.revenue,0);
  const lflPreviousRevenue=lflRows.reduce((s,r)=>s+r.previousRevenue,0);
  const monthValues=[...new Set(sourceRows.filter((row)=>Number(row.date.slice(0,4))===selectedYear).map((row)=>Number(row.date.slice(5,7))))].sort((a,b)=>a-b);

  return {
    source:"legacy",
    years,selectedYear,selectedMonth:month,
    months:monthValues,
    brands:[...new Set(sourceRows.map((row)=>row.brand))].sort((a,b)=>a.localeCompare(b,"uk")),
    ownerships:[...new Set(sourceRows.map((row)=>row.ownership))].sort((a,b)=>a.localeCompare(b,"uk")),
    snapshot,
    locationRows,
    lflCount:lflRows.length,
    lflCurrentRevenue,
    lflPreviousRevenue,
    lflGrowth:pct(lflCurrentRevenue,lflPreviousRevenue)
  };
}

export async function loadLocationsData(options: {
  brand?: string;
  ownership?: string;
  year?: number;
  month?: number;
  lfl: boolean;
}): Promise<LocationsData> {
  const key=JSON.stringify([
    options.brand??"",options.ownership??"",options.year??0,options.month??0,options.lfl?1:0
  ]);

  try {
    const payload=await unstable_cache(
      ()=>callBiRpc<RpcPayload>("bi_locations_payload",{
        p_brand:options.brand??null,
        p_ownership:options.ownership??null,
        p_focus_year:options.year??null,
        p_focus_month:options.month??null,
        p_lfl:options.lfl
      }),
      ["bi-locations-sql-v1",key],
      {revalidate:180,tags:["sales-data","locations-data"]}
    )();

    const meta=payload.meta ?? {};
    return {
      source:"supabase-sql",
      years:(meta.years ?? []).map(num),
      selectedYear:num(meta.selectedYear),
      selectedMonth:meta.selectedMonth===null||meta.selectedMonth===undefined?undefined:num(meta.selectedMonth),
      months:(meta.months ?? []).map(num),
      brands:meta.brands ?? [],
      ownerships:meta.ownerships ?? [],
      snapshot:snapshotFromRpc(payload),
      locationRows:(payload.locationRows ?? []).map((row)=>({
        location:row.location ?? "",
        revenue:num(row.revenue),
        revenueGrowth:nullableNum(row.revenueGrowth),
        checks:num(row.checks),
        checksGrowth:nullableNum(row.checksGrowth),
        averageCheck:num(row.averageCheck),
        markup:num(row.markup),
        markupRate:num(row.markupRate),
        venueRevenue:num(row.venueRevenue),
        venueChecks:num(row.venueChecks),
        venueAverageCheck:num(row.venueAverageCheck),
        venueMarkupRate:num(row.venueMarkupRate),
        deliveryRevenue:num(row.deliveryRevenue),
        deliveryShare:num(row.deliveryShare),
        aggregatorRevenue:num(row.aggregatorRevenue),
        aggregatorShare:num(row.aggregatorShare),
        previousRevenue:num(row.previousRevenue),
        lflEligible:Boolean(row.lflEligible)
      })),
      lflCount:num(payload.lfl?.count),
      lflCurrentRevenue:num(payload.lfl?.currentRevenue),
      lflPreviousRevenue:num(payload.lfl?.previousRevenue),
      lflGrowth:nullableNum(payload.lfl?.growth)
    };
  } catch(error) {
    console.error("SQL-first Locations failed; using legacy fallback.",error);
    return legacy(options.brand,options.ownership,options.year,options.month,options.lfl);
  }
}
