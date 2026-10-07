import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck,
  X
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/RevenueChart";
import { buildDashboardSnapshot, formatUah } from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import {
  filterSalesRows,
  queryHref,
  type DashboardFilters
} from "@/lib/filters";

const nav = [
  ["Огляд", LayoutDashboard],
  ["Доставка", Truck],
  ["Агрегатори", Network],
  ["Локації", MapPin],
  ["Динаміка", BarChart3],
  ["Data Explorer", PackageSearch],
  ["Insights", Sparkles]
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

export default async function Home({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const filters: DashboardFilters = {
    channel: first(params.channel),
    location: first(params.location),
    brand: first(params.brand),
    ownership: first(params.ownership)
  };

  const sourceRows = await loadSalesData();
  const rows = filterSalesRows(sourceRows, filters);
  const snapshot = buildDashboardSnapshot(rows);
  const hasFilters = Object.values(filters).some(Boolean);

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
          {nav.map(([label, Icon], i) => (
            <button key={label} className={i === 0 ? "nav-item active" : "nav-item"}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          Live data connected
          <small>{rows.toLocaleString ? rows.length.toLocaleString("uk-UA") : rows.length} / {sourceRows.length.toLocaleString("uk-UA")} rows</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">BUSINESS PERFORMANCE · LIVE</span>
            <h1>Огляд</h1>
          </div>
          <div className="filters">
            <button>01 січ — {prettyDate(snapshot.cutoffDate)} <ChevronDown size={14} /></button>
            <button>Compare: LY YTD <ChevronDown size={14} /></button>
            <button>{filters.channel ?? "Всі канали"} <ChevronDown size={14} /></button>
          </div>
        </header>

        {hasFilters && (
          <div className="active-filters">
            <span className="eyebrow">ACTIVE VIEW</span>
            {filters.channel && <span className="filter-chip">Канал: {filters.channel}</span>}
            {filters.location && <span className="filter-chip">Локація: {filters.location}</span>}
            {filters.brand && <span className="filter-chip">Бренд: {filters.brand}</span>}
            {filters.ownership && <span className="filter-chip">Власність: {filters.ownership}</span>}
            <Link className="reset-filter" href="/"><X size={13} /> Скинути</Link>
          </div>
        )}

        <section className="kpi-grid">
          {snapshot.kpis.map((item) => <KpiCard key={item.label} kpi={item} />)}
        </section>

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">DYNAMICS · YTD</span>
                <h2>Оборот</h2>
              </div>
              <div className="legend">
                <span><i className="legend-current" />{snapshot.currentYear}</span>
                <span><i />{snapshot.previousYear}</span>
              </div>
            </div>
            <RevenueChart
              data={snapshot.trend}
              currentYear={snapshot.currentYear}
              previousYear={snapshot.previousYear}
            />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">STRUCTURE · YTD</span>
                <h2>Канали продажів</h2>
              </div>
            </div>
            <div className="channel-list">
              {snapshot.channels.map((channel) => (
                <Link
                  className="channel-row"
                  key={channel.name}
                  href={queryHref(filters, {
                    channel: filters.channel === channel.name ? undefined : channel.name
                  })}
                >
                  <div>
                    <b>{channel.name}</b>
                    <span>{formatUah(channel.revenue)} · {Math.round(channel.checks).toLocaleString("uk-UA")} чеків</span>
                  </div>
                  <div className="share">{channel.share.toFixed(1)}%</div>
                  <div className="track"><span style={{ width: `${Math.min(channel.share, 100)}%` }} /></div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid lower">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LOCATIONS · YTD</span>
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
                <span>Локація</span><span>Оборот</span><span>YoY</span><span>Частка</span>
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
                    {location.growth === null ? "—" : `${location.growth >= 0 ? "+" : ""}${location.growth.toFixed(1)}%`}
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
            <button className="analysis-button">Відкрити аналіз</button>
          </article>
        </section>
      </section>
    </main>
  );
}
