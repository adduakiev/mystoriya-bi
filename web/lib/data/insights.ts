import { unstable_cache } from "next/cache";
import { availableMonths, availableYears } from "@/lib/analytics";
import { filterSalesRows } from "@/lib/filters";
import { buildInsights, type InsightItem, type InsightsResult } from "@/lib/insights";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

type RawMetrics = {
  revenue?: number | string;
  checks?: number | string;
  markup?: number | string;
};

type EntitySummary = {
  name?: string;
  current?: RawMetrics;
  previous?: RawMetrics;
};

type RpcPayload = {
  meta?: {
    rowCount?: number | string;
    selectedYear?: number | string;
    selectedMonth?: number | string | null;
    cutoffDate?: string;
    previousCutoffDate?: string;
    periodLabel?: string;
    years?: Array<number | string>;
    months?: Array<number | string>;
    channels?: string[];
    orderTypes?: string[];
    locations?: string[];
    brands?: string[];
    ownerships?: string[];
  };
  current?: RawMetrics;
  previous?: RawMetrics;
  entities?: {
    locations?: EntitySummary[];
    channels?: EntitySummary[];
    orderTypes?: EntitySummary[];
  };
  monthly?: Array<{
    month?: number | string;
    currentRevenue?: number | string;
    previousRevenue?: number | string;
  }>;
};

export type InsightsQuery = {
  year?: number;
  month?: number;
  channel?: string;
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  lfl: boolean;
};

export type InsightsData = {
  source: "supabase-sql" | "legacy";
  rowCount: number;
  years: number[];
  selectedYear: number;
  selectedMonth?: number;
  months: number[];
  channels: string[];
  orderTypes: string[];
  locations: string[];
  brands: string[];
  ownerships: string[];
  result: InsightsResult;
};

type Metrics = {
  revenue: number;
  checks: number;
  markup: number;
  averageCheck: number;
  markupRate: number;
};

const MONTHS_UA = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function metrics(raw?: RawMetrics): Metrics {
  const revenue = num(raw?.revenue);
  const checks = num(raw?.checks);
  const markup = num(raw?.markup);
  return {
    revenue,
    checks,
    markup,
    averageCheck: checks > 0 ? revenue / checks : 0,
    markupRate: revenue > 0 ? markup / revenue * 100 : 0
  };
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current / previous - 1) * 100;
}

function formatUah(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}₴${(abs / 1_000_000).toFixed(1)} млн`;
  if (abs >= 1_000) return `${sign}₴${(abs / 1_000).toFixed(0)} тис.`;
  return `${sign}₴${Math.round(abs).toLocaleString("uk-UA")}`;
}

function pctLabel(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ppLabel(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} п.п.`;
}

function makeHref(
  scope: InsightItem["scope"],
  entity: string,
  year: number,
  month: number | undefined,
  lfl: boolean
): string | undefined {
  if (scope === "business") return undefined;

  const params = new URLSearchParams();
  params.set("year", String(year));
  if (month) params.set("month", String(month));
  if (lfl) params.set("lfl", "1");

  if (scope === "location") params.set("location", entity);
  if (scope === "channel") params.set("channel", entity);
  if (scope === "orderType") params.set("orderType", entity);

  return `/?${params.toString()}`;
}

function entityInsights(
  items: EntitySummary[],
  scope: "location" | "channel" | "orderType",
  totalRevenue: number,
  year: number,
  month: number | undefined,
  lfl: boolean
): { attention: InsightItem[]; wins: InsightItem[] } {
  const attention: InsightItem[] = [];
  const wins: InsightItem[] = [];

  for (const item of items) {
    const name = item.name ?? "";
    const cm = metrics(item.current);
    const pm = metrics(item.previous);
    if (cm.revenue === 0 && pm.revenue === 0) continue;

    const revenueGrowth = pct(cm.revenue, pm.revenue);
    const checksGrowth = pct(cm.checks, pm.checks);
    const aovGrowth = pct(cm.averageCheck, pm.averageCheck);
    const markupDelta = cm.markupRate - pm.markupRate;
    const delta = cm.revenue - pm.revenue;
    const share = totalRevenue > 0 ? cm.revenue / totalRevenue * 100 : 0;
    const magnitude = Math.abs(delta);
    const scoreBase = magnitude * (1 + Math.min(share, 30) / 30);

    if (revenueGrowth !== null && revenueGrowth <= -8 && (share >= 1 || pm.revenue >= 100_000)) {
      attention.push({
        id: `${scope}-revenue-down-${name}`,
        severity: revenueGrowth <= -20 ? "critical" : "warning",
        kind: "revenue",
        scope,
        entity: name,
        title: `${name}: оборот ${pctLabel(revenueGrowth)}`,
        body: `Втрачено ${formatUah(Math.abs(delta))} vs LY. Чеки ${pctLabel(checksGrowth)}, ср. чек ${pctLabel(aovGrowth)}, націнка % ${ppLabel(markupDelta)}.`,
        primaryValue: delta,
        secondaryValue: revenueGrowth,
        score: scoreBase * (1 + Math.abs(revenueGrowth) / 100),
        href: makeHref(scope, name, year, month, lfl)
      });
    }

    if (revenueGrowth !== null && revenueGrowth >= 10 && cm.revenue >= 100_000) {
      wins.push({
        id: `${scope}-revenue-up-${name}`,
        severity: "positive",
        kind: "revenue",
        scope,
        entity: name,
        title: `${name}: оборот ${pctLabel(revenueGrowth)}`,
        body: `Додано ${formatUah(delta)} vs LY. Чеки ${pctLabel(checksGrowth)}, ср. чек ${pctLabel(aovGrowth)}, націнка % ${ppLabel(markupDelta)}.`,
        primaryValue: delta,
        secondaryValue: revenueGrowth,
        score: scoreBase * (1 + Math.abs(revenueGrowth) / 100),
        href: makeHref(scope, name, year, month, lfl)
      });
    }

    if (
      revenueGrowth !== null &&
      revenueGrowth >= 0 &&
      markupDelta <= -1 &&
      cm.revenue >= 100_000
    ) {
      attention.push({
        id: `${scope}-margin-pressure-${name}`,
        severity: markupDelta <= -2 ? "critical" : "warning",
        kind: "margin",
        scope,
        entity: name,
        title: `${name}: ріст під тиском маржі`,
        body: `Оборот ${pctLabel(revenueGrowth)}, але націнка % змінилась на ${ppLabel(markupDelta)}. Перевірити промо, мікс і комісії.`,
        primaryValue: markupDelta,
        secondaryValue: revenueGrowth,
        score: cm.revenue * Math.abs(markupDelta),
        href: makeHref(scope, name, year, month, lfl)
      });
    }

    if (
      checksGrowth !== null &&
      aovGrowth !== null &&
      checksGrowth <= -10 &&
      aovGrowth >= 10 &&
      cm.revenue >= 100_000
    ) {
      attention.push({
        id: `${scope}-traffic-risk-${name}`,
        severity: "warning",
        kind: "checks",
        scope,
        entity: name,
        title: `${name}: середній чек маскує падіння чеків`,
        body: `Чеки ${pctLabel(checksGrowth)}, тоді як середній чек ${pctLabel(aovGrowth)}. Поточний оборот може триматися за рахунок ціни/міксу, а не трафіку.`,
        primaryValue: checksGrowth,
        secondaryValue: aovGrowth,
        score: cm.revenue * Math.abs(checksGrowth) / 100,
        href: makeHref(scope, name, year, month, lfl)
      });
    }
  }

  return { attention, wins };
}

function monthlyAnomalies(
  monthly: NonNullable<RpcPayload["monthly"]>,
  year: number,
  lfl: boolean
): InsightItem[] {
  const growthSeries = monthly
    .map((item) => {
      const month = num(item.month);
      const currentRevenue = num(item.currentRevenue);
      const previousRevenue = num(item.previousRevenue);
      const growth = pct(currentRevenue, previousRevenue);
      return {
        month,
        growth,
        delta: currentRevenue - previousRevenue,
        valid: growth !== null && currentRevenue > 0 && previousRevenue > 0
      };
    })
    .filter((item) => item.valid && item.growth !== null)
    .map((item) => ({
      month: item.month,
      growth: item.growth as number,
      delta: item.delta
    }));

  if (growthSeries.length < 3) return [];

  const mean = growthSeries.reduce((sum, item) => sum + item.growth, 0) / growthSeries.length;
  const variance = growthSeries.reduce(
    (sum, item) => sum + Math.pow(item.growth - mean, 2),
    0
  ) / growthSeries.length;
  const std = Math.sqrt(variance);
  if (std < 3) return [];

  return growthSeries
    .map((item): InsightItem | null => {
      const z = (item.growth - mean) / std;
      if (Math.abs(z) < 1.35) return null;

      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(item.month));
      if (lfl) params.set("lfl", "1");

      return {
        id: `month-anomaly-${year}-${item.month}`,
        severity: z < 0 ? "warning" : "positive",
        kind: "anomaly",
        scope: "business",
        entity: MONTHS_UA[item.month - 1],
        title: `${MONTHS_UA[item.month - 1]}: нетипова динаміка`,
        body: `YoY ${pctLabel(item.growth)} проти середнього ${pctLabel(mean)} за видимі місяці. Відхилення ${Math.abs(z).toFixed(1)}σ.`,
        primaryValue: item.delta,
        secondaryValue: item.growth,
        score: Math.abs(z) * Math.abs(item.delta),
        href: `/?${params.toString()}`
      };
    })
    .filter((item): item is InsightItem => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function buildFromPayload(payload: RpcPayload, year: number, month: number | undefined, lfl: boolean): InsightsResult {
  const meta = payload.meta ?? {};
  const currentMetrics = metrics(payload.current);
  const previousMetrics = metrics(payload.previous);

  const revenueGrowth = pct(currentMetrics.revenue, previousMetrics.revenue);
  const checksGrowth = pct(currentMetrics.checks, previousMetrics.checks);
  const averageCheckGrowth = pct(currentMetrics.averageCheck, previousMetrics.averageCheck);
  const markupRateDelta = currentMetrics.markupRate - previousMetrics.markupRate;

  const location = entityInsights(payload.entities?.locations ?? [], "location", currentMetrics.revenue, year, month, lfl);
  const channel = entityInsights(payload.entities?.channels ?? [], "channel", currentMetrics.revenue, year, month, lfl);
  const orderType = entityInsights(payload.entities?.orderTypes ?? [], "orderType", currentMetrics.revenue, year, month, lfl);

  const attention = [
    ...location.attention,
    ...channel.attention,
    ...orderType.attention
  ].sort((a, b) => b.score - a.score).slice(0, 10);

  const wins = [
    ...location.wins,
    ...channel.wins,
    ...orderType.wins
  ].sort((a, b) => b.score - a.score).slice(0, 10);

  const anomalies = month ? [] : monthlyAnomalies(payload.monthly ?? [], year, lfl);
  const brief: InsightItem[] = [];

  brief.push({
    id: "overall-revenue",
    severity:
      revenueGrowth === null ? "info" :
      revenueGrowth <= -8 ? "critical" :
      revenueGrowth < 0 ? "warning" :
      revenueGrowth >= 8 ? "positive" : "info",
    kind: "revenue",
    scope: "business",
    entity: "Весь бізнес",
    title: `Оборот ${pctLabel(revenueGrowth)} vs LY`,
    body: `${formatUah(currentMetrics.revenue)} за період. Чеки ${pctLabel(checksGrowth)}, середній чек ${pctLabel(averageCheckGrowth)}.`,
    primaryValue: currentMetrics.revenue - previousMetrics.revenue,
    secondaryValue: revenueGrowth,
    score: Math.abs(currentMetrics.revenue - previousMetrics.revenue)
  });

  if (Math.abs(markupRateDelta) >= 0.5) {
    brief.push({
      id: "overall-margin",
      severity: markupRateDelta < -1 ? "critical" : markupRateDelta < 0 ? "warning" : "positive",
      kind: "margin",
      scope: "business",
      entity: "Весь бізнес",
      title: `Націнка % ${ppLabel(markupRateDelta)} vs LY`,
      body: `Поточна націнка %: ${currentMetrics.markupRate.toFixed(1)}%. База LY: ${previousMetrics.markupRate.toFixed(1)}%.`,
      primaryValue: markupRateDelta,
      score: Math.abs(markupRateDelta) * currentMetrics.revenue
    });
  }

  if (
    checksGrowth !== null &&
    averageCheckGrowth !== null &&
    Math.abs(checksGrowth - averageCheckGrowth) >= 8
  ) {
    const checksDominant = Math.abs(checksGrowth) > Math.abs(averageCheckGrowth);
    brief.push({
      id: "overall-driver",
      severity: revenueGrowth !== null && revenueGrowth < 0 ? "warning" : "info",
      kind: checksDominant ? "checks" : "averageCheck",
      scope: "business",
      entity: "Весь бізнес",
      title: checksDominant
        ? "Головний драйвер — кількість чеків"
        : "Головний драйвер — середній чек",
      body: `Чеки ${pctLabel(checksGrowth)}, середній чек ${pctLabel(averageCheckGrowth)}. Саме цей розрив найбільше пояснює зміну обороту.`,
      primaryValue: checksDominant ? checksGrowth : averageCheckGrowth,
      score: Math.abs(checksGrowth - averageCheckGrowth)
    });
  }

  if (attention[0]) brief.push(attention[0]);
  if (wins[0]) brief.push(wins[0]);
  if (anomalies[0]) brief.push(anomalies[0]);

  return {
    cutoffDate: meta.cutoffDate ?? "",
    previousCutoffDate: meta.previousCutoffDate ?? "",
    currentYear: year,
    periodLabel: meta.periodLabel ?? (month ? `${MONTHS_UA[month - 1]} ${year}` : `${year} YTD`),
    overall: {
      revenue: currentMetrics.revenue,
      revenueGrowth,
      checks: currentMetrics.checks,
      checksGrowth,
      averageCheck: currentMetrics.averageCheck,
      averageCheckGrowth,
      markupRate: currentMetrics.markupRate,
      markupRateDelta
    },
    brief: brief.slice(0, 6),
    attention,
    wins,
    anomalies
  };
}

export async function loadInsightsData(query: InsightsQuery): Promise<InsightsData> {
  const key = JSON.stringify([
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
      () => callBiRpc<RpcPayload>("bi_insights_payload", {
        p_focus_year: query.year ?? null,
        p_focus_month: query.month ?? null,
        p_channel: query.channel ?? null,
        p_order_type: query.orderType ?? null,
        p_location: query.location ?? null,
        p_brand: query.brand ?? null,
        p_ownership: query.ownership ?? null,
        p_lfl: query.lfl
      }),
      ["bi-insights-sql-v1", key],
      { revalidate: 180, tags: ["sales-data", "insights-data"] }
    )();

    const meta = payload.meta ?? {};
    const selectedYear = num(meta.selectedYear);
    const selectedMonth =
      meta.selectedMonth === null || meta.selectedMonth === undefined
        ? undefined
        : num(meta.selectedMonth);

    return {
      source: "supabase-sql",
      rowCount: num(meta.rowCount),
      years: (meta.years ?? []).map(num),
      selectedYear,
      selectedMonth,
      months: (meta.months ?? []).map(num),
      channels: meta.channels ?? [],
      orderTypes: meta.orderTypes ?? [],
      locations: meta.locations ?? [],
      brands: meta.brands ?? [],
      ownerships: meta.ownerships ?? [],
      result: buildFromPayload(payload, selectedYear, selectedMonth, query.lfl)
    };
  } catch (error) {
    console.error("SQL-first Insights failed; using legacy fallback.", error);

    const sourceRows = await loadSalesData();
    const years = availableYears(sourceRows);
    const selectedYear = query.year ?? years[years.length - 1];
    const rows = filterSalesRows(sourceRows, {
      channel: query.channel,
      orderType: query.orderType,
      location: query.location,
      brand: query.brand,
      ownership: query.ownership,
      lfl: query.lfl
    });
    const dimensionRows = filterSalesRows(sourceRows, { lfl: query.lfl });

    return {
      source: "legacy",
      rowCount: rows.length,
      years,
      selectedYear,
      selectedMonth: query.month,
      months: availableMonths(dimensionRows, selectedYear),
      channels: [...new Set(dimensionRows.map((row)=>row.channelGroup))].sort((a,b)=>a.localeCompare(b,"uk")),
      orderTypes: [...new Set(
        dimensionRows.filter((row)=>!query.channel||row.channelGroup===query.channel).map((row)=>row.orderType)
      )].sort((a,b)=>a.localeCompare(b,"uk")),
      locations: [...new Set(dimensionRows.map((row)=>row.location))].sort((a,b)=>a.localeCompare(b,"uk")),
      brands: [...new Set(dimensionRows.map((row)=>row.brand))].sort((a,b)=>a.localeCompare(b,"uk")),
      ownerships: [...new Set(dimensionRows.map((row)=>row.ownership))].sort((a,b)=>a.localeCompare(b,"uk")),
      result: buildInsights(rows, {
        year: selectedYear,
        month: query.month,
        lfl: query.lfl
      })
    };
  }
}
