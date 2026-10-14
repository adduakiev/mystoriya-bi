import Link from "next/link";
import {
  BarChart3,
  CircleDollarSign,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SidebarBrand } from "@/components/SidebarBrand";
import { PnlTrendChart } from "@/components/PnlTrendChart";
import { loadPnlData, type PnlDetailRow } from "@/lib/data/pnl";

const nav: Array<[string, LucideIcon, string]> = [
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["P&L", CircleDollarSign, "/pnl"],
  ["Data Explorer", PackageSearch, "/explorer"],
  ["Insights", Sparkles, "/insights"]
];

function money(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₴ ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `₴ ${(value / 1_000).toFixed(0)}K`;
  return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;
}

function fullMoney(value: number): string {
  return `${Math.round(value).toLocaleString("uk-UA")} ₴`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function growth(current: number, base: number): number | null {
  if (!base) return null;
  return (current / base - 1) * 100;
}

function pp(current: number, base: number): number {
  return (current - base) * 100;
}

function signed(value: number | null, suffix = "%"): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

function deltaClass(value: number | null, goodWhenHigher = true): string {
  if (value === null || Math.abs(value) < 0.05) return "";
  const good = goodWhenHigher ? value > 0 : value < 0;
  return good ? "positive" : "negative";
}

function rowVarianceClass(row: PnlDetailRow, value: number | null): string {
  if (row.kind === "control") return "";
  return deltaClass(value, row.kind !== "expense");
}

function Kpi({
  label,
  fact,
  plan,
  ly,
  rate = false,
  goodWhenHigher = true
}: {
  label: string;
  fact: number;
  plan: number;
  ly: number;
  rate?: boolean;
  goodWhenHigher?: boolean;
}) {
  const planDelta = rate ? pp(fact, plan) : growth(fact, plan);
  const yoy = rate ? pp(fact, ly) : growth(fact, ly);

  return (
    <article className="pnl-kpi-card">
      <span>{label}</span>
      <strong>{rate ? pct(fact) : money(fact)}</strong>
      <div className="pnl-kpi-deltas">
        <small>
          vs План
          <b className={deltaClass(planDelta, goodWhenHigher)}>
            {rate ? signed(planDelta, " п.п.") : signed(planDelta)}
          </b>
        </small>
        <small>
          YoY
          <b className={deltaClass(yoy, goodWhenHigher)}>
            {rate ? signed(yoy, " п.п.") : signed(yoy)}
          </b>
        </small>
      </div>
    </article>
  );
}

type DeliveryChannel = ReturnType<typeof loadPnlData>["fact"]["delivery"];
type AggregatorChannel = ReturnType<typeof loadPnlData>["fact"]["aggregators"];

function ChannelCard({
  title,
  subtitle,
  fact,
  plan,
  ly,
  aggregator = false
}: {
  title: string;
  subtitle: string;
  fact: DeliveryChannel | AggregatorChannel;
  plan: DeliveryChannel | AggregatorChannel;
  ly: DeliveryChannel | AggregatorChannel;
  aggregator?: boolean;
}) {
  const profitPlan = growth(fact.profit, plan.profit);
  const profitYoy = growth(fact.profit, ly.profit);

  return (
    <article className="panel pnl-channel-card">
      <div className="pnl-channel-head">
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h2>{title}</h2>
        </div>
        <div className="pnl-channel-result">
          <span>Результат каналу</span>
          <strong>{money(fact.profit)}</strong>
          <small>
            <b className={deltaClass(profitPlan)}>{signed(profitPlan)}</b> до плану
            <i>·</i>
            <b className={deltaClass(profitYoy)}>{signed(profitYoy)}</b> YoY
          </small>
        </div>
      </div>

      <div className="pnl-channel-stats">
        <div><span>Виручка</span><b>{money(fact.revenue)}</b></div>
        <div><span>Націнка</span><b>{money(fact.markup)}</b><small>{pct(fact.markupRate)}</small></div>
        <div><span>Витрати каналу</span><b>{money(fact.opex)}</b></div>
        <div><span>Profit %</span><b>{pct(fact.profitRate)}</b></div>
      </div>

      {aggregator && "commissionRate" in fact ? (
        <div className="pnl-cost-strip">
          <div><span>Комісія</span><b>{pct(fact.commissionRate)}</b></div>
          <div><span>Promo</span><b>{pct(fact.promoRate)}</b></div>
          <div><span>Комісія + Promo</span><b>{pct(fact.commissionPromoRate)}</b></div>
          <div><span>GetOrder</span><b>{money(fact.getOrder)}</b></div>
        </div>
      ) : !aggregator && "marketingTotal" in fact ? (
        <div className="pnl-cost-strip">
          <div><span>Marketing</span><b>{money(fact.marketingTotal)}</b></div>
          <div><span>IT / Digital</span><b>{money(fact.itDigital)}</b></div>
          <div><span>Логістика</span><b>{money(fact.logistics)}</b></div>
          <div><span>Кур'єри</span><b>{money(fact.couriers)}</b></div>
        </div>
      ) : null}
    </article>
  );
}

export default function PnlPage() {
  const data = loadPnlData();
  const { fact, plan, ly } = data;
  const revenuePlan = growth(fact.revenue, plan.revenue);
  const revenueYoy = growth(fact.revenue, ly.revenue);

  return (
    <main className="shell">
      <aside className="sidebar">
        <SidebarBrand />

        <nav>
          {nav.map(([label, Icon, href]) => (
            <Link
              key={label}
              href={href}
              className={label === "P&L" ? "nav-item active" : "nav-item"}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          P&L source connected
          <small>Січень–серпень 2026 · Plan / Fact / YoY</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">FINANCE · MANAGEMENT P&L</span>
            <h1>P&L · План / Факт</h1>
          </div>
          <div className="pnl-headline-result">
            <span>YTD виручка</span>
            <strong>{money(fact.revenue)}</strong>
            <small>
              <b className={deltaClass(revenuePlan)}>{signed(revenuePlan)}</b> до плану
              <i>·</i>
              <b className={deltaClass(revenueYoy)}>{signed(revenueYoy)}</b> YoY
            </small>
          </div>
        </header>

        <div className="context-line">
          <b>Січень–серпень 2026</b>
          <span>Факт vs План 2026</span>
          <span>динаміка vs січень–серпень 2025</span>
          <span>атомарна управлінська модель</span>
        </div>

        <section className="pnl-kpi-grid">
          <Kpi label="Виручка" fact={fact.revenue} plan={plan.revenue} ly={ly.revenue} />
          <Kpi label="Націнка" fact={fact.markup} plan={plan.markup} ly={ly.markup} />
          <Kpi label="Націнка %" fact={fact.markupRate} plan={plan.markupRate} ly={ly.markupRate} rate />
          <Kpi label="Прибуток BI" fact={fact.profit} plan={plan.profit} ly={ly.profit} />
          <Kpi label="Profit %" fact={fact.profitRate} plan={plan.profitRate} ly={ly.profitRate} rate />
        </section>

        <section className="pnl-audit-banner">
          <div>
            <span className="eyebrow">CONTROL · SOURCE FORMULA</span>
            <b>Комісія агрегаторів у BI враховується рівно один раз</b>
            <p>
              Вихідний Excel показує YTD прибуток {money(fact.reportedProfit)}, а атомарна
              модель BI — {money(fact.profit)}. Різниця {money(fact.reportedGap)} відповідає
              повторно врахованій у вихідному файлі комісії агрегаторів. Товарний COGS у BI
              збирається з COGS Delivery + Aggregators без комісії.
            </p>
          </div>
          <div className="pnl-audit-number">
            <span>Δ до Excel</span>
            <strong>{money(fact.reportedGap)}</strong>
          </div>
        </section>

        <section className="pnl-channel-grid">
          <ChannelCard
            title="Доставка"
            subtitle="COURIER + PICKUP"
            fact={fact.delivery}
            plan={plan.delivery}
            ly={ly.delivery}
          />
          <ChannelCard
            title="Агрегатори"
            subtitle="GLOVO · BOLT · LOCO"
            fact={fact.aggregators}
            plan={plan.aggregators}
            ly={ly.aggregators}
            aggregator
          />
        </section>

        <section className="content-grid pnl-chart-grid">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">REVENUE DYNAMICS</span>
                <h2>Виручка · Plan / Fact / YoY</h2>
              </div>
            </div>
            <PnlTrendChart data={data.trend} metric="revenue" />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">PROFIT DYNAMICS</span>
                <h2>Прибуток BI · Plan / Fact / YoY</h2>
              </div>
            </div>
            <PnlTrendChart data={data.trend} metric="profit" />
          </article>
        </section>

        <section className="panel pnl-detail-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">MANAGEMENT P&L</span>
              <h2>Структура · Січень–серпень</h2>
            </div>
            <span className="pnl-source-chip">Source: Доставка 2026</span>
          </div>

          <div className="pnl-detail-wrap">
            <div className="pnl-detail-table">
              <div className="pnl-detail-row pnl-detail-head">
                <span>Стаття</span>
                <span>Факт 2026</span>
                <span>План 2026</span>
                <span>Δ грн</span>
                <span>Δ %</span>
                <span>Факт 2025</span>
                <span>YoY</span>
              </div>

              {data.details.map((row, index) => {
                const planDelta = row.fact - row.plan;
                const planDeltaPct = growth(row.fact, row.plan);
                const yoy = growth(row.fact, row.ly);
                const previousSection = index > 0 ? data.details[index - 1].section : null;
                const startsSection = row.section !== previousSection;

                return (
                  <div key={row.section + row.label}>
                    {startsSection && <div className="pnl-detail-section">{row.section}</div>}
                    <div className={`pnl-detail-row pnl-row-${row.kind}`}>
                      <span>
                        <b>{row.label}</b>
                        {row.note && <small>{row.note}</small>}
                      </span>
                      <span>{fullMoney(row.fact)}</span>
                      <span>{fullMoney(row.plan)}</span>
                      <span className={rowVarianceClass(row, planDelta)}>
                        {planDelta > 0 ? "+" : ""}{fullMoney(planDelta)}
                      </span>
                      <span className={rowVarianceClass(row, planDeltaPct)}>
                        {signed(planDeltaPct)}
                      </span>
                      <span>{fullMoney(row.ly)}</span>
                      <span className={rowVarianceClass(row, yoy)}>
                        {signed(yoy)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pnl-footnotes">
          <span>
            <b>IT / Digital:</b> з квітня 2026 source-стаття включає також частину інвестицій
            у новий сайт. У 2026 залишаємо їх у фактичному OPEX; з 2027 винесемо
            Investment / Development окремо.
          </span>
          <span>
            <b>Розподіл ФОТ:</b> Костюшко + контакт-центр 70% Delivery / 30% Aggregators.
            Недогибченко — 100% Delivery. Marketing FOT — 100% Delivery.
          </span>
        </section>
      </section>
    </main>
  );
}
