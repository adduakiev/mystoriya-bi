import Link from "next/link";
import {
  BarChart3,
  Filter,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck,
  X
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { MultiYearMetricChart } from "@/components/MultiYearMetricChart";
import { ChannelMixChart } from "@/components/ChannelMixChart";
import {
  availableMonths,
  availableYears,
  buildDashboardSnapshot,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries,
  buildChannelMixSeries,
  formatUah
} from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows, queryHref, type DashboardFilters, type MetricMode, type GrainMode } from "@/lib/filters";
import type { ComparisonMode, PeriodMode } from "@/lib/data/types";

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

function prettyDate(value: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePeriod(value: string | undefined): PeriodMode {
  return value === "month" || value === "week" ? value : "ytd";
}

function parseCompare(value: string | undefined): ComparisonMode {
  return value === "previous" ? "previous" : "ly";
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

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function Home({
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
  const availableMonthNumbers = availableMonths(sourceRows, selectedYear);
  const period = selectedMonth ? "month" : parsePeriod(first(params.period));
  const compare = parseCompare(first(params.compare));
  const metric = parseMetric(first(params.metric));
  const grain = selectedMonth ? "month" : parseGrain(first(params.grain));

  const filters: DashboardFilters = {
    channel: first(params.channel),
    orderType: first(params.orderType),
    location: first(params.location),
    brand: first(params.brand),
    ownership: first(params.ownership),
    year: selectedYear,
    month: selectedMonth,
    period,
    compare,
    metric,
    grain
  };

  const rows = filterSalesRows(sourceRows, filters);
  const channelMixRows = filterSalesRows(sourceRows, {
    location: filters.location,
    brand: filters.brand,
    ownership: filters.ownership
  });
  const snapshot = buildDashboardSnapshot(rows, {
    period,
    comparison: compare,
    focusYear: selectedYear,
    focusMonth: selectedMonth
  });

  const brands = [...new Set(sourceRows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(sourceRows.map((row) => row.ownership))].sort((a, b) => a.localeCompare(b, "uk"));
  const locations = [...new Set(sourceRows.map((row) => row.location))].sort((a, b) => a.localeCompare(b, "uk"));
  const orderTypes = [...new Set(
    sourceRows
      .filter((row) => !filters.channel || row.channelGroup === filters.channel)
      .map((row) => row.orderType)
  )].sort((a, b) => a.localeCompare(b, "uk"));

  const activeDimensionFilters = [
    filters.channel,
    filters.orderType,
    filters.location,
    filters.brand,
    filters.ownership
  ].filter(Boolean).length;

  const multiYearData = grain === "week" && !selectedMonth
    ? buildMultiYearWeeklyMetricSeries(rows, years, metric)
    : buildMultiYearMetricSeries(rows, years, metric, selectedMonth);
  const channelMixData = buildChannelMixSeries(channelMixRows, selectedYear, snapshot.cutoffDate);
  const metricLabels: Record<MetricMode, string> = {
    revenue: "Оборот",
    checks: "Чеки",
    averageCheck: "Середній чек",
    markupRate: "Націнка %"
  };

  const latestSourceDate = sourceRows.reduce((max, row) => row.date > max ? row.date : max, sourceRows[0].date);
  const latestMonth = Number(latestSourceDate.slice(5, 7));
  const latestSourceYear = Number(latestSourceDate.slice(0, 4));

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
          {nav.map(([label, Icon, href], i) =>
            href ? (
              <Link key={label} href={href} className={i === 0 ? "nav-item active" : "nav-item"}>
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
          <small>{rows.length.toLocaleString("uk-UA")} / {sourceRows.length.toLocaleString("uk-UA")} rows</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">BUSINESS PERFORMANCE · LIVE</span>
            <h1>Огляд</h1>
          </div>

          <div className="quick-context">
            <Link
              className={!selectedMonth && selectedYear === latestSourceYear ? "quick-mode active" : "quick-mode"}
              href={queryHref(filters, {
                year: latestSourceYear,
                month: undefined,
                period: "ytd"
              })}
            >
              {latestSourceYear} YTD
            </Link>
            <Link
              className={selectedMonth === latestMonth && selectedYear === latestSourceYear ? "quick-mode active" : "quick-mode"}
              href={queryHref(filters, {
                year: latestSourceYear,
                month: latestMonth,
                period: "month"
              })}
            >
              {MONTHS[latestMonth - 1]} MTD
            </Link>
          </div>
        </header>

        <details className="filter-center">
          <summary>
            <span><Filter size={15} /> Фільтри</span>
            <span className="filter-summary">
              {selectedYear}{selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " · весь рік"}
              {activeDimensionFilters > 0 ? ` · +${activeDimensionFilters} зрізи` : ""}
            </span>
          </summary>

          <form className="filter-form" method="get" action="/">
            <label>
              <span>Рік</span>
              <select name="year" defaultValue={String(selectedYear)}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>

            <label>
              <span>Місяць</span>
              <select name="month" defaultValue={selectedMonth ? String(selectedMonth) : ""}>
                <option value="">Весь рік</option>
                {availableMonthNumbers.map((month) => (
                  <option key={month} value={month}>{MONTHS[month - 1]}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Канал</span>
              <select name="channel" defaultValue={filters.channel ?? ""}>
                <option value="">Всі канали</option>
                <option value="Заклад">Заклад</option>
                <option value="Агрегатор">Агрегатор</option>
                <option value="Доставка">Доставка</option>
              </select>
            </label>

            <label>
              <span>Деталізація каналу</span>
              <select name="orderType" defaultValue={filters.orderType ?? ""}>
                <option value="">Вся деталізація</option>
                {orderTypes.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Бренд</span>
              <select name="brand" defaultValue={filters.brand ?? ""}>
                <option value="">Всі бренди</option>
                {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </label>

            <label>
              <span>Власність</span>
              <select name="ownership" defaultValue={filters.ownership ?? ""}>
                <option value="">Вся власність</option>
                {ownerships.map((ownership) => <option key={ownership} value={ownership}>{ownership}</option>)}
              </select>
            </label>

            <label className="wide-filter">
              <span>Локація</span>
              <select name="location" defaultValue={filters.location ?? ""}>
                <option value="">Всі локації</option>
                {locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </select>
            </label>

            <label>
              <span>Порівняння</span>
              <select name="compare" defaultValue={compare}>
                <option value="ly">Минулого року</option>
                <option value="previous">Попередній період</option>
              </select>
            </label>

            <div className="filter-actions">
              <button className="apply-filter" type="submit">Застосувати</button>
              <Link className="clear-filter" href="/">Скинути все</Link>
            </div>
          </form>
        </details>

        <div className="context-line">
          <b>{snapshot.periodLabel}</b>
          <span>cutoff {prettyDate(snapshot.cutoffDate)}</span>
          <span>vs {snapshot.comparisonLabel}</span>
          {filters.channel && <span>{filters.channel}</span>}
          {filters.orderType && <span>{filters.orderType}</span>}
        </div>

        {activeDimensionFilters > 0 && (
          <div className="active-filters">
            <span className="eyebrow">ACTIVE VIEW</span>
            {filters.channel && <span className="filter-chip">Канал: {filters.channel}</span>}
            {filters.orderType && <span className="filter-chip">Тип: {filters.orderType}</span>}
            {filters.location && <span className="filter-chip">Локація: {filters.location}</span>}
            {filters.brand && <span className="filter-chip">Бренд: {filters.brand}</span>}
            {filters.ownership && <span className="filter-chip">Власність: {filters.ownership}</span>}
            <Link
              className="reset-filter"
              href={queryHref(filters, {
                channel: undefined,
                orderType: undefined,
                location: undefined,
                brand: undefined,
                ownership: undefined
              })}
            >
              <X size={13} /> Скинути зріз
            </Link>
          </div>
        )}

        <section className="kpi-grid">
          {snapshot.kpis.map((item) => <KpiCard key={item.label} kpi={item} />)}
        </section>

        <section className="share-strip">
          {["Заклад", "Агрегатор", "Доставка"].map((name) => {
            const item = snapshot.channels.find((channel) => channel.name === name);
            return (
              <Link
                key={name}
                className={filters.channel === name ? "share-card active" : "share-card"}
                href={queryHref(filters, {
                  channel: filters.channel === name ? undefined : name,
                  orderType: undefined
                })}
              >
                <span>{name}</span>
                <strong>{item ? `${item.share.toFixed(1)}%` : "0.0%"}</strong>
                <small>{item ? formatUah(item.revenue) : "₴0"}</small>
              </Link>
            );
          })}
        </section>

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head metric-panel-head">
              <div>
                <span className="eyebrow">MULTI-YEAR DYNAMICS · {grain === "week" && !selectedMonth ? "ТИЖНІ" : selectedMonth ? "ДНІ" : "МІСЯЦІ"} · 2024–2026</span>
                <h2>{metricLabels[metric]}</h2>
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
                        href={queryHref(filters, { grain: value })}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="metric-switcher">
                  {([
                    ["revenue", "Оборот"],
                    ["checks", "Чеки"],
                    ["averageCheck", "Ср. чек"],
                    ["markupRate", "Націнка %"]
                  ] as const).map(([value, label]) => (
                    <Link
                      key={value}
                      className={metric === value ? "metric-pill active" : "metric-pill"}
                      href={queryHref(filters, { metric: value })}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <MultiYearMetricChart
              data={multiYearData}
              years={years}
              metric={metric}
            />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">STRUCTURE</span>
                <h2>Канали продажів</h2>
              </div>
            </div>
            <div className="channel-list">
              {snapshot.channels.map((channel) => (
                <Link
                  className="channel-row"
                  key={channel.name}
                  href={queryHref(filters, {
                    channel: filters.channel === channel.name ? undefined : channel.name,
                    orderType: undefined
                  })}
                >
                  <div>
                    <b>{channel.name}</b>
                    <span>{formatUah(channel.revenue)} · {Math.round(channel.checks).toLocaleString("uk-UA")} чеків · ср. чек {formatUah(channel.averageCheck)}</span>
                  </div>
                  <div className="share">{channel.share.toFixed(1)}%</div>
                  <div className="track"><span style={{ width: `${Math.min(channel.share, 100)}%` }} /></div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="panel channel-mix-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">CHANNEL MIX · {selectedYear}</span>
              <h2>Як змінюється структура продажів</h2>
            </div>
            <span className="text-button">100% · Заклад / Агрегатор / Доставка</span>
          </div>
          <ChannelMixChart data={channelMixData} />
        </section>

        {!selectedMonth && period === "ytd" && (
          <section className="panel management-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">MONTHLY MANAGEMENT VIEW · {selectedYear}</span>
                <h2>Помесячна управлінська таблиця</h2>
              </div>
              <span className="text-button">YoY + структура каналів</span>
            </div>

            <div className="management-table-wrap">
              <div className="management-table">
                <div className="management-row management-head">
                  <span>Місяць</span>
                  <span>Оборот</span>
                  <span>YoY</span>
                  <span>Чеки</span>
                  <span>YoY</span>
                  <span>Ср. чек</span>
                  <span>Націнка %</span>
                  <span>Заклад %</span>
                  <span>Агр. %</span>
                  <span>Доставка %</span>
                </div>

                {snapshot.monthlyTable.map((row) => (
                  <Link
                    key={row.month}
                    href={queryHref(filters, { month: row.month, period: "month" })}
                    className="management-row"
                  >
                    <b>{row.label}{row.isPartial ? " *" : ""}</b>
                    <span>{formatUah(row.revenue)}</span>
                    <span className={row.revenueGrowth === null ? "" : row.revenueGrowth >= 0 ? "positive" : "negative"}>
                      {formatPct(row.revenueGrowth)}
                    </span>
                    <span>{Math.round(row.checks).toLocaleString("uk-UA")}</span>
                    <span className={row.checksGrowth === null ? "" : row.checksGrowth >= 0 ? "positive" : "negative"}>
                      {formatPct(row.checksGrowth)}
                    </span>
                    <span>{formatUah(row.averageCheck)}</span>
                    <span>{row.markupRate.toFixed(1)}%</span>
                    <span>{row.venueShare.toFixed(1)}%</span>
                    <span>{row.aggregatorShare.toFixed(1)}%</span>
                    <span>{row.deliveryShare.toFixed(1)}%</span>
                  </Link>
                ))}
              </div>
            </div>
            <small className="table-note">* неповний місяць — порівняння вирівняне по тому самому cutoff.</small>
          </section>
        )}

        <section className="content-grid lower">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LOCATIONS · {snapshot.periodLabel.toUpperCase()}</span>
                <h2>Внесок точок</h2>
              </div>
              {filters.location ? (
                <Link className="text-button" href={queryHref(filters, { location: undefined })}>Всі локації →</Link>
              ) : (
                <span className="text-button">TOP {snapshot.locations.length}</span>
              )}
            </div>

            <div className="location-table">
              <div className="table-row table-head">
                <span>Локація</span><span>Оборот</span><span>Δ</span><span>Частка</span>
              </div>
              {snapshot.locations.map((location) => (
                <Link
                  className="table-row"
                  key={location.name}
                  href={queryHref(filters, {
                    location: filters.location === location.name ? undefined : location.name
                  })}
                >
                  <b>{location.name}</b>
                  <span>{formatUah(location.revenue)}</span>
                  <span className={location.growth === null ? "" : location.growth >= 0 ? "positive" : "negative"}>
                    {formatPct(location.growth)}
                  </span>
                  <span>{location.share.toFixed(1)}%</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="panel insight-panel">
            <span className="eyebrow">LIVE SIGNAL</span>
            <h2>Що потребує уваги</h2>
            <div className="signal">
              <span className="signal-badge">1</span>
              <div>
                <b>{snapshot.signal.title}</b>
                <p>{snapshot.signal.body}</p>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
