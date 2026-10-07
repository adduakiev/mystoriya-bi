import Link from "next/link";
import {
  BarChart3,
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
import { filterSalesRows, queryHref, type DashboardFilters } from "@/lib/filters";
import type { ComparisonMode, PeriodMode } from "@/lib/data/types";

const nav = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, null],
  ["Агрегатори", Network, "/aggregators"],
  ["Локації", MapPin, null],
  ["Динаміка", BarChart3, null],
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

export default async function Home({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const period = parsePeriod(first(params.period));
  const compare = parseCompare(first(params.compare));

  const filters: DashboardFilters = {
    channel: first(params.channel),
    location: first(params.location),
    brand: first(params.brand),
    ownership: first(params.ownership),
    period,
    compare
  };

  const sourceRows = await loadSalesData();
  const rows = filterSalesRows(sourceRows, filters);
  const snapshot = buildDashboardSnapshot(rows, { period, comparison: compare });
  const hasDimensionFilters = [filters.channel, filters.location, filters.brand, filters.ownership].some(Boolean);

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

          <div className="control-stack">
            <div className="segmented">
              {([
                ["ytd", "YTD"],
                ["month", "Місяць"],
                ["week", "Тиждень"]
              ] as const).map(([value, label]) => (
                <Link
                  key={value}
                  className={period === value ? "segment active" : "segment"}
                  href={queryHref(filters, { period: value })}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="segmented">
              <Link
                className={compare === "ly" ? "segment active" : "segment"}
                href={queryHref(filters, { compare: "ly" })}
              >
                LY
              </Link>
              <Link
                className={compare === "previous" ? "segment active" : "segment"}
                href={queryHref(filters, { compare: "previous" })}
              >
                Previous
              </Link>
            </div>
          </div>
        </header>

        <div className="context-line">
          <b>{snapshot.periodLabel}</b>
          <span>cutoff {prettyDate(snapshot.cutoffDate)}</span>
          <span>vs {snapshot.comparisonLabel}</span>
        </div>

        {hasDimensionFilters && (
          <div className="active-filters">
            <span className="eyebrow">ACTIVE VIEW</span>
            {filters.channel && <span className="filter-chip">Канал: {filters.channel}</span>}
            {filters.location && <span className="filter-chip">Локація: {filters.location}</span>}
            {filters.brand && <span className="filter-chip">Бренд: {filters.brand}</span>}
            {filters.ownership && <span className="filter-chip">Власність: {filters.ownership}</span>}
            <Link
              className="reset-filter"
              href={queryHref(filters, {
                channel: undefined,
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

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">DYNAMICS · {snapshot.periodLabel.toUpperCase()}</span>
                <h2>Оборот</h2>
              </div>
              <div className="legend">
                <span><i className="legend-current" />{snapshot.periodLabel}</span>
                <span><i />{snapshot.comparisonLabel}</span>
              </div>
            </div>
            <RevenueChart
              data={snapshot.trend}
              currentLabel={snapshot.periodLabel}
              previousLabel={snapshot.comparisonLabel}
            />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">STRUCTURE · {snapshot.periodLabel.toUpperCase()}</span>
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
