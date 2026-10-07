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
import { KpiCard } from "@/components/KpiCard";
import { MultiYearMetricChart } from "@/components/MultiYearMetricChart";
import { DeliveryVsAggregatorChart } from "@/components/DeliveryVsAggregatorChart";
import {
  availableMonths,
  availableYears,
  buildDashboardSnapshot,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries,
  formatUah
} from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows, type GrainMode, type MetricMode } from "@/lib/filters";
import type { SalesRow } from "@/lib/data/types";

const MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const nav = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["Data Explorer", PackageSearch, null],
  ["Insights", Sparkles, null]
] as const;

const METRICS: Array<[MetricMode, string]> = [
  ["revenue", "Оборот"],
  ["checks", "Чеки"],
  ["averageCheck", "Середній чек"],
  ["markupRate", "Націнка %"]
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseMetric(value: string | undefined): MetricMode {
  return value === "checks" || value === "averageCheck" || value === "markupRate" ? value : "revenue";
}

function parseGrain(value: string | undefined): GrainMode {
  return value === "week" ? "week" : "month";
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function metrics(rows: SalesRow[]) {
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

function pctLabel(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function periodRows(rows: SalesRow[], year: number, month: number | undefined, cutoffDate: string): SalesRow[] {
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

function monthRevenue(rows: SalesRow[], year: number, month: number, maxDay?: number): number {
  return rows
    .filter((row) => {
      const rowYear = Number(row.date.slice(0, 4));
      const rowMonth = Number(row.date.slice(5, 7));
      const rowDay = Number(row.date.slice(8, 10));
      return rowYear === year && rowMonth === month && (!maxDay || rowDay <= maxDay);
    })
    .reduce((sum, row) => sum + row.revenue, 0);
}

function buildHref(
  current: {
    year: number;
    month?: number;
    metric: MetricMode;
    grain: GrainMode;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl?: boolean;
  },
  patch: Partial<{
    year: number;
    month?: number;
    metric: MetricMode;
    grain: GrainMode;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl?: boolean;
  }>
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  params.set("year", String(next.year));
  if (next.month) params.set("month", String(next.month));
  if (next.metric !== "revenue") params.set("metric", next.metric);
  if (next.grain !== "month") params.set("grain", next.grain);
  if (next.orderType) params.set("orderType", next.orderType);
  if (next.location) params.set("location", next.location);
  if (next.brand) params.set("brand", next.brand);
  if (next.ownership) params.set("ownership", next.ownership);
  if (next.lfl) params.set("lfl", "1");
  return `/delivery?${params.toString()}`;
}

export default async function DeliveryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sourceRows = await loadSalesData();
  const years = availableYears(sourceRows);
  const latestYear = years[years.length - 1];
  const selectedYear = parsePositiveInt(first(params.year)) ?? latestYear;
  const selectedMonth = parsePositiveInt(first(params.month));
  const metric = parseMetric(first(params.metric));
  const grain = selectedMonth ? "month" : parseGrain(first(params.grain));
  const orderType = first(params.orderType);
  const location = first(params.location);
  const brand = first(params.brand);
  const ownership = first(params.ownership);
  const lfl = first(params.lfl) === "1";

  const deliveryBase = filterSalesRows(sourceRows, {
    channel: "Доставка",
    orderType,
    location,
    brand,
    ownership,
    lfl
  });

  const deliveryAllTypes = filterSalesRows(sourceRows, {
    channel: "Доставка",
    location,
    brand,
    ownership
  });

  const aggregatorBase = filterSalesRows(sourceRows, {
    channel: "Агрегатор",
    location,
    brand,
    ownership,
    lfl
  });

  const snapshot = buildDashboardSnapshot(deliveryBase, {
    period: selectedMonth ? "month" : "ytd",
    comparison: "ly",
    focusYear: selectedYear,
    focusMonth: selectedMonth
  });

  const state = { year: selectedYear, month: selectedMonth, metric, grain, orderType, location, brand, ownership, lfl };
  const months = availableMonths(deliveryBase, selectedYear);
  const deliveryTypes = [...new Set(deliveryAllTypes.map((row) => row.orderType))].sort((a, b) => a.localeCompare(b, "uk"));
  const dimensionRows = filterSalesRows(sourceRows, { lfl });
  const locations = [...new Set(dimensionRows.map((row) => row.location))].sort((a, b) => a.localeCompare(b, "uk"));
  const brands = [...new Set(dimensionRows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(dimensionRows.map((row) => row.ownership))].sort((a, b) => a.localeCompare(b, "uk"));

  const multiYearData = grain === "week" && !selectedMonth
    ? buildMultiYearWeeklyMetricSeries(deliveryBase, years, metric)
    : buildMultiYearMetricSeries(deliveryBase, years, metric, selectedMonth);

  const currentRows = periodRows(deliveryBase, selectedYear, selectedMonth, snapshot.cutoffDate);
  const previousCutoff = `${selectedYear - 1}${snapshot.cutoffDate.slice(4)}`;
  const previousRows = periodRows(deliveryBase, selectedYear - 1, selectedMonth, previousCutoff);

  const currentAllDeliveryRows = periodRows(deliveryAllTypes, selectedYear, selectedMonth, snapshot.cutoffDate);
  const totalDeliveryRevenue = currentAllDeliveryRows.reduce((sum, row) => sum + row.revenue, 0);

  const typeSummary = deliveryTypes
    .map((name) => {
      const rows = currentAllDeliveryRows.filter((row) => row.orderType === name);
      const m = metrics(rows);
      return {
        name,
        ...m,
        share: totalDeliveryRevenue > 0 ? (m.revenue / totalDeliveryRevenue) * 100 : 0
      };
    })
    .filter((item) => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const currentAggregatorRows = periodRows(aggregatorBase, selectedYear, selectedMonth, snapshot.cutoffDate);
  const deliveryMetrics = metrics(currentAllDeliveryRows);
  const aggregatorMetrics = metrics(currentAggregatorRows);
  const ownVsAggregatorRatio = aggregatorMetrics.revenue > 0
    ? (deliveryMetrics.revenue / aggregatorMetrics.revenue) * 100
    : 0;

  const maxMonth = selectedMonth ?? Number(snapshot.cutoffDate.slice(5, 7));
  const cutoffDay = Number(snapshot.cutoffDate.slice(8, 10));
  const compareSeries = Array.from({ length: selectedMonth ? 1 : maxMonth }, (_, index) => {
    const month = selectedMonth ?? index + 1;
    const alignedDay = month === Number(snapshot.cutoffDate.slice(5, 7)) ? cutoffDay : undefined;
    return {
      label: MONTHS[month - 1].slice(0, 3),
      delivery: monthRevenue(deliveryAllTypes, selectedYear, month, alignedDay),
      aggregator: monthRevenue(aggregatorBase, selectedYear, month, alignedDay)
    };
  });

  const allPeriodRows = periodRows(
    filterSalesRows(sourceRows, { location, brand, ownership, lfl }),
    selectedYear,
    selectedMonth,
    snapshot.cutoffDate
  );

  const locationNames = [...new Set(currentAllDeliveryRows.map((row) => row.location))];
  const locationRows = locationNames
    .map((name) => {
      const current = currentAllDeliveryRows.filter((row) => row.location === name);
      const previous = previousRows.filter((row) => row.location === name);
      const all = allPeriodRows.filter((row) => row.location === name);
      const dm = metrics(current);
      const pm = metrics(previous);
      const totalLocationRevenue = all.reduce((sum, row) => sum + row.revenue, 0);
      const aggregatorRevenue = all
        .filter((row) => row.channelGroup === "Агрегатор")
        .reduce((sum, row) => sum + row.revenue, 0);

      return {
        name,
        revenue: dm.revenue,
        growth: pct(dm.revenue, pm.revenue),
        checks: dm.checks,
        averageCheck: dm.averageCheck,
        markupRate: dm.markupRate,
        deliveryShare: totalLocationRevenue > 0 ? (dm.revenue / totalLocationRevenue) * 100 : 0,
        aggregatorRevenue,
        versusAggregator: aggregatorRevenue > 0 ? (dm.revenue / aggregatorRevenue) * 100 : 0
      };
    })
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

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
                href={href}
                className={label === "Доставка" ? "nav-item active" : "nav-item"}
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
          <small>{currentAllDeliveryRows.length.toLocaleString("uk-UA")} delivery rows</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">OWN DELIVERY · LIVE</span>
            <h1>Доставка</h1>
          </div>
<div className="quick-context">
            <Link className="quick-mode" href="/">← Огляд</Link>
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={buildHref(state, { lfl: !lfl, location: undefined })}
            >
              LFL · активні
            </Link>
          </div>
        </header>

        <details className="filter-center">
          <summary>
            <span><Filter size={15} /> Фільтри доставки</span>
            <span className="filter-summary">
              {selectedYear}{selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " · YTD"}
              {orderType ? ` · ${orderType}` : ""}
              {location ? ` · ${location}` : ""}{lfl ? " · LFL" : ""}
            </span>
          </summary>

          <form className="filter-form" method="get" action="/delivery">
            {lfl && <input type="hidden" name="lfl" value="1" />}
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
                {months.map((month) => <option key={month} value={month}>{MONTHS[month - 1]}</option>)}
              </select>
            </label>

            <label>
              <span>Тип доставки</span>
              <select name="orderType" defaultValue={orderType ?? ""}>
                <option value="">Вся доставка</option>
                {deliveryTypes.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Показник графіка</span>
              <select name="metric" defaultValue={metric}>
                {METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label>
              <span>Гранулярність</span>
              <select name="grain" defaultValue={grain}>
                <option value="month">Місяці</option>
                <option value="week">Тижні</option>
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

            <label>
              <span>Заклад</span>
              <select name="location" defaultValue={location ?? ""}>
                <option value="">Всі заклади</option>
                {locations.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <div className="filter-actions">
              <button className="apply-filter" type="submit">Застосувати</button>
              <Link className="clear-filter" href="/delivery">Скинути</Link>
            </div>
          </form>
        </details>

        <div className="context-line">
          <b>{snapshot.periodLabel}</b>
          <span>cutoff {snapshot.cutoffDate}</span>
          <span>vs {selectedYear - 1}</span>
          {orderType && <span>{orderType}</span>}
          {lfl && <span className="lfl-context">LFL · активна мережа</span>}
        </div>

        <section className="kpi-grid">
          {snapshot.kpis.map((item) => <KpiCard key={item.label} kpi={item} />)}
        </section>

        <section className="delivery-benchmark-strip">
          <div className="trend-summary-card">
            <span>Доставка</span>
            <strong>{formatUah(deliveryMetrics.revenue)}</strong>
            <small>{Math.round(deliveryMetrics.checks).toLocaleString("uk-UA")} чеків</small>
          </div>
          <div className="trend-summary-card">
            <span>Агрегатори</span>
            <strong>{formatUah(aggregatorMetrics.revenue)}</strong>
            <small>{Math.round(aggregatorMetrics.checks).toLocaleString("uk-UA")} чеків</small>
          </div>
          <div className="trend-summary-card">
            <span>Доставка / Агрегатори</span>
            <strong>{ownVsAggregatorRatio.toFixed(1)}%</strong>
            <small>співвідношення обороту</small>
          </div>
        </section>

        <section className="delivery-type-grid">
          {typeSummary.map((item) => (
            <Link
              href={buildHref(state, {
                orderType: orderType === item.name ? undefined : item.name
              })}
              key={item.name}
              className={orderType === item.name ? "delivery-type-card active" : "delivery-type-card"}
            >
              <span>{item.name}</span>
              <strong>{item.share.toFixed(1)}%</strong>
              <small>{formatUah(item.revenue)} · {Math.round(item.checks).toLocaleString("uk-UA")} чеків</small>
            </Link>
          ))}
        </section>

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head metric-panel-head">
              <div>
                <span className="eyebrow">OWN DELIVERY · MULTI-YEAR</span>
                <h2>{METRICS.find(([value]) => value === metric)?.[1] ?? "Оборот"}</h2>
              </div>
              <div className="chart-controls">
                {!selectedMonth && (
                  <div className="metric-switcher grain-switcher">
                    {([
                      ["month", "Місяці"],
                      ["week", "Тижні"]
                    ] as const).map(([value, label]) => (
                      <Link
                        key={value}
                        className={grain === value ? "metric-pill active" : "metric-pill"}
                        href={buildHref(state, { grain: value })}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="metric-switcher">
                  {METRICS.map(([value, label]) => (
                    <Link
                      key={value}
                      className={metric === value ? "metric-pill active" : "metric-pill"}
                      href={buildHref(state, { metric: value })}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <MultiYearMetricChart data={multiYearData} years={years} metric={metric} />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">DELIVERY TYPES</span>
                <h2>Структура доставки</h2>
              </div>
            </div>
            <div className="aggregator-stack">
              {typeSummary.map((item) => (
                <div className="aggregator-card" key={item.name}>
                  <div className="aggregator-card-head">
                    <div>
                      <b>{item.name}</b>
                      <span>{item.share.toFixed(1)}% від доставки</span>
                    </div>
                    <strong>{formatUah(item.revenue)}</strong>
                  </div>
                  <div className="aggregator-metrics">
                    <span>Чеки <b>{Math.round(item.checks).toLocaleString("uk-UA")}</b></span>
                    <span>Ср. чек <b>{formatUah(item.averageCheck)}</b></span>
                    <span>Націнка % <b>{item.markupRate.toFixed(1)}%</b></span>
                    <span>Частка <b>{item.share.toFixed(1)}%</b></span>
                  </div>
                  <div className="track"><span style={{ width: `${Math.min(item.share, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="panel delivery-vs-aggregator-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">OWN VS MARKETPLACE · {selectedYear}</span>
              <h2>Доставка vs Агрегатори</h2>
            </div>
            <span className="text-button">оборот по однаковому cutoff</span>
          </div>
          <DeliveryVsAggregatorChart data={compareSeries} />
        </section>

        <section className="panel delivery-locations-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">LOCATIONS · DELIVERY PERFORMANCE</span>
              <h2>Заклади по доставці</h2>
            </div>
            <span className="text-button">{locationRows.length} точок</span>
          </div>

          <div className="delivery-table-wrap">
            <div className="delivery-table">
              <div className="delivery-table-row delivery-table-head">
                <span>Заклад</span>
                <span>Т/О доставка</span>
                <span>YoY</span>
                <span>Чеки</span>
                <span>Ср. чек</span>
                <span>Націнка %</span>
                <span>Частка доставки</span>
                <span>Агрегатори Т/О</span>
                <span>Дост./Агр.</span>
              </div>

              {locationRows.map((row) => (
                <Link
                  key={row.name}
                  href={`/?year=${selectedYear}${selectedMonth ? `&month=${selectedMonth}` : ""}&channel=Доставка&location=${encodeURIComponent(row.name)}`}
                  className="delivery-table-row"
                >
                  <b>{row.name}</b>
                  <span>{formatUah(row.revenue)}</span>
                  <span className={row.growth === null ? "" : row.growth >= 0 ? "positive" : "negative"}>
                    {pctLabel(row.growth)}
                  </span>
                  <span>{Math.round(row.checks).toLocaleString("uk-UA")}</span>
                  <span>{formatUah(row.averageCheck)}</span>
                  <span>{row.markupRate.toFixed(1)}%</span>
                  <span>{row.deliveryShare.toFixed(1)}%</span>
                  <span>{formatUah(row.aggregatorRevenue)}</span>
                  <span>{row.versusAggregator.toFixed(1)}%</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
