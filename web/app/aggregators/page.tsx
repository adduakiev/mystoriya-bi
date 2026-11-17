import Link from "next/link";
import { Filter } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/RevenueChart";
import { formatUah } from "@/lib/analytics";
import { loadAggregatorsData } from "@/lib/data/aggregators";
import type { ComparisonMode, PeriodMode } from "@/lib/data/types";
import { aggregatorHref, type AggregatorFilters } from "@/lib/aggregator-filters";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePeriod(value: string | undefined): PeriodMode {
  return value === "month" || value === "week" ? value : "ytd";
}

function parseCompare(value: string | undefined): ComparisonMode {
  return value === "previous" ? "previous" : "ly";
}

export default async function AggregatorsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const selectedMonth = first(params.month);
  const filters: AggregatorFilters = {
    year:first(params.year) ? Number(first(params.year)) : undefined,
    month:selectedMonth ? Number(selectedMonth) : undefined,
    brand:first(params.brand) || undefined,
    ownership:first(params.ownership) || undefined,
    location:first(params.location) || undefined,
    orderType:first(params.orderType) || undefined
  };
  const period = selectedMonth ? "month" : parsePeriod(first(params.period));
  const comparison = parseCompare(first(params.compare));
  const lfl = first(params.lfl) === "1";
  const state = {...filters,period,compare:comparison,lfl};

  const data = await loadAggregatorsData(period, comparison, lfl, filters);
  const { snapshot, aggregators, rowCount } = data;
  if (!snapshot) {
    return (
      <main className="shell">
        <DashboardSidebar activeHref="/aggregators" lfl={lfl} statusTitle="DATA UNAVAILABLE" statusDetail="Обраний зріз не підтверджено" />
        <section className="workspace">
          <header className="topbar"><h1>Aggregator Control Center</h1></header>
          <section className="panel" role="status">
            <h2>Обраний зріз поки недоступний</h2>
            <p>Сервер не підтвердив дані та фільтри цього звіту. Показники приховано, щоб не показувати інший період або нефільтровані суми.</p>
            <Link className="clear-filter" href="/aggregators">Повернутися до доступних даних</Link>
          </section>
        </section>
      </main>
    );
  }
  const sqlConnected = data.source === "supabase-sql";
  const sourceStatus = sqlConnected ? "SQL CONNECTED · FRESHNESS UNVERIFIED" : "FALLBACK / UNVERIFIED";

  return (
    <main className="shell">
      <DashboardSidebar
        activeHref="/aggregators"
        lfl={lfl}
        statusTitle={sourceStatus}
        statusDetail={sqlConnected
          ? `${rowCount.toLocaleString("uk-UA")} SQL rows · freshness UNKNOWN`
          : `${rowCount.toLocaleString("uk-UA")} fallback rows · source and completeness UNKNOWN`}
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">AGGREGATORS · {sourceStatus}</span>
            <h1>Aggregator Control Center</h1>
          </div>

          <div className="control-stack">
            <Link
              className={lfl ? "quick-mode lfl-toggle active" : "quick-mode lfl-toggle"}
              href={aggregatorHref(state,{lfl:!lfl})}
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
                  href={aggregatorHref(state,{period:value,month:undefined})}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="segmented">
              <Link
                className={comparison === "ly" ? "segment active" : "segment"}
                href={aggregatorHref(state,{compare:"ly"})}
              >
                LY
              </Link>
              <Link
                className={comparison === "previous" ? "segment active" : "segment"}
                href={aggregatorHref(state,{compare:"previous"})}
              >
                Previous
              </Link>
            </div>
          </div>
        </header>

        {data.filterOptions && (
          <details className="filter-center">
            <summary><span><Filter size={15} /> Фільтри агрегаторів</span><span className="filter-summary">{filters.year ?? snapshot.currentYear}{filters.month ? ` · ${filters.month}` : ""}{filters.location ? ` · ${filters.location}` : ""}</span></summary>
            <form className="filter-form" method="get" action="/aggregators">
              <input type="hidden" name="period" value={period === "month" ? "ytd" : period} />
              <input type="hidden" name="compare" value={comparison} />
              {lfl && <input type="hidden" name="lfl" value="1" />}
              <label>Рік<select name="year" defaultValue={filters.year ?? ""}><option value="">Останній доступний</option>{data.filterOptions.years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
              <label>Місяць<select name="month" defaultValue={filters.month ?? ""}><option value="">Усі</option>{["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"].map((month,index)=><option key={index} value={index+1}>{month}</option>)}</select></label>
              {([
                ["brand","Бренд",data.filterOptions.brands],
                ["ownership","Власність",data.filterOptions.ownerships],
                ["location","Заклад",data.filterOptions.locations],
                ["orderType","Агрегатор",data.filterOptions.orderTypes]
              ] as const).map(([key,label,options])=><label key={key}>{label}<select name={key} defaultValue={filters[key] ?? ""}><option value="">Усі</option>{options.map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}
              <button type="submit" className="apply-filter">Застосувати</button>
              <Link className="clear-filter" href="/aggregators">Скинути</Link>
            </form>
          </details>
        )}

        <nav aria-label="Звіти агрегаторів" className="control-stack">
          <Link className="quick-mode" href="/aggregators/glovo" prefetch={false}>
            Glovo · Аналітика брендів →
          </Link>
        </nav>

        {!sqlConnected && (
          <p role="status" className="context-line">
            SQL RPC недоступний · резервний шлях, джерело UNKNOWN (Supabase snapshot або Google Sheets).
            Свіжість і повнота даних не перевірені.
          </p>
        )}

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
