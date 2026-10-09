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
import type { LucideIcon } from "lucide-react";
import { SidebarBrand } from "@/components/SidebarBrand";
import { KpiCard } from "@/components/KpiCard";
import { LocationsComparisonChart } from "@/components/LocationsComparisonChart";
import { formatUah } from "@/lib/analytics";
import { loadLocationsData } from "@/lib/data/locations";

const MONTHS = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const nav: Array<[string, LucideIcon, string]> = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["Data Explorer", PackageSearch, "/explorer"],
  ["Insights", Sparkles, "/insights"]
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function LocationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedYear = parsePositiveInt(first(params.year));
  const selectedMonth = parsePositiveInt(first(params.month));
  const brand = first(params.brand);
  const ownership = first(params.ownership);
  const lfl = first(params.lfl) === "1";

  const data = await loadLocationsData({
    brand,
    ownership,
    year: requestedYear,
    month: selectedMonth,
    lfl
  });

  const {
    years,
    selectedYear,
    months,
    brands,
    ownerships,
    snapshot,
    locationRows,
    lflCount,
    lflCurrentRevenue,
    lflPreviousRevenue,
    lflGrowth
  } = data;

  const chartData = locationRows.map((row) => ({
    location: row.location,
    venue: row.venueRevenue,
    delivery: row.deliveryRevenue,
    aggregator: row.aggregatorRevenue
  }));
  return (
    <main className="shell">
      <aside className="sidebar">
        <SidebarBrand />

        <nav>
          {nav.map(([label, Icon, href]) =>
            href ? (
              <Link key={label} href={lfl ? `${href}${href.includes("?") ? "&" : "?"}lfl=1` : href} className={label === "Заклади" ? "nav-item active" : "nav-item"}>
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
<div className="quick-context">
            <Link className="quick-mode" href={lfl ? "/?lfl=1" : "/"}>← Огляд</Link>
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={`/locations?year=${selectedYear}${selectedMonth ? `&month=${selectedMonth}` : ""}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}${ownership ? `&ownership=${encodeURIComponent(ownership)}` : ""}${lfl ? "" : "&lfl=1"}`}
            >
              LFL · активні
            </Link>
          </div>
        </header>

        <details className="filter-center">
          <summary>
            <span><Filter size={15} /> Фільтри закладів</span>
            <span className="filter-summary">
              {selectedYear}{selectedMonth ? ` · ${MONTHS[selectedMonth - 1]}` : " · YTD"}
              {brand ? ` · ${brand}` : ""}
              {ownership ? ` · ${ownership}` : ""}{lfl ? " · LFL" : ""}
            </span>
          </summary>
          <form className="filter-form" method="get" action="/locations">
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
          {lfl && <span className="lfl-context">LFL · без закритих точок</span>}
        </div>

        <section className="lfl-strip">
          <div className="lfl-card">
            <span>{lfl ? "Зіставні активні точки" : "Зіставні точки"}</span>
            <strong>{lflCount}</strong>
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
