import type {
  ChannelSummary,
  ComparisonMode,
  DashboardSnapshot,
  Kpi,
  LocationSummary,
  MetricSet,
  MonthlyManagementRow,
  PeriodMode,
  SalesRow,
  TrendPoint
} from "@/lib/data/types";

const MONTHS_UA = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const WEEKDAYS_UA = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type DateWindow = { start: Date; end: Date; label: string };

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

function kpi(label: string, value: string, delta: number | null, deltaLabel: string): Kpi {
  return {
    label,
    value,
    delta,
    deltaLabel,
    direction: delta === null || Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down"
  };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const distance = day === 0 ? 6 : day - 1;
  return addDays(date, -distance);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

function clampDay(year: number, month: number, day: number): Date {
  return utcDate(year, month, Math.min(day, endOfMonth(year, month).getUTCDate()));
}

function maxDate(rows: SalesRow[]): Date {
  const value = rows.reduce((max, row) => row.date > max ? row.date : max, rows[0].date);
  return new Date(`${value}T00:00:00Z`);
}

function resolveCutoff(rows: SalesRow[], focusYear?: number, focusMonth?: number): Date {
  const sourceCutoff = maxDate(rows);
  const year = focusYear ?? sourceCutoff.getUTCFullYear();

  const candidates = rows.filter((row) => {
    const rowYear = Number(row.date.slice(0, 4));
    const rowMonth = Number(row.date.slice(5, 7));
    return rowYear === year && (!focusMonth || rowMonth === focusMonth);
  });

  if (candidates.length === 0) return sourceCutoff;

  const available = maxDate(candidates);
  if (year < sourceCutoff.getUTCFullYear()) {
    if (focusMonth) return available;
    return available;
  }

  return available;
}

function currentWindow(cutoff: Date, period: PeriodMode, focusMonth?: number): DateWindow {
  if (period === "week") {
    return { start: startOfWeek(cutoff), end: cutoff, label: "Поточний тиждень" };
  }

  if (period === "month" || focusMonth) {
    return {
      start: utcDate(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1),
      end: cutoff,
      label: `${MONTHS_UA[cutoff.getUTCMonth()]} ${cutoff.getUTCFullYear()}`
    };
  }

  return {
    start: utcDate(cutoff.getUTCFullYear(), 0, 1),
    end: cutoff,
    label: String(cutoff.getUTCFullYear())
  };
}

function comparisonWindow(current: DateWindow, period: PeriodMode, comparison: ComparisonMode): DateWindow {
  if (comparison === "ly" || period === "ytd") {
    const start = clampDay(current.start.getUTCFullYear() - 1, current.start.getUTCMonth(), current.start.getUTCDate());
    const end = clampDay(current.end.getUTCFullYear() - 1, current.end.getUTCMonth(), current.end.getUTCDate());
    return { start, end, label: period === "ytd" ? String(current.end.getUTCFullYear() - 1) : "LY" };
  }

  if (period === "week") {
    return {
      start: addDays(current.start, -7),
      end: addDays(current.end, -7),
      label: "Попередній тиждень"
    };
  }

  const previousMonth = current.start.getUTCMonth() - 1;
  const previousMonthStart = utcDate(current.start.getUTCFullYear(), previousMonth, 1);
  const elapsed = daysBetween(current.start, current.end);
  const maxEnd = endOfMonth(previousMonthStart.getUTCFullYear(), previousMonthStart.getUTCMonth());
  const alignedEnd = addDays(previousMonthStart, elapsed);

  return {
    start: previousMonthStart,
    end: alignedEnd > maxEnd ? maxEnd : alignedEnd,
    label: "Попередній місяць"
  };
}

function between(rows: SalesRow[], window: DateWindow): SalesRow[] {
  const from = iso(window.start);
  const to = iso(window.end);
  return rows.filter((row) => row.date >= from && row.date <= to);
}

function revenueForDate(rows: SalesRow[], date: Date): number {
  const value = iso(date);
  return rows.filter((row) => row.date === value).reduce((sum, row) => sum + row.revenue, 0);
}

function monthlyRevenue(rows: SalesRow[], year: number, month: number): number {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return rows.filter((row) => row.date.startsWith(prefix)).reduce((sum, row) => sum + row.revenue, 0);
}

function buildTrend(
  rows: SalesRow[],
  current: DateWindow,
  previous: DateWindow,
  period: PeriodMode
): TrendPoint[] {
  if (period === "ytd") {
    const currentYear = current.end.getUTCFullYear();
    const previousYear = previous.end.getUTCFullYear();
    return Array.from({ length: current.end.getUTCMonth() + 1 }, (_, month) => ({
      label: MONTHS_UA[month],
      current: monthlyRevenue(rows, currentYear, month),
      previous: monthlyRevenue(rows, previousYear, month)
    }));
  }

  const length = daysBetween(current.start, current.end) + 1;
  return Array.from({ length }, (_, offset) => {
    const currentDate = addDays(current.start, offset);
    const previousDate = addDays(previous.start, offset);
    return {
      label: period === "week" ? WEEKDAYS_UA[currentDate.getUTCDay()] : String(currentDate.getUTCDate()),
      current: revenueForDate(rows, currentDate),
      previous: previousDate <= previous.end ? revenueForDate(rows, previousDate) : 0
    };
  });
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

function locationSummary(currentRows: SalesRow[], previousRows: SalesRow[]): LocationSummary[] {
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

function monthRows(rows: SalesRow[], year: number, month: number, maxDay?: number): SalesRow[] {
  return rows.filter((row) => {
    const rowYear = Number(row.date.slice(0, 4));
    const rowMonth = Number(row.date.slice(5, 7));
    const rowDay = Number(row.date.slice(8, 10));
    return rowYear === year && rowMonth === month && (!maxDay || rowDay <= maxDay);
  });
}

function channelShare(rows: SalesRow[], channel: string): number {
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  if (total === 0) return 0;
  const value = rows.filter((row) => row.channelGroup === channel).reduce((sum, row) => sum + row.revenue, 0);
  return (value / total) * 100;
}

function buildMonthlyTable(rows: SalesRow[], year: number, cutoff: Date): MonthlyManagementRow[] {
  const maxMonth = cutoff.getUTCFullYear() === year ? cutoff.getUTCMonth() + 1 : 12;

  return Array.from({ length: maxMonth }, (_, index) => {
    const month = index + 1;
    const isPartial = cutoff.getUTCFullYear() === year &&
      month === cutoff.getUTCMonth() + 1 &&
      cutoff.getUTCDate() < endOfMonth(year, index).getUTCDate();

    const maxDay = isPartial ? cutoff.getUTCDate() : undefined;
    const currentRows = monthRows(rows, year, month, maxDay);
    const previousRows = monthRows(rows, year - 1, month, maxDay);
    const current = metricSet(currentRows);
    const previous = metricSet(previousRows);

    return {
      month,
      label: MONTHS_UA[index],
      revenue: current.revenue,
      revenueGrowth: pctDelta(current.revenue, previous.revenue),
      checks: current.checks,
      checksGrowth: pctDelta(current.checks, previous.checks),
      averageCheck: current.averageCheck,
      markupRate: current.markupRate,
      venueShare: channelShare(currentRows, "Заклад"),
      aggregatorShare: channelShare(currentRows, "Агрегатор"),
      deliveryShare: channelShare(currentRows, "Доставка"),
      isPartial
    };
  });
}

function signal(current: MetricSet, previous: MetricSet, comparisonLabel: string): DashboardSnapshot["signal"] {
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

export function buildDashboardSnapshot(
  rows: SalesRow[],
  options: {
    period?: PeriodMode;
    comparison?: ComparisonMode;
    focusYear?: number;
    focusMonth?: number;
  } = {}
): DashboardSnapshot {
  if (rows.length === 0) throw new Error("No valid sales rows");

  const focusMonth = options.focusMonth;
  const period = focusMonth ? "month" : (options.period ?? "ytd");
  const comparison = options.comparison ?? "ly";
  const cutoff = resolveCutoff(rows, options.focusYear, focusMonth);
  const current = currentWindow(cutoff, period, focusMonth);
  const previous = comparisonWindow(current, period, comparison);

  const currentRows = between(rows, current);
  const previousRows = between(rows, previous);
  const currentMetrics = metricSet(currentRows);
  const previousMetrics = metricSet(previousRows);
  const deltaLabel = previous.label;

  const kpis: Kpi[] = [
    kpi("Оборот", formatCompactUah(currentMetrics.revenue), pctDelta(currentMetrics.revenue, previousMetrics.revenue), deltaLabel),
    kpi("Чеки", Math.round(currentMetrics.checks).toLocaleString("uk-UA"), pctDelta(currentMetrics.checks, previousMetrics.checks), deltaLabel),
    kpi("Середній чек", `₴ ${Math.round(currentMetrics.averageCheck).toLocaleString("uk-UA")}`, pctDelta(currentMetrics.averageCheck, previousMetrics.averageCheck), deltaLabel),
    kpi("Націнка", formatCompactUah(currentMetrics.markup), pctDelta(currentMetrics.markup, previousMetrics.markup), deltaLabel),
    kpi("Націнка %", `${currentMetrics.markupRate.toFixed(1)}%`, ppDelta(currentMetrics.markupRate, previousMetrics.markupRate), `п.п. vs ${deltaLabel}`)
  ];

  return {
    sourceRows: rows.length,
    cutoffDate: iso(cutoff),
    currentYear: cutoff.getUTCFullYear(),
    previousYear: previous.end.getUTCFullYear(),
    period,
    comparison,
    periodLabel: current.label,
    comparisonLabel: previous.label,
    current: currentMetrics,
    previous: previousMetrics,
    kpis,
    trend: buildTrend(rows, current, previous, period),
    channels: channelSummary(currentRows),
    locations: locationSummary(currentRows, previousRows),
    monthlyTable: buildMonthlyTable(rows, cutoff.getUTCFullYear(), cutoff),
    signal: signal(currentMetrics, previousMetrics, previous.label)
  };
}

export function availableYears(rows: SalesRow[]): number[] {
  return [...new Set(rows.map((row) => Number(row.date.slice(0, 4))))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export function availableMonths(rows: SalesRow[], year: number): number[] {
  return [...new Set(
    rows
      .filter((row) => Number(row.date.slice(0, 4)) === year)
      .map((row) => Number(row.date.slice(5, 7)))
  )]
    .filter((month) => month >= 1 && month <= 12)
    .sort((a, b) => a - b);
}

export function formatUah(value: number): string {
  return `₴${Math.round(value).toLocaleString("uk-UA")}`;
}


export type DashboardMetricMode = "revenue" | "checks" | "averageCheck" | "markupRate";

function metricValue(rows: SalesRow[], metric: DashboardMetricMode): number {
  const metrics = metricSet(rows);
  if (metric === "checks") return metrics.checks;
  if (metric === "averageCheck") return metrics.averageCheck;
  if (metric === "markupRate") return metrics.markupRate;
  return metrics.revenue;
}

export function buildMultiYearMetricSeries(
  rows: SalesRow[],
  years: number[],
  metric: DashboardMetricMode,
  focusMonth?: number
): Array<Record<string, string | number>> {
  if (rows.length === 0) return [];

  const sourceCutoff = maxDate(rows);
  const cutoffYear = sourceCutoff.getUTCFullYear();
  const cutoffMonth = sourceCutoff.getUTCMonth() + 1;
  const cutoffDay = sourceCutoff.getUTCDate();

  if (focusMonth) {
    const days = endOfMonth(cutoffYear, focusMonth - 1).getUTCDate();
    const maxDay = focusMonth === cutoffMonth ? cutoffDay : days;

    return Array.from({ length: maxDay }, (_, index) => {
      const day = index + 1;
      const point: Record<string, string | number> = { label: String(day) };

      years.forEach((year) => {
        const subset = rows.filter((row) => {
          const rowYear = Number(row.date.slice(0, 4));
          const rowMonth = Number(row.date.slice(5, 7));
          const rowDay = Number(row.date.slice(8, 10));
          return rowYear === year && rowMonth === focusMonth && rowDay === day;
        });
        point[String(year)] = metricValue(subset, metric);
      });

      return point;
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const point: Record<string, string | number> = { label: MONTHS_UA[index] };
    const alignedDay = month === cutoffMonth ? cutoffDay : undefined;

    years.forEach((year) => {
      const subset = monthRows(rows, year, month, alignedDay);
      point[String(year)] = metricValue(subset, metric);
    });

    return point;
  });
}

export function buildChannelMixSeries(
  rows: SalesRow[],
  year: number,
  cutoffDate: string
): Array<{ label: string; venue: number; aggregator: number; delivery: number }> {
  const cutoff = new Date(`${cutoffDate}T00:00:00Z`);
  const maxMonth = cutoff.getUTCFullYear() === year ? cutoff.getUTCMonth() + 1 : 12;

  return Array.from({ length: maxMonth }, (_, index) => {
    const month = index + 1;
    const partialDay =
      cutoff.getUTCFullYear() === year && month === cutoff.getUTCMonth() + 1
        ? cutoff.getUTCDate()
        : undefined;
    const subset = monthRows(rows, year, month, partialDay);

    return {
      label: MONTHS_UA[index],
      venue: channelShare(subset, "Заклад"),
      aggregator: channelShare(subset, "Агрегатор"),
      delivery: channelShare(subset, "Доставка")
    };
  });
}
