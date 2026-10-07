import Link from "next/link";
import {
  BarChart3,
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
import { RevenueChart } from "@/components/RevenueChart";
import { buildDashboardSnapshot, formatUah } from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows } from "@/lib/filters";
import type { ComparisonMode, PeriodMode, SalesRow } from "@/lib/data/types";

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

function parsePeriod(value: string | undefined): PeriodMode {
  return value === "month" || value === "week" ? value : "ytd";
}

function parseCompare(value: string | undefined): ComparisonMode {
  return value === "previous" ? "previous" : "ly";
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function groupByOrderType(
  rows: SalesRow[],
  period: PeriodMode,
  comparison: ComparisonMode
) {
  const names = [...new Set(rows.map((row) => row.orderType))].sort((a, b) => a.localeCompare(b, "uk"));
  const total = buildDashboardSnapshot(rows, { period, comparison }).current.revenue;

  return names
    .map((name) => {
      const snapshot = buildDashboardSnapshot(
        rows.filter((row) => row.orderType === name),
        { period, comparison }
      );

      return {
        name,
        revenue: snapshot.current.revenue,
        checks: snapshot.current.checks,
        averageCheck: snapshot.current.averageCheck,
        markupRate: snapshot.current.markupRate,
        growth: pct(snapshot.current.revenue, snapshot.previous.revenue),
        share: total > 0 ? (snapshot.current.revenue / total) * 100 : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export default async function AggregatorsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const period = parsePeriod(first(params.period));
  const comparison = parseCompare(first(params.compare));
  const lfl = first(params.lfl) === "1";
  const lflQuery = lfl ? "&lfl=1" : "";

  const allRows = await loadSalesData();
  const rows = filterSalesRows(allRows, { channel: "Агрегатор", lfl });
  const snapshot = buildDashboardSnapshot(rows, { period, comparison });
  const aggregators = groupByOrderType(rows, period, comparison);

  return (
    <main className="shell">
      <aside className="sidebar">
        <SidebarBrand />

        <nav>
          {nav.map(([label, Icon, href]) =>
            href ? (
              <Link key={label} href={lfl ? `${href}${href.includes("?") ? "&" : "?"}lfl=1` : href} className={label === "Агрегатори" ? "nav-item active" : "nav-item"}>
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
          <small>{rows.length.toLocaleString("uk-UA")} aggregator rows</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AGGREGATORS · LIVE</span>
            <h1>Aggregator Control Center</h1>
          </div>

          <div className="control-stack">
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={`/aggregators?period=${period}&compare=${comparison}${lfl ? "" : "&lfl=1"}`}
            >
              LFL · активні
            </Link>
            <div className="segmented">
              {([
                ["ytd", "YTD"],
                ["month", "Місяць"],
                ["week", "Тиждень"]
              ] as const).map(([value, label]) => (
                <Link
                  key={value}
                  className={period === value ? "segment active" : "segment"}
                  href={`/aggregators?period=${value}&compare=${comparison}${lflQuery}`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="segmented">
              <Link
                className={comparison === "ly" ? "segment active" : "segment"}
                href={`/aggregators?period=${period}&compare=ly${lflQuery}`}
              >
                LY
              </Link>
              <Link
                className={comparison === "previous" ? "segment active" : "segment"}
                href={`/aggregators?period=${period}&compare=previous${lflQuery}`}
              >
                Previous
              </Link>
            </div>
          </div>
        </header>

        <div className="context-line">
          <b>{snapshot.periodLabel}</b>
          <span>cutoff {snapshot.cutoffDate}</span>
          <span>vs {snapshot.comparisonLabel}</span>
          {lfl && <span className="lfl-context">LFL · активна мережа</span>}
        </div>

        <section className="kpi-grid">
          {snapshot.kpis.map((item) => <KpiCard key={item.label} kpi={item} />)}
        </section>

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">AGGREGATOR DYNAMICS</span>
                <h2>Оборот агрегаторів</h2>
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
                <span className="eyebrow">MIX</span>
                <h2>Структура агрегаторів</h2>
              </div>
            </div>

            <div className="aggregator-stack">
              {aggregators.map((item) => (
                <div className="aggregator-card" key={item.name}>
                  <div className="aggregator-card-head">
                    <div>
                      <b>{item.name}</b>
                      <span>{item.share.toFixed(1)}% від агрегаторів</span>
                    </div>
                    <strong>{formatUah(item.revenue)}</strong>
                  </div>
                  <div className="aggregator-metrics">
                    <span>Чеки <b>{Math.round(item.checks).toLocaleString("uk-UA")}</b></span>
                    <span>Ср. чек <b>{formatUah(item.averageCheck)}</b></span>
                    <span>Націнка % <b>{item.markupRate.toFixed(1)}%</b></span>
                    <span className={item.growth === null ? "" : item.growth >= 0 ? "positive" : "negative"}>
                      Δ <b>{item.growth === null ? "—" : `${item.growth >= 0 ? "+" : ""}${item.growth.toFixed(1)}%`}</b>
                    </span>
                  </div>
                  <div className="track"><span style={{ width: `${Math.min(item.share, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid lower">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LOCATIONS</span>
                <h2>Де агрегатори роблять оборот</h2>
              </div>
              <span className="text-button">TOP {snapshot.locations.length}</span>
            </div>

            <div className="location-table">
              <div className="table-row table-head">
                <span>Локація</span><span>Оборот</span><span>Δ</span><span>Частка</span>
              </div>
              {snapshot.locations.map((location) => (
                <div className="table-row" key={location.name}>
                  <b>{location.name}</b>
                  <span>{formatUah(location.revenue)}</span>
                  <span className={location.growth === null ? "" : location.growth >= 0 ? "positive" : "negative"}>
                    {location.growth === null ? "—" : `${location.growth >= 0 ? "+" : ""}${location.growth.toFixed(1)}%`}
                  </span>
                  <span>{location.share.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel insight-panel">
            <span className="eyebrow">AGGREGATOR SIGNAL</span>
            <h2>Що відбувається</h2>
            <div className="signal">
              <span className="signal-badge">A</span>
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
