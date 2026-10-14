import Link from "next/link";
import {
  BarChart3,
  CircleDollarSign,
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
import { PnlTrendChart } from "@/components/PnlTrendChart";
import {
  loadPnlData,
  PNL_MONTHS_LONG,
  type PnlDetailRow
} from "@/lib/data/pnl";
import { PNL_SOURCE_META } from "@/lib/data/pnl-source";

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

function first(value:string|string[]|undefined){
  return Array.isArray(value) ? value[0] : value;
}

function clampMonth(value:string|undefined,fallback:number){
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return fallback;
  return Math.max(1,Math.min(PNL_SOURCE_META.latestFactMonth,Math.round(parsed)));
}

function money(value:number):string{
  const abs=Math.abs(value);
  if(abs>=1_000_000) return `₴ ${(value/1_000_000).toFixed(2)}M`;
  if(abs>=1_000) return `₴ ${(value/1_000).toFixed(0)}K`;
  return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;
}

function fullMoney(value:number):string{
  return `${Math.round(value).toLocaleString("uk-UA")} ₴`;
}

function pct(value:number):string{
  return `${(value*100).toFixed(1)}%`;
}

function growth(current:number,base:number):number|null{
  if(!base) return null;
  return (current/base-1)*100;
}

function pp(current:number,base:number):number{
  return (current-base)*100;
}

function signed(value:number|null,suffix="%"):string{
  if(value===null) return "—";
  return `${value>0?"+":""}${value.toFixed(1)}${suffix}`;
}

function deltaClass(value:number|null,goodWhenHigher=true):string{
  if(value===null||Math.abs(value)<0.05) return "";
  const good=goodWhenHigher?value>0:value<0;
  return good?"positive":"negative";
}

function rowVarianceClass(row:PnlDetailRow,value:number|null):string{
  return deltaClass(value,row.kind!=="expense");
}

function Kpi({
  label,
  fact,
  plan,
  ly,
  rate=false,
  goodWhenHigher=true,
  hint
}:{
  label:string;
  fact:number;
  plan:number;
  ly:number;
  rate?:boolean;
  goodWhenHigher?:boolean;
  hint?:string;
}){
  const planDelta=rate?pp(fact,plan):growth(fact,plan);
  const yoy=rate?pp(fact,ly):growth(fact,ly);

  return (
    <article className="pnl-kpi-card">
      <span>{label}</span>
      <strong>{rate?pct(fact):money(fact)}</strong>
      {hint&&<em>{hint}</em>}
      <div className="pnl-kpi-deltas">
        <small>
          до плану
          <b className={deltaClass(planDelta,goodWhenHigher)}>
            {rate?signed(planDelta," п.п."):signed(planDelta)}
          </b>
        </small>
        <small>
          YoY
          <b className={deltaClass(yoy,goodWhenHigher)}>
            {rate?signed(yoy," п.п."):signed(yoy)}
          </b>
        </small>
      </div>
    </article>
  );
}

function ReferenceMetric({label,value,detail}:{label:string;value:string;detail?:string}){
  return (
    <div className="pnl-reference-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail&&<small>{detail}</small>}
    </div>
  );
}

function CostCard({
  label,
  fact,
  plan,
  ly,
  revenue
}:{
  label:string;
  fact:number;
  plan:number;
  ly:number;
  revenue:number;
}){
  const share=revenue?fact/revenue:0;
  const planDelta=growth(fact,plan);
  const yoy=growth(fact,ly);

  return (
    <article className="pnl-cost-card">
      <div>
        <span>{label}</span>
        <strong>{money(fact)}</strong>
      </div>
      <b>{pct(share)} від виручки</b>
      <div className="pnl-cost-track"><i style={{width:`${Math.min(100,share*100)}%`}} /></div>
      <small>
        План <em className={deltaClass(planDelta,false)}>{signed(planDelta)}</em>
        <i>·</i>
        YoY <em className={deltaClass(yoy,false)}>{signed(yoy)}</em>
      </small>
    </article>
  );
}

type DeliveryChannel=ReturnType<typeof loadPnlData>["fact"]["delivery"];
type AggregatorChannel=ReturnType<typeof loadPnlData>["fact"]["aggregators"];

function ChannelCard({
  title,
  subtitle,
  fact,
  plan,
  ly,
  aggregator=false
}:{
  title:string;
  subtitle:string;
  fact:DeliveryChannel|AggregatorChannel;
  plan:DeliveryChannel|AggregatorChannel;
  ly:DeliveryChannel|AggregatorChannel;
  aggregator?:boolean;
}){
  const profitPlan=growth(fact.profit,plan.profit);
  const profitYoy=growth(fact.profit,ly.profit);

  return (
    <article className="panel pnl-channel-card">
      <div className="pnl-channel-head">
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h2>{title}</h2>
        </div>
        <div className="pnl-channel-result">
          <span>Операційний результат</span>
          <strong>{money(fact.profit)}</strong>
          <small>
            <b className={deltaClass(profitPlan)}>{signed(profitPlan)}</b> до плану
            <i>·</i>
            <b className={deltaClass(profitYoy)}>{signed(profitYoy)}</b> до 2025
          </small>
        </div>
      </div>

      <div className="pnl-channel-stats">
        <div><span>Виручка</span><b>{money(fact.revenue)}</b></div>
        <div><span>Валова маржа</span><b>{pct(fact.markupRate)}</b></div>
        <div><span>Операційні витрати</span><b>{money(fact.opex)}</b></div>
        <div><span>Рентабельність (EBITDA %)</span><b>{pct(fact.profitRate)}</b></div>
      </div>

      {aggregator&&"commissionRate" in fact?(
        <div className="pnl-cost-strip">
          <div><span>Комісія</span><b>{pct(fact.commissionRate)}</b></div>
          <div><span>Просування</span><b>{pct(fact.promoRate)}</b></div>
          <div><span>Комісія + просування</span><b>{pct(fact.commissionPromoRate)}</b></div>
          <div><span>ФОТ каналу</span><b>{money(fact.fot)}</b></div>
        </div>
      ):!aggregator&&"marketingNonFot" in fact?(
        <div className="pnl-cost-strip">
          <div><span>ФОТ каналу</span><b>{money(fact.fot)}</b></div>
          <div><span>Маркетинг</span><b>{money(fact.marketingNonFot)}</b></div>
          <div><span>IT та сервіси</span><b>{money(fact.digitalServices)}</b></div>
          <div><span>Логістика</span><b>{money(fact.logistics+fact.couriers)}</b></div>
        </div>
      ):null}
    </article>
  );
}

export default async function PnlPage({
  searchParams
}:{
  searchParams?:Promise<Record<string,string|string[]|undefined>>;
}){
  const params=(await searchParams)??{};
  let from=clampMonth(first(params.from),1);
  let to=clampMonth(first(params.to),PNL_SOURCE_META.latestFactMonth);
  if(from>to) [from,to]=[to,from];

  const data=loadPnlData({startMonth:from-1,endMonth:to-1});
  const {fact,plan,ly}=data;
  const revenuePlan=growth(fact.revenue,plan.revenue);
  const revenueYoy=growth(fact.revenue,ly.revenue);

  return (
    <main className="shell">
      <aside className="sidebar">
        <SidebarBrand />
        <nav>
          {nav.map(([label,Icon,href])=>(
            <Link
              key={label}
              href={href}
              className={label==="P&L"?"nav-item active":"nav-item"}
            >
              <Icon size={18}/>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="status-dot"/>
          P&L · знімок даних
          <small>Факт / План / 2025 · Січ–Сер 2026</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">ФІНАНСИ · ВЛАСНИК / ІНВЕСТОР</span>
            <h1>P&L · План / Факт</h1>
          </div>
          <div className="pnl-headline-result">
            <span>{data.meta.periodLabel} · виручка</span>
            <strong>{money(fact.revenue)}</strong>
            <small>
              <b className={deltaClass(revenuePlan)}>{signed(revenuePlan)}</b> до плану
              <i>·</i>
              <b className={deltaClass(revenueYoy)}>{signed(revenueYoy)}</b> до 2025
            </small>
          </div>
        </header>

        <form className="pnl-filter-bar" action="/pnl" method="get">
          <div className="pnl-filter-title">
            <Filter size={15}/>
            <span>Період</span>
          </div>
          <label>
            <span>Від</span>
            <select name="from" defaultValue={String(from)}>
              {PNL_MONTHS_LONG.map((month,index)=>(
                <option key={month} value={index+1}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            <span>До</span>
            <select name="to" defaultValue={String(to)}>
              {PNL_MONTHS_LONG.map((month,index)=>(
                <option key={month} value={index+1}>{month}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="apply-filter">Застосувати</button>
          <Link href="/pnl" className="clear-filter">Весь період</Link>
          <div className="pnl-filter-meta">Знімок даних · по серпень 2026</div>
        </form>

        <section className="pnl-kpi-grid">
          <Kpi label="Виручка" fact={fact.revenue} plan={plan.revenue} ly={ly.revenue} hint="усі продажі до вирахування витрат"/>
          <Kpi label="Валовий прибуток" fact={fact.markup} plan={plan.markup} ly={ly.markup} hint="виручка мінус собівартість товару"/>
          <Kpi label="Валова маржа" fact={fact.markupRate} plan={plan.markupRate} ly={ly.markupRate} rate hint="валовий прибуток / виручка"/>
          <Kpi label="Операційні витрати (OPEX)" fact={fact.operatingExpenses} plan={plan.operatingExpenses} ly={ly.operatingExpenses} goodWhenHigher={false} hint="витрати для роботи каналів"/>
          <Kpi label="Операційний результат (EBITDA)" fact={fact.profit} plan={plan.profit} ly={ly.profit} hint="управлінський показник"/>
          <Kpi label="EBITDA % від виручки" fact={fact.profitRate} plan={plan.profitRate} ly={ly.profitRate} rate hint="операційна рентабельність"/>
        </section>

        <section className="pnl-reference-strip">
          <ReferenceMetric label="Операційні витрати / виручка" value={pct(fact.opexRate)} detail="частка OPEX"/>
          <ReferenceMetric label="ФОТ / виручка" value={pct(fact.expenseGroups.fot/fact.revenue)} detail="частка витрат на команду"/>
          <ReferenceMetric label="Маркетинг / виручка" value={pct(fact.expenseGroups.marketing/fact.revenue)} detail="реклама + агенція, без ФОТ"/>
          <ReferenceMetric label="Частка доставки" value={pct(fact.delivery.revenue/fact.revenue)} detail="у загальній виручці"/>
          <ReferenceMetric label="Частка агрегаторів" value={pct(fact.aggregators.revenue/fact.revenue)} detail="у загальній виручці"/>
          <ReferenceMetric label="Комісія + просування" value={pct(fact.aggregators.commissionPromoRate)} detail="від виручки агрегаторів"/>
        </section>

        <section className="pnl-channel-grid">
          <ChannelCard
            title="Доставка"
            subtitle="КУР’ЄР + САМОВИВІЗ"
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

        <section className="panel pnl-dynamics-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">ФІНАНСОВА ДИНАМІКА</span>
              <h2>Динаміка · Факт / План / 2025</h2>
            </div>
            <span className="pnl-source-chip">{data.meta.periodLabel}</span>
          </div>
          <PnlTrendChart data={data.trend}/>
        </section>

        <section className="pnl-section-heading">
          <div>
            <span className="eyebrow">СТРУКТУРА ВИТРАТ</span>
            <h2>Структура операційних витрат</h2>
          </div>
          <small>Кожен блок показує суму та частку від виручки</small>
        </section>

        <section className="pnl-cost-grid">
          <CostCard label="ФОТ" fact={fact.expenseGroups.fot} plan={plan.expenseGroups.fot} ly={ly.expenseGroups.fot} revenue={fact.revenue}/>
          <CostCard label="Маркетинг" fact={fact.expenseGroups.marketing} plan={plan.expenseGroups.marketing} ly={ly.expenseGroups.marketing} revenue={fact.revenue}/>
          <CostCard label="IT та сервіси" fact={fact.expenseGroups.digitalServices} plan={plan.expenseGroups.digitalServices} ly={ly.expenseGroups.digitalServices} revenue={fact.revenue}/>
          <CostCard label="Витрати доставки" fact={fact.expenseGroups.deliveryOperations} plan={plan.expenseGroups.deliveryOperations} ly={ly.expenseGroups.deliveryOperations} revenue={fact.revenue}/>
          <CostCard label="Витрати агрегаторів" fact={fact.expenseGroups.aggregatorCosts} plan={plan.expenseGroups.aggregatorCosts} ly={ly.expenseGroups.aggregatorCosts} revenue={fact.revenue}/>
        </section>

        <section className="panel pnl-detail-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">УПРАВЛІНСЬКИЙ P&L</span>
              <h2>Детальний P&L · {data.meta.periodLabel}</h2>
            </div>
            <span className="pnl-source-chip">Знімок даних · План / Факт / 2025</span>
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
                <span>до 2025</span>
              </div>

              {data.details.map((row,index)=>{
                const planDelta=row.fact-row.plan;
                const planDeltaPct=growth(row.fact,row.plan);
                const yoy=growth(row.fact,row.ly);
                const previousSection=index>0?data.details[index-1].section:null;
                const startsSection=row.section!==previousSection;

                return (
                  <div key={row.section+row.label}>
                    {startsSection&&<div className="pnl-detail-section">{row.section}</div>}
                    <div className={`pnl-detail-row pnl-row-${row.kind}`}>
                      <span><b>{row.label}</b></span>
                      <span>{fullMoney(row.fact)}</span>
                      <span>{fullMoney(row.plan)}</span>
                      <span className={rowVarianceClass(row,planDelta)}>
                        {planDelta>0?"+":""}{fullMoney(planDelta)}
                      </span>
                      <span className={rowVarianceClass(row,planDeltaPct)}>
                        {signed(planDeltaPct)}
                      </span>
                      <span>{fullMoney(row.ly)}</span>
                      <span className={rowVarianceClass(row,yoy)}>
                        {signed(yoy)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
