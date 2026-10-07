import type {
  ChannelSummary,
  DashboardSnapshot,
  Kpi,
  LocationSummary,
  MetricSet,
  SalesRow,
  TrendPoint
} from "@/lib/data/types";

const MONTHS_UA = [
  "Січ", "Лют", "Бер", "Кві", "Тра", "Чер",
  "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"
];

function metricSet(rows: SalesRow[]): MetricSet {
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

function kpi(
  label: string,
  value: string,
  delta: number | null,
  deltaLabel: string
): Kpi {
  return {
    label,
    value,
    delta,
    deltaLabel,
    direction: delta === null || Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down"
  };
}

function dateAtUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function between(rows: SalesRow[], start: Date, end: Date): SalesRow[] {
  const from = iso(start);
  const to = iso(end);
  return rows.filter((row) => row.date >= from && row.date <= to);
}

function monthTotal(rows: SalesRow[], year: number, month: number): number {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return rows
    .filter((row) => row.date.startsWith(prefix))
    .reduce((sum, row) => sum + row.revenue, 0);
}

function channelSummary(rows: SalesRow[]): ChannelSummary[] {
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const groups = new Map<string, SalesRow[]>();

  rows.forEach((row) => {
    const current = groups.get(row.channelGroup) ?? [];
    current.push(row);
    groups.set(row.channelGroup, current);
  });

  return [...groups.entries()]
    .map(([name, group]) => {
      const metrics = metricSet(group);
      return {
        name,
        share: totalRevenue > 0 ? (metrics.revenue / totalRevenue) * 100 : 0,
        revenue: metrics.revenue,
        checks: metrics.checks,
        averageCheck: metrics.averageCheck,
        markupRate: metrics.markupRate
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function locationSummary(
  currentRows: SalesRow[],
  previousRows: SalesRow[]
): LocationSummary[] {
  const totalCurrent = currentRows.reduce((sum, row) => sum + row.revenue, 0);
  const current = new Map<string, number>();
  const previous = new Map<string, number>();

  currentRows.forEach((row) => current.set(row.location, (current.get(row.location) ?? 0) + row.revenue));
  previousRows.forEach((row) => previous.set(row.location, (previous.get(row.location) ?? 0) + row.revenue));

  return [...current.entries()]
    .map(([name, revenue]) => ({
      name,
      revenue,
      growth: pctDelta(revenue, previous.get(name) ?? 0),
      share: totalCurrent > 0 ? (revenue / totalCurrent) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

function buildTrend(
  rows: SalesRow[],
  currentYear: number,
  previousYear: number,
  cutoffMonth: number
): TrendPoint[] {
  return Array.from({ length: cutoffMonth + 1 }, (_, month) => ({
    month: MONTHS_UA[month],
    current: monthTotal(rows, currentYear, month),
    previous: monthTotal(rows, previousYear, month)
  }));
}

function signal(current: MetricSet, previous: MetricSet): DashboardSnapshot["signal"] {
  const revenueGrowth = pctDelta(current.revenue, previous.revenue) ?? 0;
  const markupPp = ppDelta(current.markupRate, previous.markupRate) ?? 0;
  const checksGrowth = pctDelta(current.checks, previous.checks) ?? 0;
  const aovGrowth = pctDelta(current.averageCheck, previous.averageCheck) ?? 0;

  if (revenueGrowth > 0 && markupPp < -0.5) {
    return {
      severity: "warning",
      title: "Оборот росте швидше за націнку %",
      body: `Оборот ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}% YoY, але націнка % змінилась на ${markupPp.toFixed(1)} п.п. Варто декомпозувати ефект по каналах і локаціях.`
    };
  }

  return {
    severity: "info",
    title: revenueGrowth >= 0 ? "Позитивна динаміка YTD" : "YTD нижче минулого року",
    body: `Оборот: ${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}% YoY. Чеки: ${checksGrowth >= 0 ? "+" : ""}${checksGrowth.toFixed(1)}%. Середній чек: ${aovGrowth >= 0 ? "+" : ""}${aovGrowth.toFixed(1)}%.`
  };
}

export function buildDashboardSnapshot(rows: SalesRow[]): DashboardSnapshot {
  if (rows.length === 0) throw new Error("No valid sales rows");

  const cutoffDate = rows.reduce((max, row) => row.date > max ? row.date : max, rows[0].date);
  const cutoff = new Date(`${cutoffDate}T00:00:00Z`);
  const currentYear = cutoff.getUTCFullYear();
  const previousYear = currentYear - 1;

  const currentStart = dateAtUtc(currentYear, 0, 1);
  const previousStart = dateAtUtc(previousYear, 0, 1);
  const previousCutoff = dateAtUtc(previousYear, cutoff.getUTCMonth(), cutoff.getUTCDate());

  const currentRows = between(rows, currentStart, cutoff);
  const previousRows = between(rows, previousStart, previousCutoff);

  const current = metricSet(currentRows);
  const previous = metricSet(previousRows);

  const kpis: Kpi[] = [
    kpi("Оборот", formatCompactUah(current.revenue), pctDelta(current.revenue, previous.revenue), "YoY"),
    kpi("Чеки", Math.round(current.checks).toLocaleString("uk-UA"), pctDelta(current.checks, previous.checks), "YoY"),
    kpi("Середній чек", `₴ ${Math.round(current.averageCheck).toLocaleString("uk-UA")}`, pctDelta(current.averageCheck, previous.averageCheck), "YoY"),
    kpi("Націнка", formatCompactUah(current.markup), pctDelta(current.markup, previous.markup), "YoY"),
    kpi("Націнка %", `${current.markupRate.toFixed(1)}%`, ppDelta(current.markupRate, previous.markupRate), "п.п. YoY")
  ];

  return {
    sourceRows: rows.length,
    cutoffDate,
    currentYear,
    previousYear,
    current,
    previous,
    kpis,
    trend: buildTrend(rows, currentYear, previousYear, cutoff.getUTCMonth()),
    channels: channelSummary(currentRows),
    locations: locationSummary(currentRows, previousRows),
    signal: signal(current, previous)
  };
}

export function formatUah(value: number): string {
  return `₴${Math.round(value).toLocaleString("uk-UA")}`;
}
