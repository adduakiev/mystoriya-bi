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
import { LocationsComparisonChart } from "@/components/LocationsComparisonChart";
import {
  availableMonths,
  availableYears,
  buildDashboardSnapshot,
  formatUah
} from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows } from "@/lib/filters";
import type { SalesRow } from "@/lib/data/types";

const MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const nav = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, null],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, null],
  ["Data Explorer", PackageSearch, null],
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

function channelRevenue(rows: SalesRow[], channel: string): number {
  return rows
    .filter((row) => row.channelGroup === channel)
    .reduce((sum, row) => sum + row.revenue, 0);
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
    const rowYear = Number(row.date.slice(0, 4));
    const rowMonth = Number(row.date.slice(5, 7));
    const rowDay = Number(row.date.slice(8, 10));
    if (rowYear !== year) return false;

    if (month) {
      return rowMonth === month && rowDay <= cutoffDay;
    }

    if (rowMonth < cutoffMonth) return true;
    return rowMonth === cutoffMonth && rowDay <= cutoffDay;
  });
}

export default async function LocationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sourceRows = await loadSalesData();
  const years = availableYears(sourceRows);
  const selectedYear = parsePositiveInt(first(params.year)) ?? years[years.length - 1];
  const selectedMonth = parsePositiveInt(first(params.month));
  const brand = first(params.brand);
  const ownership = first(params.ownership);

  const dimensionRows = filterSalesRows(sourceRows, { brand, ownership });
  const snapshot = buildDashboardSnapshot(dimensionRows, {
    period: selectedMonth ? "month" : "ytd",
    comparison: "ly",
    focusYear: selectedYear,
    focusMonth: selectedMonth
  });

  const currentRows = periodRows(dimensionRows, selectedYear, selectedMonth, snapshot.cutoffDate);
  const previousCutoff = `${selectedYear - 1}${snapshot.cutoffDate.slice(4)}`;
  const previousRows = periodRows(dimensionRows, selectedYear - 1, selectedMonth, previousCutoff);

  const locations = [...new Set(dimensionRows.map((row) => row.location))]
    .sort((a, b) => a.localeCompare(b, "uk"));

  const locationRows = locations
    .map((location) => {
      const current = currentRows.filter((row) => row.location === location);
      const previous = previousRows.filter((row) => row.location === location);
      const total = metrics(current);
      const prior = metrics(previous);

      const venue = current.filter((row) => row.channelGroup === "Заклад");
      const venueMetrics = metrics(venue);
      const deliveryRevenue = channelRevenue(current, "Доставка");
      const aggregatorRevenue = channelRevenue(current, "Агрегатор");

      return {
        location,
        revenue: total.revenue,
        revenueGrowth: pct(total.revenue, prior.revenue),
        checks: total.checks,
        checksGrowth: pct(total.checks, prior.checks),
        averageCheck: total.averageCheck,
        markup: total.markup,
        markupRate: total.markupRate,
        venueRevenue: venueMetrics.revenue,
        venueChecks: venueMetrics.checks,
        venueAverageCheck: venueMetrics.averageCheck,
        venueMarkupRate: venueMetrics.markupRate,
        deliveryRevenue,
        deliveryShare: total.revenue > 0 ? (deliveryRevenue / total.revenue) * 100 : 0,
        aggregatorRevenue,
        aggregatorShare: total.revenue > 0 ? (aggregatorRevenue / total.revenue) * 100 : 0,
        previousRevenue: prior.revenue,
        lflEligible: total.revenue > 0 && prior.revenue > 0
      };
    })
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const lflRows = locationRows.filter((row) => row.lflEligible);
  const lflCurrentRevenue = lflRows.reduce((sum, row) => sum + row.revenue, 0);
  const lflPreviousRevenue = lflRows.reduce((sum, row) => sum + row.previousRevenue, 0);
  const lflGrowth = pct(lflCurrentRevenue, lflPreviousRevenue);

  const chartData = locationRows.map((row) => ({
    location: row.location,
    venue: row.venueRevenue,
    delivery: row.deliveryRevenue,
    aggregator: row.aggregatorRevenue
  }));

  const brands = [...new Set(sourceRows.map((row) => row.brand))].sort((a, b) => a.localeCompare(b, "uk"));
  const ownerships = [...new Set(sourceRows.map((row) => row.ownership))].sort((a, b) => a.localeCompare(b, "uk"));
  const months = availableMonths(sourceRows, selectedYear);

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
              <Link key={label} href={href} className={label === "Заклади" ? "nav-item active" : "nav-item"}>
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
          <small>{locationRows.length} активних точок у зрізі</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">LOCATIONS PERFORMANCE · LIVE</span>
            <h1>Заклади</h1>
          </div>
          <Link className="quick-mode" href="/">← Огляд</Link>
        </header>

        <details className="filter-center">
          <summary>
            <span><Filter size={15} /> Фільтри закладів</span>
            <span className="filter-summary">
              {selectedYear}{selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " · YTD"}
              {brand ? ` · ${brand}` : ""}
              {ownership ? ` · ${ownership}` : ""}
            </span>
          </summary>
          <form className="filter-form" method="get" action="/locations">
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
            <div className="filter-actions">
              <button className="apply-filter" type="submit">Застосувати</button>
              <Link className="clear-filter" href="/locations">Скинути</Link>
            </div>
          </form>
        </details>

        <div className="context-line">
          <b>{snapshot.periodLabel}</b>
          <span>cutoff {snapshot.cutoffDate}</span>
          <span>vs {selectedYear - 1}</span>
        </div>

        <section className="lfl-strip">
          <div className="lfl-card">
            <span>Зіставні точки</span>
            <strong>{lflRows.length}</strong>
            <small>є продажі в обох періодах</small>
          </div>
          <div className="lfl-card">
            <span>LFL оборот</span>
            <strong>{formatUah(lflCurrentRevenue)}</strong>
            <small>тільки зіставні точки</small>
          </div>
          <div className="lfl-card">
            <span>LFL YoY</span>
            <strong className={lflGrowth === null ? "" : lflGrowth >= 0 ? "positive" : "negative"}>
              {pctLabel(lflGrowth)}
            </strong>
            <small>vs {selectedYear - 1}</small>
          </div>
        </section>

        <section className="kpi-grid">
          {snapshot.kpis.map((item) => <KpiCard key={item.label} kpi={item} />)}
        </section>

        <section className="panel locations-ranking-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">LOCATION MIX · {selectedYear}</span>
              <h2>Оборот закладів та структура каналів</h2>
            </div>
            <span className="text-button">Заклад + Доставка + Агрегатор</span>
          </div>
          <LocationsComparisonChart data={chartData} />
        </section>

        <section className="panel locations-matrix-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">MANAGEMENT MATRIX</span>
              <h2>Порівняння закладів</h2>
            </div>
            <span className="text-button">{locationRows.length} точок · клікай на заклад для drill-down</span>
          </div>

          <div className="locations-matrix-wrap">
            <div className="locations-matrix">
              <div className="locations-matrix-row locations-matrix-head">
                <span>Заклад</span>
                <span>Оборот</span>
                <span>YoY</span>
                <span>Чеки</span>
                <span>YoY</span>
                <span>Ср. чек</span>
                <span>Націнка</span>
                <span>Націнка %</span>
                <span>Заклад Т/О</span>
                <span>Заклад чеки</span>
                <span>Заклад ср. чек</span>
                <span>Заклад націнка %</span>
                <span>Доставка Т/О</span>
                <span>Доставка %</span>
                <span>Агрегатор Т/О</span>
                <span>Агрегатор %</span>
                <span>LFL</span>
              </div>

              {locationRows.map((row) => (
                <Link
                  key={row.location}
                  className="locations-matrix-row"
                  href={`/?year=${selectedYear}${selectedMonth ? `&month=${selectedMonth}` : ""}&location=${encodeURIComponent(row.location)}`}
                >
                  <b>{row.location}</b>
                  <span>{formatUah(row.revenue)}</span>
                  <span className={row.revenueGrowth === null ? "" : row.revenueGrowth >= 0 ? "positive" : "negative"}>
                    {pctLabel(row.revenueGrowth)}
                  </span>
                  <span>{Math.round(row.checks).toLocaleString("uk-UA")}</span>
                  <span className={row.checksGrowth === null ? "" : row.checksGrowth >= 0 ? "positive" : "negative"}>
                    {pctLabel(row.checksGrowth)}
                  </span>
                  <span>{formatUah(row.averageCheck)}</span>
                  <span>{formatUah(row.markup)}</span>
                  <span>{row.markupRate.toFixed(1)}%</span>
                  <span>{formatUah(row.venueRevenue)}</span>
                  <span>{Math.round(row.venueChecks).toLocaleString("uk-UA")}</span>
                  <span>{formatUah(row.venueAverageCheck)}</span>
                  <span>{row.venueMarkupRate.toFixed(1)}%</span>
                  <span>{formatUah(row.deliveryRevenue)}</span>
                  <span>{row.deliveryShare.toFixed(1)}%</span>
                  <span>{formatUah(row.aggregatorRevenue)}</span>
                  <span>{row.aggregatorShare.toFixed(1)}%</span>
                  <span className={row.lflEligible ? "lfl-yes" : "lfl-no"}>{row.lflEligible ? "Так" : "Ні"}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
