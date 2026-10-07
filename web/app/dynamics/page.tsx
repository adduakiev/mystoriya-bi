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
import { MultiYearMetricChart } from "@/components/MultiYearMetricChart";
import {
  availableYears,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries
} from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows, type GrainMode, type MetricMode } from "@/lib/filters";

const nav = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["Data Explorer", PackageSearch, "/explorer"],
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
  return value === "checks" || value === "averageCheck" || value === "markupRate"
    ? value
    : "revenue";
}

function parseGrain(value: string | undefined): GrainMode {
  return value === "week" ? "week" : "month";
}

function buildHref(
  current: {
    metric: MetricMode;
    grain: GrainMode;
    channel?: string;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl?: boolean;
  },
  patch: Partial<{
    metric: MetricMode;
    grain: GrainMode;
    channel?: string;
    orderType?: string;
    location?: string;
    brand?: string;
    ownership?: string;
    lfl?: boolean;
  }>
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.metric !== "revenue") params.set("metric", next.metric);
  if (next.grain !== "month") params.set("grain", next.grain);
  if (next.channel) params.set("channel", next.channel);
  if (next.orderType) params.set("orderType", next.orderType);
  if (next.location) params.set("location", next.location);
  if (next.brand) params.set("brand", next.brand);
  if (next.ownership) params.set("ownership", next.ownership);
  if (next.lfl) params.set("lfl", "1");
  const query = params.toString();
  return query ? `/dynamics?${query}` : "/dynamics";
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function formatDelta(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMetric(value: number, metric: MetricMode): string {
  if (metric === "markupRate") return `${value.toFixed(1)}%`;
  if (metric === "checks") return Math.round(value).toLocaleString("uk-UA");
  if (metric === "averageCheck") return `₴${Math.round(value).toLocaleString("uk-UA")}`;
  return `₴${Math.round(value).toLocaleString("uk-UA")}`;
}

export default async function DynamicsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sourceRows = await loadSalesData();

  const metric = parseMetric(first(params.metric));
  const grain = parseGrain(first(params.grain));
  const channel = first(params.channel);
  const orderType = first(params.orderType);
  const location = first(params.location);
  const brand = first(params.brand);
  const ownership = first(params.ownership);
  const lfl = first(params.lfl) === "1";

  const state = { metric, grain, channel, orderType, location, brand, ownership, lfl };
  const rows = filterSalesRows(sourceRows, { channel, orderType, location, brand, ownership, lfl });
  const years = availableYears(rows);
  const data = grain === "week"
    ? buildMultiYearWeeklyMetricSeries(rows, years, metric)
    : buildMultiYearMetricSeries(rows, years, metric);

  const channels = [...new Set(sourceRows.map((row) => row.channelGroup))].sort((a, b) => a.localeCompare(b, "uk"));
  const orderTypes = [...new Set(
    sourceRows
      .filter((row) => !channel || row.channelGroup === channel)
      .map((row) => row.orderType)
  )].sort((a, b) => a.localeCompare(b, "uk"));
  const dimensionRows = filterSalesRows(sourceRows, { lfl });
  const locations = [...new Set(dimensionRows.map((row) => row.location))].sort((a, b) => a.localeCompare(b, "uk"));
  const brands = [...new Set(dimensionRows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(dimensionRows.map((row) => row.ownership))].sort((a, b) => a.localeCompare(b, "uk"));

  const metricLabel = METRICS.find(([value]) => value === metric)?.[1] ?? "Оборот";
  const latestYear = years[years.length - 1];
  const previousYear = years.length > 1 ? years[years.length - 2] : undefined;
  const latestSourceDate = rows.reduce((max, row) => row.date > max ? row.date : max, rows[0]?.date ?? "");
  const cutoffMonthDay = latestSourceDate.slice(4);

  const aggregateMetricForYear = (year: number): number => {
    const yearRows = rows.filter((row) => {
      const rowYear = Number(row.date.slice(0, 4));
      if (rowYear !== year) return false;
      if (year === latestYear) return row.date <= latestSourceDate;
      return row.date.slice(4) <= cutoffMonthDay;
    });

    const revenue = yearRows.reduce((sum, row) => sum + row.revenue, 0);
    const checks = yearRows.reduce((sum, row) => sum + row.checks, 0);
    const markup = yearRows.reduce((sum, row) => sum + row.markup, 0);

    if (metric === "checks") return checks;
    if (metric === "averageCheck") return checks > 0 ? revenue / checks : 0;
    if (metric === "markupRate") return revenue > 0 ? (markup / revenue) * 100 : 0;
    return revenue;
  };

  const latestYearTotal = aggregateMetricForYear(latestYear);
  const previousYearTotal = previousYear ? aggregateMetricForYear(previousYear) : 0;
  const totalGrowth = previousYear ? pct(latestYearTotal, previousYearTotal) : null;

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
                className={label === "Динаміка" ? "nav-item active" : "nav-item"}
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
          <small>{rows.length.toLocaleString("uk-UA")} рядків у зрізі</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">TREND ANALYSIS · MULTI-YEAR</span>
            <h1>Динаміка</h1>
          </div>
<div className="quick-context">
            <Link className="quick-mode" href={lfl ? "/?lfl=1" : "/"}>← Огляд</Link>
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={buildHref(state, { lfl: !lfl, location: undefined })}
            >
              LFL · активні
            </Link>
          </div>
        </header>

        <details className="filter-center" open>
          <summary>
            <span><Filter size={15} /> Фільтри динаміки</span>
            <span className="filter-summary">
              {grain === "week" ? "Тижні" : "Місяці"} · {metricLabel}
              {channel ? ` · ${channel}` : ""}
              {location ? ` · ${location}` : ""}{lfl ? " · LFL" : ""}
            </span>
          </summary>

          <form className="filter-form" method="get" action="/dynamics">
            {lfl && <input type="hidden" name="lfl" value="1" />}
            <label>
              <span>Гранулярність</span>
              <select name="grain" defaultValue={grain}>
                <option value="month">Місяці</option>
                <option value="week">Тижні</option>
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
              <span>Канал</span>
              <select name="channel" defaultValue={channel ?? ""}>
                <option value="">Всі канали</option>
                {channels.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <label>
              <span>Деталізація каналу</span>
              <select name="orderType" defaultValue={orderType ?? ""}>
                <option value="">Вся деталізація</option>
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

            <div className="filter-actions">
              <button className="apply-filter" type="submit">Застосувати</button>
              <Link className="clear-filter" href="/dynamics">Скинути</Link>
            </div>
          </form>
        </details>

        <section className="trend-summary-strip">
          <div className="trend-summary-card">
            <span>Поточний зріз</span>
            <strong>{metricLabel}</strong>
            <small>{grain === "week" ? "по тижнях" : "по місяцях"}</small>
          </div>
          <div className="trend-summary-card">
            <span>{latestYear}</span>
            <strong>{formatMetric(latestYearTotal, metric)}</strong>
            <small>сума/агрегація видимих періодів</small>
          </div>
          <div className="trend-summary-card">
            <span>YoY {previousYear ? `${latestYear} vs ${previousYear}` : ""}</span>
            <strong className={totalGrowth === null ? "" : totalGrowth >= 0 ? "positive" : "negative"}>
              {formatDelta(totalGrowth)}
            </strong>
            <small>по однаковій кількості періодів</small>
          </div>
        </section>

        <section className="panel dynamics-main-panel">
          <div className="panel-head metric-panel-head">
            <div>
              <span className="eyebrow">2024 / 2025 / 2026</span>
              <h2>{metricLabel} · {grain === "week" ? "тижнева" : "помесячна"} динаміка</h2>
            </div>

            <div className="chart-controls">
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

          {lfl && <div className="lfl-banner">LFL · закриті точки виключено з усієї динаміки</div>}
          <MultiYearMetricChart data={data} years={years} metric={metric} />
        </section>

        <section className="panel dynamics-table-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">PIVOT-LIKE VIEW</span>
              <h2>Таблиця динаміки</h2>
            </div>
            <span className="text-button">
              {grain === "week" ? "тиждень" : "місяць"} × роки × YoY
            </span>
          </div>

          <div className="dynamics-table-wrap">
            <div
              className="dynamics-table"
              style={{ minWidth: `${Math.max(760, 160 + years.length * 220)}px` }}
            >
              <div
                className="dynamics-table-row dynamics-table-head"
                style={{ gridTemplateColumns: `140px repeat(${years.length}, 130px 80px)` }}
              >
                <span>{grain === "week" ? "Тиждень" : "Місяць"}</span>
                {years.map((year, index) => (
                  <div className="dynamics-year-head" key={year}>
                    <span>{year}</span>
                    <span>{index === 0 ? "—" : "YoY"}</span>
                  </div>
                ))}
              </div>

              {data.map((point, rowIndex) => (
                <div
                  className="dynamics-table-row"
                  style={{ gridTemplateColumns: `140px repeat(${years.length}, 130px 80px)` }}
                  key={String(point.label)}
                >
                  <b>
                    {grain === "month" ? (
                      <Link
                        href={`/?year=${latestYear}&month=${rowIndex + 1}${channel ? `&channel=${encodeURIComponent(channel)}` : ""}${location ? `&location=${encodeURIComponent(location)}` : ""}`}
                      >
                        {String(point.label)}
                      </Link>
                    ) : (
                      String(point.label)
                    )}
                  </b>

                  {years.map((year, index) => {
                    const value = Number(point[String(year)] ?? 0);
                    const previous = index > 0 ? Number(point[String(years[index - 1])] ?? 0) : 0;
                    const growth = index > 0 ? pct(value, previous) : null;

                    return (
                      <div className="dynamics-value-pair" key={year}>
                        <span>{formatMetric(value, metric)}</span>
                        <span className={growth === null ? "" : growth >= 0 ? "positive" : "negative"}>
                          {index === 0 ? "—" : formatDelta(growth)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dynamics-shortcuts">
          {["Заклад", "Агрегатор", "Доставка"].map((name) => (
            <Link
              key={name}
              href={buildHref(state, {
                channel: channel === name ? undefined : name,
                orderType: undefined
              })}
              className={channel === name ? "share-card active" : "share-card"}
            >
              <span>Швидкий зріз</span>
              <strong>{name}</strong>
              <small>{channel === name ? "активний · натисни щоб скинути" : "відкрити динаміку каналу"}</small>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
