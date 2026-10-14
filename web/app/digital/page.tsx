import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Megaphone,
  MousePointerClick,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DigitalTrendChart } from "@/components/DigitalTrendChart";
import { DIGITAL_REPORTS } from "@/lib/digital-reports";
import { loadDigitalData } from "@/lib/data/digital";

const ICONS = {
  funnel: MousePointerClick,
  channels: BarChart3,
  seo: Search,
  ads: Megaphone,
  site: Activity,
  audience: Users,
  tracking: ShieldCheck
};

function compact(value:number){return Math.round(value).toLocaleString("uk-UA");}
function money(value:number){return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;}
function pct(value:number){return `${(value*100).toFixed(2)}%`;}
function delta(current:number,previous:number){
  if(!previous) return null;
  return (current/previous-1)*100;
}
function deltaText(value:number|null){
  if(value===null) return "—";
  return `${value>0?"+":""}${value.toFixed(1)}%`;
}
function dateLabel(value:string){
  if(!value) return "—";
  return new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T00:00:00Z"));
}
function Kpi({label,value,hint,change,good=true}:{label:string;value:string;hint:string;change:number|null;good?:boolean}){
  const cls=change===null||Math.abs(change)<.05?"":((good?change>0:change<0)?"positive":"negative");
  return <article className="digital-kpi-card">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
    <em className={cls}>до попередніх 30 днів: {deltaText(change)}</em>
  </article>;
}

export default async function DigitalPage(){
  const data=await loadDigitalData();
  const c=data.current,p=data.previous;
  const seo=data.seo,prevSeo=data.previousSeo;
  const topChannels=data.channels.slice(0,6);

  return (
    <main className="shell">
      <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · live" statusDetail={`GA4 + Search Console · до ${dateLabel(data.meta.to)}`}/>
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">DIGITAL · BUSINESS PERFORMANCE</span>
            <h1>Digital-аналітика</h1>
          </div>
          <div className="digital-head-note">
            <span>Поточний період</span>
            <b>{dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}</b>
          </div>
        </header>

        <DigitalTabs active="overview"/>

        <section className="digital-kpi-grid">
          <Kpi label="Сесії" value={compact(c.sessions)} hint="візити на сайт · GA4" change={delta(c.sessions,p.sessions)}/>
          <Kpi label="Покупки GA4" value={compact(c.purchases)} hint="події purchase · не фінансовий облік" change={delta(c.purchases,p.purchases)}/>
          <Kpi label="Конверсія сайту" value={pct(c.conversionRate)} hint="purchase / sessions" change={delta(c.conversionRate,p.conversionRate)}/>
          <Kpi label="Виручка GA4" value={money(c.purchaseRevenue)} hint="аналітична виручка GA4" change={delta(c.purchaseRevenue,p.purchaseRevenue)}/>
          <Kpi label="Середній чек GA4" value={money(c.averageOrderValue)} hint="purchase revenue / purchase" change={delta(c.averageOrderValue,p.averageOrderValue)}/>
          <Kpi label="Engagement rate" value={pct(c.engagementRate)} hint="частка залучених сесій" change={delta(c.engagementRate,p.engagementRate)}/>
          <Kpi label="SEO кліки" value={compact(seo.clicks)} hint="Google Search Console" change={delta(seo.clicks,prevSeo.clicks)}/>
          <Kpi label="SEO CTR" value={pct(seo.ctr)} hint={`середня позиція ${seo.position.toFixed(1)}`} change={delta(seo.ctr,prevSeo.ctr)}/>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">ДИНАМІКА</span><h2>Щоденна динаміка Digital</h2></div>
            <span className="pnl-source-chip">30 повних днів</span>
          </div>
          <DigitalTrendChart data={data.trend}/>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">ВОРОНКА</span><h2>Від сесії до покупки</h2></div>
              <Link href="/digital/funnel" className="text-button">Детально →</Link>
            </div>
            <div className="digital-source-flow">
              <div><b>{compact(c.sessions)}</b><span>Сесії · 100%</span></div>
              <div><b>{compact(c.addToCarts)}</b><span>Add to cart · {pct(c.sessions?c.addToCarts/c.sessions:0)}</span></div>
              <div><b>{compact(c.checkouts)}</b><span>Checkout · {pct(c.addToCarts?c.checkouts/c.addToCarts:0)} від кошика</span></div>
              <div><b>{compact(c.purchases)}</b><span>Purchase · {pct(c.checkouts?c.purchases/c.checkouts:0)} від checkout</span></div>
            </div>
            <small className="table-note">GA4 рахує події; це поведінкова воронка, а не бухгалтерський реєстр замовлень.</small>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">КАНАЛИ</span><h2>Хто приводить трафік</h2></div>
              <Link href="/digital/channels" className="text-button">Детально →</Link>
            </div>
            <div className="channel-list">
              {topChannels.map(row=>(
                <div className="channel-row" key={row.channel}>
                  <div><b>{row.channel}</b><span>{compact(row.purchases)} покупок · {pct(row.conversionRate)} конверсія</span></div>
                  <span className="share">{pct(c.sessions?row.sessions/c.sessions:0)}</span>
                  <div className="track"><span style={{width:`${Math.min(100,c.sessions?row.sessions/c.sessions*100:0)}%`}}/></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <div className="pnl-section-heading">
          <div><span className="eyebrow">ГРУПА ЗВІТІВ</span><h2>Digital-звіти для бізнес-рішень</h2></div>
          <small>GA4 + Search Console уже live · Google Ads додамо після доступу</small>
        </div>

        <section className="digital-report-grid">
          {DIGITAL_REPORTS.map(report=>{
            const Icon=ICONS[report.slug as keyof typeof ICONS] ?? Activity;
            const live=["funnel","channels","seo","site"].includes(report.slug);
            return <Link href={`/digital/${report.slug}`} className="digital-report-card" key={report.slug}>
              <div className="digital-report-icon"><Icon size={18}/></div>
              <div>
                <span>{live?"LIVE":"ПІДГОТОВЛЕНО"}</span>
                <b>{report.title}</b>
                <p>{report.description}</p>
              </div>
              <ArrowRight size={15}/>
            </Link>;
          })}
        </section>

        <section className="panel digital-principles">
          <div><span className="eyebrow">ЯК ЧИТАТИ ЦИФРИ</span><h2>Фінальна правда про гроші — у нашому BI</h2></div>
          <div className="digital-principle-grid">
            <div><b>GA4</b><span>поведінка, сесії, воронка та аналітична purchase revenue.</span></div>
            <div><b>Search Console</b><span>покази, кліки, CTR, позиції, запити та SEO-сторінки.</span></div>
            <div><b>Продажі М’ЯСТОРІЇ</b><span>для фінансової виручки й замовлень використовуємо warehouse BI.</span></div>
            <div><b>Google Ads</b><span>витрати, CPA і ROAS з’являться після доступу до Ads.</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}
