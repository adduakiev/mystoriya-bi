import type { SalesRow } from "@/lib/data/types";

export type InsightSeverity = "critical" | "warning" | "positive" | "info";
export type InsightKind =
  | "revenue"
  | "checks"
  | "averageCheck"
  | "margin"
  | "mix"
  | "anomaly";

export type InsightItem = {
  id: string;
  severity: InsightSeverity;
  kind: InsightKind;
  scope: "business" | "location" | "channel" | "orderType";
  entity: string;
  title: string;
  body: string;
  primaryValue: number;
  secondaryValue?: number | null;
  score: number;
  href?: string;
};

export type InsightsResult = {
  cutoffDate: string;
  previousCutoffDate: string;
  currentYear: number;
  periodLabel: string;
  overall: {
    revenue: number;
    revenueGrowth: number | null;
    checks: number;
    checksGrowth: number | null;
    averageCheck: number;
    averageCheckGrowth: number | null;
    markupRate: number;
    markupRateDelta: number;
  };
  brief: InsightItem[];
  attention: InsightItem[];
  wins: InsightItem[];
  anomalies: InsightItem[];
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

function metrics(rows: SalesRow[]): Metrics {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const checks = rows.reduce((sum, row) => sum + row.checks, 0);
  const markup = rows.reduce((sum, row) => sum + row.markup, 0);

  return {
    revenue,
    checks,
    markup,
    averageCheck: checks > 0 ? revenue / checks : 0,
    markupRate: revenue > 0 ? (markup / revenue) * 100 : 0
  };
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current / previous) - 1) * 100;
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

function maxDate(rows: SalesRow[], year: number, month?: number): string {
  const candidates = rows
    .filter((row) => {
      const y = Number(row.date.slice(0, 4));
      const m = Number(row.date.slice(5, 7));
      return y === year && (!month || m === month);
    })
    .map((row) => row.date)
    .sort();

  if (candidates.length > 0) return candidates[candidates.length - 1];

  const fallback = rows.map((row) => row.date).sort();
  return fallback[fallback.length - 1];
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
    const y = Number(row.date.slice(0, 4));
    const m = Number(row.date.slice(5, 7));
    const d = Number(row.date.slice(8, 10));
    if (y !== year) return false;

    if (month) return m === month && d <= cutoffDay;
    if (m < cutoffMonth) return true;
    return m === cutoffMonth && d <= cutoffDay;
  });
}

function groupMap(rows: SalesRow[], key: (row: SalesRow) => string): Map<string, SalesRow[]> {
  const result = new Map<string, SalesRow[]>();
  rows.forEach((row) => {
    const name = key(row);
    const group = result.get(name) ?? [];
    group.push(row);
    result.set(name, group);
  });
  return result;
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
  currentRows: SalesRow[],
  previousRows: SalesRow[],
  scope: "location" | "channel" | "orderType",
  key: (row: SalesRow) => string,
  totalRevenue: number,
  year: number,
  month: number | undefined,
  lfl: boolean
): { attention: InsightItem[]; wins: InsightItem[] } {
  const current = groupMap(currentRows, key);
  const previous = groupMap(previousRows, key);
  const names = [...new Set([...current.keys(), ...previous.keys()])];

  const attention: InsightItem[] = [];
  const wins: InsightItem[] = [];

  names.forEach((name) => {
    const cm = metrics(current.get(name) ?? []);
    const pm = metrics(previous.get(name) ?? []);
    if (cm.revenue === 0 && pm.revenue === 0) return;

    const revenueGrowth = pct(cm.revenue, pm.revenue);
    const checksGrowth = pct(cm.checks, pm.checks);
    const aovGrowth = pct(cm.averageCheck, pm.averageCheck);
    const markupDelta = cm.markupRate - pm.markupRate;
    const delta = cm.revenue - pm.revenue;
    const share = totalRevenue > 0 ? (cm.revenue / totalRevenue) * 100 : 0;
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
  });

  return { attention, wins };
}

function monthlyAnomalies(
  rows: SalesRow[],
  year: number,
  cutoffDate: string,
  lfl: boolean
): InsightItem[] {
  const cutoffMonth = Number(cutoffDate.slice(5, 7));
  const cutoffDay = Number(cutoffDate.slice(8, 10));
  const growthSeries: Array<{ month: number; growth: number; delta: number }> = [];

  for (let month = 1; month <= cutoffMonth; month += 1) {
    const alignedDay = month === cutoffMonth ? cutoffDay : 31;
    const current = metrics(rows.filter((row) => {
      return Number(row.date.slice(0, 4)) === year &&
        Number(row.date.slice(5, 7)) === month &&
        Number(row.date.slice(8, 10)) <= alignedDay;
    }));
    const previous = metrics(rows.filter((row) => {
      return Number(row.date.slice(0, 4)) === year - 1 &&
        Number(row.date.slice(5, 7)) === month &&
        Number(row.date.slice(8, 10)) <= alignedDay;
    }));

    const growth = pct(current.revenue, previous.revenue);
    if (growth !== null && current.revenue > 0 && previous.revenue > 0) {
      growthSeries.push({
        month,
        growth,
        delta: current.revenue - previous.revenue
      });
    }
  }

  if (growthSeries.length < 3) return [];

  const mean = growthSeries.reduce((sum, item) => sum + item.growth, 0) / growthSeries.length;
  const variance =
    growthSeries.reduce((sum, item) => sum + Math.pow(item.growth - mean, 2), 0) /
    growthSeries.length;
  const std = Math.sqrt(variance);

  if (std < 3) return [];

  return growthSeries
    .map((item) => {
      const z = (item.growth - mean) / std;
      if (Math.abs(z) < 1.35) return null;

      const negative = z < 0;
      const params = new URLSearchParams();
      params.set("year", String(year));
      params.set("month", String(item.month));
      if (lfl) params.set("lfl", "1");

      return {
        id: `month-anomaly-${year}-${item.month}`,
        severity: negative ? "warning" : "positive",
        kind: "anomaly",
        scope: "business",
        entity: MONTHS_UA[item.month - 1],
        title: `${MONTHS_UA[item.month - 1]}: нетипова динаміка`,
        body: `YoY ${pctLabel(item.growth)} проти середнього ${pctLabel(mean)} за видимі місяці. Відхилення ${Math.abs(z).toFixed(1)}σ.`,
        primaryValue: item.delta,
        secondaryValue: item.growth,
        score: Math.abs(z) * Math.abs(item.delta),
        href: `/?${params.toString()}`
      } satisfies InsightItem;
    })
    .filter((item): item is InsightItem => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildInsights(
  rows: SalesRow[],
  options: {
    year: number;
    month?: number;
    lfl?: boolean;
  }
): InsightsResult {
  const { year, month, lfl = false } = options;

  if (rows.length === 0) {
    return {
      cutoffDate: "",
      previousCutoffDate: "",
      currentYear: year,
      periodLabel: month ? `${MONTHS_UA[month - 1]} ${year}` : `${year} YTD`,
      overall: {
        revenue: 0,
        revenueGrowth: null,
        checks: 0,
        checksGrowth: null,
        averageCheck: 0,
        averageCheckGrowth: null,
        markupRate: 0,
        markupRateDelta: 0
      },
      brief: [],
      attention: [],
      wins: [],
      anomalies: []
    };
  }

  const cutoffDate = maxDate(rows, year, month);
  const previousCutoffDate = `${year - 1}${cutoffDate.slice(4)}`;
  const currentRows = periodRows(rows, year, month, cutoffDate);
  const previousRows = periodRows(rows, year - 1, month, previousCutoffDate);

  const currentMetrics = metrics(currentRows);
  const previousMetrics = metrics(previousRows);
  const revenueGrowth = pct(currentMetrics.revenue, previousMetrics.revenue);
  const checksGrowth = pct(currentMetrics.checks, previousMetrics.checks);
  const averageCheckGrowth = pct(currentMetrics.averageCheck, previousMetrics.averageCheck);
  const markupRateDelta = currentMetrics.markupRate - previousMetrics.markupRate;

  const location = entityInsights(
    currentRows,
    previousRows,
    "location",
    (row) => row.location,
    currentMetrics.revenue,
    year,
    month,
    lfl
  );

  const channel = entityInsights(
    currentRows,
    previousRows,
    "channel",
    (row) => row.channelGroup,
    currentMetrics.revenue,
    year,
    month,
    lfl
  );

  const orderType = entityInsights(
    currentRows,
    previousRows,
    "orderType",
    (row) => row.orderType,
    currentMetrics.revenue,
    year,
    month,
    lfl
  );

  const attention = [
    ...location.attention,
    ...channel.attention,
    ...orderType.attention
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const wins = [
    ...location.wins,
    ...channel.wins,
    ...orderType.wins
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const anomalies = month
    ? []
    : monthlyAnomalies(rows, year, cutoffDate, lfl);

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
      score: Math.abs((checksGrowth ?? 0) - (averageCheckGrowth ?? 0))
    });
  }

  const topAttention = attention[0];
  if (topAttention) brief.push(topAttention);

  const topWin = wins[0];
  if (topWin) brief.push(topWin);

  if (anomalies[0]) brief.push(anomalies[0]);

  return {
    cutoffDate,
    previousCutoffDate,
    currentYear: year,
    periodLabel: month ? `${MONTHS_UA[month - 1]} ${year}` : `${year} YTD`,
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
