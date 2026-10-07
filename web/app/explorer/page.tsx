import Link from "next/link";
import {
  BarChart3,
  Filter,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck
} from "lucide-react";
import { ExplorerComparisonChart } from "@/components/ExplorerComparisonChart";
import { availableMonths, availableYears, formatUah } from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows } from "@/lib/filters";
import type { SalesRow } from "@/lib/data/types";

type DimensionMode = "location" | "channel" | "orderType" | "brand" | "ownership";
type ExplorerMetric = "revenue" | "checks" | "averageCheck" | "markup" | "markupRate";
type SortMode = "current" | "growth" | "share" | "name";

const MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const DIMENSIONS: Array<[DimensionMode, string]> = [
  ["location", "Заклад"],
  ["channel", "Канал"],
  ["orderType", "Тип замовлення"],
  ["brand", "Бренд"],
  ["ownership", "Власність"]
];

const METRICS: Array<[ExplorerMetric, string]> = [
  ["revenue", "Оборот"],
  ["checks", "Чеки"],
  ["averageCheck", "Середній чек"],
  ["markup", "Націнка грн"],
  ["markupRate", "Націнка %"]
];

const nav = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["Data Explorer", PackageSearch, "/explorer"],
  ["Insights", Sparkles, null]
] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDimension(value: string | undefined): DimensionMode {
  return value === "channel" ||
    value === "orderType" ||
    value === "brand" ||
    value === "ownership"
    ? value
    : "location";
}

function parseMetric(value: string | undefined): ExplorerMetric {
  return value === "checks" ||
    value === "averageCheck" ||
    value === "markup" ||
    value === "markupRate"
    ? value
    : "revenue";
}

function parseSort(value: string | undefined): SortMode {
  return value === "growth" || value === "share" || value === "name" ? value : "current";
}

function metricSet(rows: SalesRow[]) {
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
  return ((current / previous) - 1) * 100;
}

function dimensionValue(row: SalesRow, dimension: DimensionMode): string {
  if (dimension === "channel") return row.channelGroup;
  if (dimension === "orderType") return row.orderType;
  if (dimension === "brand") return row.brand;
  if (dimension === "ownership") return row.ownership;
  return row.location;
}

function currentPeriodRows(
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
    if (rowMonth < cutoffMonth) return true;
    return rowMonth === cutoffMonth && rowDay <= cutoffDay;
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
  return fallback[fallback.length - 1];
}

function formatMetric(value: number, metric: ExplorerMetric): string {
  if (metric === "markupRate") return `${value.toFixed(1)}%`;
  if (metric === "checks") return Math.round(value).toLocaleString("uk-UA");
  if (metric === "averageCheck") return formatUah(value);
  return formatUah(value);
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

function drilldownHref(
  dimension: DimensionMode,
  value: string,
  year: number,
  month: number | undefined,
  lfl: boolean
): string {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (month) params.set("month", String(month));
  if (lfl) params.set("lfl", "1");

  if (dimension === "location") params.set("location", value);
  if (dimension === "channel") params.set("channel", value);
  if (dimension === "orderType") params.set("orderType", value);
  if (dimension === "brand") params.set("brand", value);
  if (dimension === "ownership") params.set("ownership", value);

  return `/?${params.toString()}`;
}

function explorerHref(
  state: {
    dimension: DimensionMode;
    metric: ExplorerMetric;
    sort: SortMode;
    year: number;
    month?: number;
    channel?: string;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl: boolean;
  },
  patch: Partial<{
    dimension: DimensionMode;
    metric: ExplorerMetric;
    sort: SortMode;
    year: number;
    month?: number;
    channel?: string;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl: boolean;
  }>
): string {
  const next = { ...state, ...patch };
  const params = new URLSearchParams();
  params.set("dimension", next.dimension);
  params.set("metric", next.metric);
  if (next.sort !== "current") params.set("sort", next.sort);
  params.set("year", String(next.year));
  if (next.month) params.set("month", String(next.month));
  if (next.channel) params.set("channel", next.channel);
  if (next.orderType) params.set("orderType", next.orderType);
  if (next.location) params.set("location", next.location);
  if (next.brand) params.set("brand", next.brand);
  if (next.ownership) params.set("ownership", next.ownership);
  if (next.lfl) params.set("lfl", "1");
  return `/explorer?${params.toString()}`;
}

export default async function ExplorerPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sourceRows = await loadSalesData();

  const dimension = parseDimension(first(params.dimension));
  const metric = parseMetric(first(params.metric));
  const sort = parseSort(first(params.sort));
  const lfl = first(params.lfl) === "1";

  const years = availableYears(sourceRows);
  const selectedYear = parsePositiveInt(first(params.year)) ?? years[years.length - 1];
  const selectedMonth = parsePositiveInt(first(params.month));

  const channel = first(params.channel);
  const orderType = first(params.orderType);
  const location = first(params.location);
  const brand = first(params.brand);
  const ownership = first(params.ownership);

  const state = {
    dimension,
    metric,
    sort,
    year: selectedYear,
    month: selectedMonth,
    channel,
    orderType,
    location,
    brand,
    ownership,
    lfl
  };

  const filteredRows = filterSalesRows(sourceRows, {
    channel,
    orderType,
    location,
    brand,
    ownership,
    lfl
  });

  const safeRows = filteredRows.length > 0 ? filteredRows : filterSalesRows(sourceRows, { lfl });
  const cutoffDate = resolveCutoff(safeRows, selectedYear, selectedMonth);
  const previousCutoffDate = `${selectedYear - 1}${cutoffDate.slice(4)}`;

  const currentRows = currentPeriodRows(filteredRows, selectedYear, selectedMonth, cutoffDate);
  const previousRows = currentPeriodRows(
    filteredRows,
    selectedYear - 1,
    selectedMonth,
    previousCutoffDate
  );

  const currentTotal = metricSet(currentRows);
  const previousTotal = metricSet(previousRows);
  const totalMetricCurrent = metricValue(currentTotal, metric);
  const totalMetricPrevious = metricValue(previousTotal, metric);
  const totalGrowth = formatGrowth(totalMetricCurrent, totalMetricPrevious, metric);

  const currentMap = new Map<string, SalesRow[]>();
  const previousMap = new Map<string, SalesRow[]>();

  currentRows.forEach((row) => {
    const key = dimensionValue(row, dimension);
    const group = currentMap.get(key) ?? [];
    group.push(row);
    currentMap.set(key, group);
  });

  previousRows.forEach((row) => {
    const key = dimensionValue(row, dimension);
    const group = previousMap.get(key) ?? [];
    group.push(row);
    previousMap.set(key, group);
  });

  const keys = [...new Set([...currentMap.keys(), ...previousMap.keys()])];
  const explorerRows = keys.map((name) => {
    const currentMetrics = metricSet(currentMap.get(name) ?? []);
    const previousMetrics = metricSet(previousMap.get(name) ?? []);
    const current = metricValue(currentMetrics, metric);
    const previous = metricValue(previousMetrics, metric);
    const growth = formatGrowth(current, previous, metric);

    return {
      name,
      current,
      previous,
      growthValue: growth.value,
      growthLabel: growth.label,
      revenue: currentMetrics.revenue,
      share: currentTotal.revenue > 0
        ? (currentMetrics.revenue / currentTotal.revenue) * 100
        : 0,
      checks: currentMetrics.checks,
      averageCheck: currentMetrics.averageCheck,
      markupRate: currentMetrics.markupRate
    };
  });

  explorerRows.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "uk");
    if (sort === "growth") return (b.growthValue ?? -Infinity) - (a.growthValue ?? -Infinity);
    if (sort === "share") return b.share - a.share;
    return b.current - a.current;
  });

  const chartData = explorerRows
    .slice()
    .sort((a, b) => b.current - a.current)
    .slice(0, 15)
    .map((row) => ({
      name: row.name,
      current: row.current,
      previous: row.previous
    }));

  const dimensionRows = filterSalesRows(sourceRows, { lfl });
  const months = availableMonths(dimensionRows, selectedYear);
  const channels = [...new Set(dimensionRows.map((row) => row.channelGroup))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const orderTypes = [...new Set(
    dimensionRows
      .filter((row) => !channel || row.channelGroup === channel)
      .map((row) => row.orderType)
  )].sort((a, b) => a.localeCompare(b, "uk"));
  const locations = [...new Set(dimensionRows.map((row) => row.location))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const brands = [...new Set(dimensionRows.map((row) => row.brand))]
    .sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(dimensionRows.map((row) => row.ownership))]
    .sort((a, b) => a.localeCompare(b, "uk"));

  const dimensionLabel = DIMENSIONS.find(([value]) => value === dimension)?.[1] ?? "Заклад";
  const metricLabel = METRICS.find(([value]) => value === metric)?.[1] ?? "Оборот";

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <b>М'ЯСТОРІЯ</b>
            <span>CONTROL CENTER</span>
          </div>
        </div>

        <nav>
          {nav.map(([label, Icon, href]) =>
            href ? (
              <Link
                key={label}
                href={lfl ? `${href}${href.includes("?") ? "&" : "?"}lfl=1` : href}
                className={label === "Data Explorer" ? "nav-item active" : "nav-item"}
              >
                <Icon size={18} />
                {label}
              </Link>
            ) : (
              <span key={label} className="nav-item nav-disabled">
                <Icon size={18} />
                {label}
              </span>
            )
          )}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          Live data connected
          <small>{explorerRows.length} груп у поточному зрізі</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AD-HOC ANALYSIS · PIVOT-LIKE</span>
            <h1>Data Explorer</h1>
          </div>

          <div className="quick-context">
            <Link className="quick-mode" href={lfl ? "/?lfl=1" : "/"}>← Огляд</Link>
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={explorerHref(state, { lfl: !lfl, location: undefined })}
            >
              LFL · активні
            </Link>
          </div>
        </header>

        <details className="filter-center" open>
          <summary>
            <span><Filter size={15} /> Конструктор звіту</span>
            <span className="filter-summary">
              {dimensionLabel} · {metricLabel} · {selectedYear}
              {selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " · YTD"}
              {lfl ? " · LFL" : ""}
            </span>
          </summary>

          <form className="filter-form explorer-filter-form" method="get" action="/explorer">
            {lfl && <input type="hidden" name="lfl" value="1" />}

            <label>
              <span>Рядки / вимір</span>
              <select name="dimension" defaultValue={dimension}>
                {DIMENSIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Показник</span>
              <select name="metric" defaultValue={metric}>
                {METRICS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Рік</span>
              <select name="year" defaultValue={String(selectedYear)}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>

            <label>
              <span>Місяць</span>
              <select name="month" defaultValue={selectedMonth ? String(selectedMonth) : ""}>
                <option value="">YTD / весь рік</option>
                {months.map((month) => (
                  <option key={month} value={month}>{MONTHS[month - 1]}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Канал</span>
              <select name="channel" defaultValue={channel ?? ""}>
                <option value="">Всі канали</option>
                {channels.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Тип замовлення</span>
              <select name="orderType" defaultValue={orderType ?? ""}>
                <option value="">Всі типи</option>
                {orderTypes.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Бренд</span>
              <select name="brand" defaultValue={brand ?? ""}>
                <option value="">Всі бренди</option>
                {brands.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Власність</span>
              <select name="ownership" defaultValue={ownership ?? ""}>
                <option value="">Вся власність</option>
                {ownerships.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label className="wide-filter">
              <span>Заклад</span>
              <select name="location" defaultValue={location ?? ""}>
                <option value="">Всі заклади</option>
                {locations.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Сортування</span>
              <select name="sort" defaultValue={sort}>
                <option value="current">За поточним значенням</option>
                <option value="growth">За динамікою YoY</option>
                <option value="share">За часткою обороту</option>
                <option value="name">За назвою</option>
              </select>
            </label>

            <div className="filter-actions">
              <button className="apply-filter" type="submit">Побудувати</button>
              <Link className="clear-filter" href="/explorer">Скинути</Link>
            </div>
          </form>
        </details>

        <div className="context-line">
          <b>{selectedYear}{selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " YTD"}</b>
          <span>cutoff {cutoffDate}</span>
          <span>vs {selectedYear - 1}</span>
          <span>{dimensionLabel}</span>
          <span>{metricLabel}</span>
          {lfl && <span className="lfl-context">LFL · активна мережа</span>}
        </div>

        <section className="trend-summary-strip">
          <div className="trend-summary-card">
            <span>Груп у звіті</span>
            <strong>{explorerRows.length}</strong>
            <small>{dimensionLabel.toLowerCase()}</small>
          </div>

          <div className="trend-summary-card">
            <span>{metricLabel} · {selectedYear}</span>
            <strong>{formatMetric(totalMetricCurrent, metric)}</strong>
            <small>{selectedMonth ? MONTHS[selectedMonth - 1] : "YTD"}</small>
          </div>

          <div className="trend-summary-card">
            <span>vs {selectedYear - 1}</span>
            <strong className={totalGrowth.value === null ? "" : totalGrowth.value >= 0 ? "positive" : "negative"}>
              {totalGrowth.label}
            </strong>
            <small>{formatMetric(totalMetricPrevious, metric)} база</small>
          </div>
        </section>

        <section className="panel explorer-chart-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">TOP 15 · CURRENT VS LY</span>
              <h2>{metricLabel} за виміром «{dimensionLabel}»</h2>
            </div>
            <span className="text-button">однаковий cutoff</span>
          </div>
          <ExplorerComparisonChart data={chartData} metric={metric} />
        </section>

        <section className="panel explorer-table-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">PIVOT TABLE</span>
              <h2>{dimensionLabel} · детальна таблиця</h2>
            </div>
            <span className="text-button">{explorerRows.length} рядків · клік = drill-down</span>
          </div>

          <div className="explorer-table-wrap">
            <div className="explorer-table">
              <div className="explorer-row explorer-head">
                <span>{dimensionLabel}</span>
                <span>{metricLabel} {selectedYear}</span>
                <span>{metricLabel} {selectedYear - 1}</span>
                <span>Δ YoY</span>
                <span>Частка Т/О</span>
                <span>Оборот</span>
                <span>Чеки</span>
                <span>Ср. чек</span>
                <span>Націнка %</span>
              </div>

              {explorerRows.map((row) => (
                <Link
                  key={row.name}
                  className="explorer-row"
                  href={drilldownHref(
                    dimension,
                    row.name,
                    selectedYear,
                    selectedMonth,
                    lfl
                  )}
                >
                  <b>{row.name}</b>
                  <span>{formatMetric(row.current, metric)}</span>
                  <span>{formatMetric(row.previous, metric)}</span>
                  <span className={row.growthValue === null ? "" : row.growthValue >= 0 ? "positive" : "negative"}>
                    {row.growthLabel}
                  </span>
                  <span>{row.share.toFixed(1)}%</span>
                  <span>{formatUah(row.revenue)}</span>
                  <span>{Math.round(row.checks).toLocaleString("uk-UA")}</span>
                  <span>{formatUah(row.averageCheck)}</span>
                  <span>{row.markupRate.toFixed(1)}%</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="explorer-shortcuts">
          {DIMENSIONS.map(([value, label]) => (
            <Link
              key={value}
              href={explorerHref(state, { dimension: value })}
              className={dimension === value ? "metric-pill active" : "metric-pill"}
            >
              {label}
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
