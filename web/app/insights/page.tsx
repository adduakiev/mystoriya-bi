import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CircleCheck,
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
import { availableMonths, availableYears, formatUah } from "@/lib/analytics";
import { loadSalesData } from "@/lib/data/source";
import { filterSalesRows } from "@/lib/filters";
import { buildInsights, type InsightItem } from "@/lib/insights";

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

function pctLabel(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ppLabel(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} п.п.`;
}

function severityLabel(item: InsightItem): string {
  if (item.severity === "critical") return "Критично";
  if (item.severity === "warning") return "Увага";
  if (item.severity === "positive") return "Позитив";
  return "Сигнал";
}

function kindLabel(item: InsightItem): string {
  if (item.kind === "revenue") return "Оборот";
  if (item.kind === "checks") return "Чеки";
  if (item.kind === "averageCheck") return "Ср. чек";
  if (item.kind === "margin") return "Націнка %";
  if (item.kind === "anomaly") return "Аномалія";
  return "Структура";
}

function insightHref(
  item: InsightItem,
  fallback: string
): string {
  return item.href ?? fallback;
}

export default async function InsightsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const sourceRows = await loadSalesData();

  const years = availableYears(sourceRows);
  const selectedYear = parsePositiveInt(first(params.year)) ?? years[years.length - 1];
  const selectedMonth = parsePositiveInt(first(params.month));
  const lfl = first(params.lfl) === "1";

  const channel = first(params.channel);
  const orderType = first(params.orderType);
  const location = first(params.location);
  const brand = first(params.brand);
  const ownership = first(params.ownership);

  const rows = filterSalesRows(sourceRows, {
    channel,
    orderType,
    location,
    brand,
    ownership,
    lfl
  });

  const result = buildInsights(rows, {
    year: selectedYear,
    month: selectedMonth,
    lfl
  });

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

  const currentQuery = new URLSearchParams();
  currentQuery.set("year", String(selectedYear));
  if (selectedMonth) currentQuery.set("month", String(selectedMonth));
  if (channel) currentQuery.set("channel", channel);
  if (orderType) currentQuery.set("orderType", orderType);
  if (location) currentQuery.set("location", location);
  if (brand) currentQuery.set("brand", brand);
  if (ownership) currentQuery.set("ownership", ownership);
  if (lfl) currentQuery.set("lfl", "1");

  const lflQuery = new URLSearchParams(currentQuery);
  if (lfl) lflQuery.delete("lfl");
  else lflQuery.set("lfl", "1");
  lflQuery.delete("location");

  const fallbackHref = `/?${currentQuery.toString()}`;

  return (
    <main className="shell">
      <aside className="sidebar">
        <SidebarBrand />

        <nav>
          {nav.map(([label, Icon, href]) => (
            <Link
              key={label}
              href={lfl ? `${href}${href.includes("?") ? "&" : "?"}lfl=1` : href}
              className={label === "Insights" ? "nav-item active" : "nav-item"}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          Rules engine active
          <small>{rows.length.toLocaleString("uk-UA")} рядків у зрізі</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AUTOMATED MANAGEMENT ANALYSIS</span>
            <h1>Insights</h1>
          </div>

          <div className="quick-context">
            <Link className="quick-mode" href={lfl ? "/?lfl=1" : "/"}>← Огляд</Link>
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={`/insights?${lflQuery.toString()}`}
            >
              LFL · активні
            </Link>
          </div>
        </header>

        <details className="filter-center">
          <summary>
            <span><Filter size={15} /> Фільтри Insights</span>
            <span className="filter-summary">
              {result.periodLabel}
              {channel ? ` · ${channel}` : ""}
              {location ? ` · ${location}` : ""}
              {lfl ? " · LFL" : ""}
            </span>
          </summary>

          <form className="filter-form" method="get" action="/insights">
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

            <div className="filter-actions">
              <button className="apply-filter" type="submit">Проаналізувати</button>
              <Link className="clear-filter" href="/insights">Скинути</Link>
            </div>
          </form>
        </details>

        <div className="context-line">
          <b>{result.periodLabel}</b>
          <span>cutoff {result.cutoffDate || "—"}</span>
          <span>vs {selectedYear - 1}</span>
          {lfl && <span className="lfl-context">LFL · активна мережа</span>}
        </div>

        <section className="trend-summary-strip insights-summary-strip">
          <div className="trend-summary-card">
            <span>Оборот</span>
            <strong>{formatUah(result.overall.revenue)}</strong>
            <small className={result.overall.revenueGrowth === null ? "" : result.overall.revenueGrowth >= 0 ? "positive" : "negative"}>
              {pctLabel(result.overall.revenueGrowth)} vs LY
            </small>
          </div>

          <div className="trend-summary-card">
            <span>Чеки</span>
            <strong>{Math.round(result.overall.checks).toLocaleString("uk-UA")}</strong>
            <small className={result.overall.checksGrowth === null ? "" : result.overall.checksGrowth >= 0 ? "positive" : "negative"}>
              {pctLabel(result.overall.checksGrowth)} vs LY
            </small>
          </div>

          <div className="trend-summary-card">
            <span>Середній чек</span>
            <strong>{formatUah(result.overall.averageCheck)}</strong>
            <small className={result.overall.averageCheckGrowth === null ? "" : result.overall.averageCheckGrowth >= 0 ? "positive" : "negative"}>
              {pctLabel(result.overall.averageCheckGrowth)} vs LY
            </small>
          </div>

          <div className="trend-summary-card">
            <span>Націнка %</span>
            <strong>{result.overall.markupRate.toFixed(1)}%</strong>
            <small className={result.overall.markupRateDelta >= 0 ? "positive" : "negative"}>
              {ppLabel(result.overall.markupRateDelta)} vs LY
            </small>
          </div>
        </section>

        <section className="panel management-brief-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">MANAGEMENT BRIEF</span>
              <h2>Що зараз відбувається</h2>
            </div>
            <span className="text-button">автоматично з живих даних</span>
          </div>

          <div className="management-brief-grid">
            {result.brief.length > 0 ? result.brief.map((item, index) => (
              <Link
                href={insightHref(item, fallbackHref)}
                className={`insight-card severity-${item.severity}`}
                key={`${item.id}-${index}`}
              >
                <div className="insight-card-top">
                  <span className="insight-rank">{index + 1}</span>
                  <span className={`insight-severity severity-${item.severity}`}>
                    {severityLabel(item)}
                  </span>
                  <span className="insight-kind">{kindLabel(item)}</span>
                </div>
                <b>{item.title}</b>
                <p>{item.body}</p>
              </Link>
            )) : (
              <div className="empty-insights">Недостатньо даних для формування management brief у цьому зрізі.</div>
            )}
          </div>
        </section>

        <section className="insights-columns">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">ATTENTION</span>
                <h2>Потребує уваги</h2>
              </div>
              <AlertTriangle size={18} className="insight-icon warning-icon" />
            </div>

            <div className="insight-list">
              {result.attention.length > 0 ? result.attention.map((item) => (
                <Link
                  href={insightHref(item, fallbackHref)}
                  className="insight-list-row"
                  key={item.id}
                >
                  <div>
                    <span className={`insight-severity severity-${item.severity}`}>
                      {severityLabel(item)}
                    </span>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                  </div>
                  <span className="insight-arrow">→</span>
                </Link>
              )) : (
                <div className="empty-insights">Критичних або помітних негативних сигналів не знайдено.</div>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">POSITIVE SIGNALS</span>
                <h2>Працює добре</h2>
              </div>
              <CircleCheck size={18} className="insight-icon positive-icon" />
            </div>

            <div className="insight-list">
              {result.wins.length > 0 ? result.wins.map((item) => (
                <Link
                  href={insightHref(item, fallbackHref)}
                  className="insight-list-row"
                  key={item.id}
                >
                  <div>
                    <span className="insight-severity severity-positive">Позитив</span>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                  </div>
                  <span className="insight-arrow">→</span>
                </Link>
              )) : (
                <div className="empty-insights">Сильних позитивних сигналів за заданими порогами поки немає.</div>
              )}
            </div>
          </article>
        </section>

        <section className="panel anomaly-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ANOMALY DETECTION</span>
              <h2>Нетипові періоди</h2>
            </div>
            <span className="text-button">відхилення від власної YoY-динаміки</span>
          </div>

          {selectedMonth ? (
            <div className="empty-insights">
              Для пошуку аномалій обери YTD / весь рік — engine порівнює місяці між собою.
            </div>
          ) : result.anomalies.length > 0 ? (
            <div className="anomaly-grid">
              {result.anomalies.map((item) => (
                <Link
                  href={insightHref(item, fallbackHref)}
                  key={item.id}
                  className={`anomaly-card severity-${item.severity}`}
                >
                  <span className="insight-kind">Аномалія</span>
                  <b>{item.title}</b>
                  <p>{item.body}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-insights">
              Значущих аномалій за доступною історією не знайдено.
            </div>
          )}
        </section>

        <section className="panel insight-method-panel">
          <div>
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>Це не вигадані AI-висновки</h2>
          </div>
          <p>
            Engine ранжує сигнали за абсолютною зміною обороту, YoY, часткою бізнесу,
            динамікою чеків, середнього чека та націнки %. Аномалії визначаються як
            статистично нетипові відхилення місячного YoY від власної динаміки.
          </p>
        </section>
      </section>
    </main>
  );
}
