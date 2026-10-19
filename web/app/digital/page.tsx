import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Filter,
  Megaphone,
  MapPinned,
  MousePointerClick,
  Search,
  ShieldCheck,
  Users,
  Smartphone,
  ShoppingBag,
  Share2
} from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DigitalTrendChart } from "@/components/DigitalTrendChart";
import { DigitalHistoryChart } from "@/components/DigitalHistoryChart";
import { DIGITAL_REPORTS } from "@/lib/digital-reports";
import { loadDigitalData, loadDigitalHistory, type DigitalMetrics, type SeoMetrics } from "@/lib/data/digital";
import { loadDigitalAdsData, loadDigitalLocalData } from "@/lib/data/digital-sources";

const ICONS = {
  funnel: MousePointerClick,
  channels: BarChart3,
  seo: Search,
  ads: Megaphone,
  site: Activity,
  local: MapPinned,
  social: Share2,
  commerce: ShoppingBag,
  app: Smartphone,
  audience: Users,
  tracking: ShieldCheck
};

const MONTHS=["Увесь період / YTD","Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];

function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value;}
function compact(value:number){return Math.round(value).toLocaleString("uk-UA");}
function money(value:number){return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;}
function pct(value:number){return `${(value*100).toFixed(2)}%`;}
function delta(current:number,previous:number|null){
  if(previous===null||previous===0) return null;
  return (current/previous-1)*100;
}
function deltaText(value:number|null){
  if(value===null) return "немає зіставних даних";
  return `${value>0?"+":""}${value.toFixed(1)}%`;
}
function dateLabel(value:string){
  if(!value) return "—";
  return new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T00:00:00Z"));
}
function parseIso(value:string|undefined){
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date=new Date(value+"T00:00:00Z");
  return Number.isNaN(date.getTime())?null:date;
}
function iso(date:Date){return date.toISOString().slice(0,10);}
function addDays(value:string,days:number){
  const date=new Date(value+"T00:00:00Z");
  date.setUTCDate(date.getUTCDate()+days);
  return iso(date);
}
function daysBetween(from:string,to:string){
  return Math.round((new Date(to+"T00:00:00Z").getTime()-new Date(from+"T00:00:00Z").getTime())/86400000)+1;
}
function shiftYear(value:string,years:number){
  const d=new Date(value+"T00:00:00Z");
  const month=d.getUTCMonth();
  const day=d.getUTCDate();
  const target=new Date(Date.UTC(d.getUTCFullYear()+years,month,day));
  if(target.getUTCMonth()!==month){
    target.setUTCDate(0);
  }
  return iso(target);
}
function endOfMonth(year:number,month:number){
  return iso(new Date(Date.UTC(year,month,0)));
}
function clampDate(value:string,min:string,max:string){
  if(value<min) return min;
  if(value>max) return max;
  return value;
}

function Kpi({label,value,hint,change,compareLabel,good=true}:{label:string;value:string;hint:string;change:number|null;compareLabel:string;good?:boolean}){
  const cls=change===null||Math.abs(change)<.05?"":((good?change>0:change<0)?"positive":"negative");
  return <article className="digital-kpi-card">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
    <em className={cls}>{compareLabel}: {deltaText(change)}</em>
  </article>;
}

function resolveRange(params:Record<string,string|string[]|undefined>,latest:string,minDate:string){
  const customFrom=parseIso(first(params.from));
  const customTo=parseIso(first(params.to));
  if(customFrom&&customTo){
    let from=clampDate(iso(customFrom),minDate,latest);
    let to=clampDate(iso(customTo),minDate,latest);
    if(from>to) [from,to]=[to,from];
    return {from,to,label:"Довільний період",mode:"custom"};
  }

  const preset=first(params.preset);
  if(preset){
    if(preset==="7d") return {from:addDays(latest,-6),to:latest,label:"Останні 7 днів",mode:preset};
    if(preset==="90d") return {from:addDays(latest,-89),to:latest,label:"Останні 90 днів",mode:preset};
    if(preset==="mtd") return {from:`${latest.slice(0,8)}01`,to:latest,label:"MTD · поточний місяць",mode:preset};
    if(preset==="qtd"){
      const d=new Date(latest+"T00:00:00Z");
      const qStart=Math.floor(d.getUTCMonth()/3)*3;
      return {from:iso(new Date(Date.UTC(d.getUTCFullYear(),qStart,1))),to:latest,label:"QTD · поточний квартал",mode:preset};
    }
    if(preset==="ytd") return {from:`${latest.slice(0,4)}-01-01`,to:latest,label:"YTD · поточний рік",mode:preset};
    return {from:addDays(latest,-29),to:latest,label:"Останні 30 днів",mode:"30d"};
  }

  const year=Number(first(params.year));
  const month=Number(first(params.month)??0);
  if(Number.isFinite(year)&&year>=2025&&year<=Number(latest.slice(0,4))){
    const latestYear=Number(latest.slice(0,4));
    if(month>=1&&month<=12){
      const from=`${year}-${String(month).padStart(2,"0")}-01`;
      const naturalEnd=endOfMonth(year,month);
      const to=year===latestYear&&month===Number(latest.slice(5,7))?latest:naturalEnd;
      return {from:clampDate(from,minDate,latest),to:clampDate(to,minDate,latest),label:`${MONTHS[month]} ${year}`,mode:"month"};
    }
    const from=`${year}-01-01`;
    const to=year===latestYear?latest:`${year}-12-31`;
    return {from:clampDate(from,minDate,latest),to:clampDate(to,minDate,latest),label:String(year),mode:"year"};
  }

  return {from:addDays(latest,-29),to:latest,label:"Останні 30 днів",mode:"30d"};
}

function comparisonRange(from:string,to:string,mode:string){
  if(mode==="yoy") return {from:shiftYear(from,-1),to:shiftYear(to,-1),label:"до минулого року"};
  const days=daysBetween(from,to);
  return {from:addDays(from,-days),to:addDays(from,-1),label:"до попереднього періоду"};
}

export default async function DigitalPage({
  searchParams
}:{
  searchParams?:Promise<Record<string,string|string[]|undefined>>;
}){
  const params=(await searchParams)??{};
  const history=await loadDigitalHistory();
  const latest=history.meta.commonLatest;
  const ga4Min=history.quality.ga4.from??"2025-01-01";
  const searchMin=history.quality.searchConsole.from??"9999-12-31";
  const range=resolveRange(params,latest,ga4Min);
  const compareMode=first(params.compare)==="previous"?"previous":"yoy";
  const compare=comparisonRange(range.from,range.to,compareMode);

  const [data,comparison,local,ads]=await Promise.all([
    loadDigitalData({from:range.from,to:range.to}),
    compare.from>=ga4Min?loadDigitalData({from:compare.from,to:compare.to}):Promise.resolve(null),
    loadDigitalLocalData(),
    loadDigitalAdsData()
  ]);

  const c=data.current;
  const p:DigitalMetrics|null=comparison?.current??null;
  const seo=data.seo;
  const seoAvailable=range.to>=searchMin;
  const seoPartial=seoAvailable&&range.from<searchMin;
  const prevSeo:SeoMetrics|null=(comparison&&range.from>=searchMin&&compare.from>=searchMin)?comparison.seo:null;
  const topChannels=data.channels.slice(0,6);
  const currentYear=Number(latest.slice(0,4));
  const selectedYear=Number(first(params.year)??currentYear);
  const selectedMonth=Number(first(params.month)??0);
  const seoOpportunities=data.seoQueries.filter(row=>row.impressions>=1000&&row.position<=10&&row.ctr<seo.ctr);
  const topTrafficChannel=data.channels[0]??null;
  const unknownLanding=data.landingPages.find(row=>row.landingPage==="(not set)");
  const noConversionCampaigns=ads.campaigns.filter(row=>row.cost>=500&&row.conversions===0);
  const noConversionSpend=noConversionCampaigns.reduce((sum,row)=>sum+row.cost,0);
  const localActions=local.summary.calls+local.summary.directions+local.summary.websiteClicks+local.summary.menuClicks;
  const attentionSignals=[
    local.pageSpeed&&local.pageSpeed.mobileCategory!=="GOOD"?{
      level:"HIGH",title:"Mobile Core Web Vitals",text:`PageSpeed ${Math.round(local.pageSpeed.mobileScore)} · LCP ${Math.round(local.pageSpeed.mobileLcp)} ms · CLS ${local.pageSpeed.mobileCls.toFixed(2)}.`,href:"/digital/site"
    }:null,
    noConversionCampaigns.length?{
      level:"HIGH",title:"Google Ads без conversions",text:`${noConversionCampaigns.length} кампаній витратили ${money(noConversionSpend)} і мають 0 Google Ads conversions у доступному вікні.`,href:"/digital/ads"
    }:null,
    seoOpportunities.length?{
      level:"MEDIUM",title:"SEO CTR можливості",text:`${seoOpportunities.length} запитів у ТОП-10 мають ≥1 000 показів і CTR нижче середнього.`,href:"/digital/seo"
    }:null,
    topTrafficChannel&&topTrafficChannel.conversionRate<c.conversionRate?{
      level:"MEDIUM",title:`Канал: ${topTrafficChannel.channel}`,text:`${pct(c.sessions?topTrafficChannel.sessions/c.sessions:0)} трафіку, але purchase/session ${pct(topTrafficChannel.conversionRate)} проти ${pct(c.conversionRate)} по сайту.`,href:"/digital/channels"
    }:null,
    unknownLanding&&unknownLanding.sessions>0?{
      level:"DATA",title:"Tracking landing page",text:`${compact(unknownLanding.sessions)} сесій мають landing page “(not set)”. Перевіряємо session_start / tracking.`,href:"/digital/tracking"
    }:null
  ].filter(Boolean) as Array<{level:string;title:string;text:string;href:string}>;

  return (
    <main className="shell">
      <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Control Center" statusDetail={`GA4 + Search Console · спільна дата ${dateLabel(latest)}`}/>
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">DIGITAL · CONTROL CENTER</span>
            <h1>Digital-аналітика</h1>
          </div>
          <div className="digital-head-note">
            <span>{range.label}</span>
            <b>{dateLabel(range.from)} — {dateLabel(range.to)}</b>
          </div>
        </header>

        <DigitalTabs active="overview"/>

        <section className="digital-control-bar">
          <div className="digital-control-title"><Filter size={15}/><b>Період огляду</b></div>
          <div className="digital-quick-periods">
            {[
              ["7d","7 днів"],["30d","30 днів"],["90d","90 днів"],["mtd","MTD"],["qtd","QTD"],["ytd","YTD"]
            ].map(([key,label])=>(
              <Link key={key} className={range.mode===key?"active":""} href={`/digital?preset=${key}&compare=${compareMode}`}>{label}</Link>
            ))}
          </div>
          <span className="digital-platform-chip">Платформа: <b>Web</b><small>App — наступний етап</small></span>
        </section>

        <section className="digital-filter-grid">
          <form method="get" className="digital-filter-form">
            <label><span>Від</span><input type="date" name="from" defaultValue={range.from} min={ga4Min} max={latest}/></label>
            <label><span>До</span><input type="date" name="to" defaultValue={range.to} min={ga4Min} max={latest}/></label>
            <label><span>Порівнювати</span>
              <select name="compare" defaultValue={compareMode}>
                <option value="yoy">З минулим роком</option>
                <option value="previous">З попереднім періодом</option>
              </select>
            </label>
            <button className="apply-filter" type="submit">Застосувати</button>
          </form>

          <form method="get" className="digital-filter-form digital-period-form">
            <input type="hidden" name="compare" value={compareMode}/>
            <label><span>Рік</span>
              <select name="year" defaultValue={selectedYear}>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </label>
            <label><span>Місяць</span>
              <select name="month" defaultValue={selectedMonth}>
                {MONTHS.map((name,index)=><option value={index} key={name}>{name}</option>)}
              </select>
            </label>
            <button className="clear-filter" type="submit">Перейти до періоду</button>
          </form>
        </section>

        <section className="digital-kpi-grid">
          <Kpi label="Сесії" value={compact(c.sessions)} hint="візити на сайт · GA4" change={delta(c.sessions,p?.sessions??null)} compareLabel={compare.label}/>
          <Kpi label="Purchase GA4" value={compact(c.purchases)} hint="події purchase · не фінансовий облік" change={delta(c.purchases,p?.purchases??null)} compareLabel={compare.label}/>
          <Kpi label="Конверсія" value={pct(c.conversionRate)} hint="purchase / sessions · діагностична метрика" change={delta(c.conversionRate,p?.conversionRate??null)} compareLabel={compare.label}/>
          <Kpi label="Revenue GA4" value={money(c.purchaseRevenue)} hint="аналітична purchase revenue" change={delta(c.purchaseRevenue,p?.purchaseRevenue??null)} compareLabel={compare.label}/>
          <Kpi label="Середній чек GA4" value={money(c.averageOrderValue)} hint="purchase revenue / purchase" change={delta(c.averageOrderValue,p?.averageOrderValue??null)} compareLabel={compare.label}/>
          <Kpi label="Engagement rate" value={pct(c.engagementRate)} hint="залучені сесії / сесії" change={delta(c.engagementRate,p?.engagementRate??null)} compareLabel={compare.label}/>
          <Kpi label="SEO кліки" value={seoAvailable?compact(seo.clicks):"—"} hint={seoPartial?`часткове покриття з ${dateLabel(searchMin)}`:seoAvailable?"Google Search Console":`немає даних до ${dateLabel(searchMin)}`} change={seoAvailable?delta(seo.clicks,prevSeo?.clicks??null):null} compareLabel={compare.label}/>
          <Kpi label="SEO CTR" value={seoAvailable?pct(seo.ctr):"—"} hint={seoAvailable?`середня позиція ${seo.position.toFixed(1)} · зважено показами`:`історія GSC з ${dateLabel(searchMin)}`} change={seoAvailable?delta(seo.ctr,prevSeo?.ctr??null):null} compareLabel={compare.label}/>
        </section>

        <div className="pnl-section-heading">
          <div><span className="eyebrow">GOOGLE LAYER · LIVE</span><h2>Реклама, локальний попит та швидкість</h2></div>
          <small>Ads: {ads.meta.days} днів · Maps: {local.meta.days} днів · PageSpeed: {local.pageSpeed?dateLabel(local.pageSpeed.capturedOn):"—"}</small>
        </div>
        <section className="digital-kpi-grid">
          <article className="digital-kpi-card"><span>Google Ads Spend</span><strong>{money(ads.summary.cost)}</strong><small>{ads.meta.days} днів автоматичного імпорту</small><em>Google Ads</em></article>
          <article className="digital-kpi-card"><span>CPA Ads</span><strong>{money(ads.summary.cpa)}</strong><small>cost / Google Ads conversions</small><em>{ads.summary.conversions.toFixed(1)} conversions</em></article>
          <article className="digital-kpi-card"><span>ROAS Ads</span><strong>{ads.summary.roas.toFixed(2)}x</strong><small>conversion value / spend</small><em>не фінальний P&L ROAS</em></article>
          <article className="digital-kpi-card"><span>Local actions</span><strong>{compact(localActions)}</strong><small>дзвінки + маршрути + сайт + меню</small><em>{local.meta.locationCount} власні точки</em></article>
          <article className="digital-kpi-card"><span>Google / Maps покази</span><strong>{compact(local.summary.impressions)}</strong><small>Search + Maps</small><em>{local.meta.days} днів</em></article>
          <article className="digital-kpi-card"><span>PageSpeed Mobile</span><strong>{local.pageSpeed?compact(local.pageSpeed.mobileScore):"—"}</strong><small>PSI score · CrUX</small><em>{local.pageSpeed?.mobileCategory==="GOOD"?"Добре":local.pageSpeed?.mobileCategory==="POOR"?"Погано":"Потребує покращення"}</em></article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">MULTI-YEAR TREND</span><h2>2025 ↔ 2026 · місяці та накопичення</h2></div>
            <span className="pnl-source-chip">Жовтень зіставлено 1–{history.meta.cutoffDay}</span>
          </div>
          <DigitalHistoryChart rows={history.monthly} currentYear={history.meta.currentYear} cutoffMonth={history.meta.cutoffMonth} cutoffDay={history.meta.cutoffDay}/>
        </section>

        <section className="panel" style={{marginTop:12}}>
          <div className="panel-head">
            <div><span className="eyebrow">ОБРАНИЙ ПЕРІОД</span><h2>Щоденна динаміка</h2></div>
            <span className="pnl-source-chip">{range.label}</span>
          </div>
          <DigitalTrendChart data={data.trend}/>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">ДІАГНОСТИКА CHECKOUT</span><h2>Сигнали воронки подій GA4</h2></div>
              <Link href="/digital/funnel" className="text-button">Детально →</Link>
            </div>
            <div className="digital-source-flow">
              <div><b>{compact(c.sessions)}</b><span>Сесії</span></div>
              <div><b>{compact(c.addToCarts)}</b><span>Події add_to_cart</span></div>
              <div><b>{compact(c.checkouts)}</b><span>Події begin_checkout</span></div>
              <div><b>{compact(c.purchases)}</b><span>Події purchase</span></div>
            </div>
            <small className="table-note">Це не послідовна user-funnel: сесії та події мають різну одиницю вимірювання. Точну воронку користувачів підключимо окремим GA4 funnel-звітом.</small>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">КАНАЛИ</span><h2>Хто приводить трафік</h2></div>
              <Link href="/digital/channels" className="text-button">Детально →</Link>
            </div>
            <div className="channel-list">
              {topChannels.map(row=>(
                <div className="channel-row" key={row.channel}>
                  <div><b>{row.channel}</b><span>{compact(row.purchases)} purchase · {pct(row.conversionRate)} purchase/session</span></div>
                  <span className="share">{pct(c.sessions?row.sessions/c.sessions:0)}</span>
                  <div className="track"><span style={{width:`${Math.min(100,c.sessions?row.sessions/c.sessions*100:0)}%`}}/></div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {attentionSignals.length>0&&<section className="panel" style={{marginTop:12}}>
          <div className="panel-head">
            <div><span className="eyebrow">ПОТРЕБУЄ УВАГИ</span><h2>Управлінські сигнали</h2></div>
            <span className="pnl-source-chip">правила з фактичних даних</span>
          </div>
          <div className="digital-report-grid">
            {attentionSignals.map(signal=><Link href={signal.href} className="digital-report-card" key={signal.title}>
              <div className="digital-report-icon"><Activity size={18}/></div>
              <div>
                <span>{signal.level}</span>
                <b>{signal.title}</b>
                <p>{signal.text}</p>
              </div>
              <ArrowRight size={15}/>
            </Link>)}
          </div>
        </section>}

        <div className="pnl-section-heading">
          <div><span className="eyebrow">ГРУПА ЗВІТІВ</span><h2>Digital-звіти для бізнес-рішень</h2></div>
          <small>Google layer LIVE · GA4 + Search Console + Ads + Maps + PageSpeed</small>
        </div>

        <section className="digital-report-grid">
          {DIGITAL_REPORTS.map(report=>{
            const Icon=ICONS[report.slug as keyof typeof ICONS] ?? Activity;
            const live=["funnel","channels","seo","site","tracking","ads","local","audience","app"].includes(report.slug);
            const snapshot=report.slug==="social";
            const prepared=report.slug==="commerce";
            const state=live?"LIVE":snapshot?"SNAPSHOT":prepared?"ПІДКЛЮЧЕНО":"ПІДГОТОВЛЕНО";
            return <Link href={`/digital/${report.slug}`} className="digital-report-card" key={report.slug}>
              <div className="digital-report-icon"><Icon size={18}/></div>
              <div>
                <span>{state}</span>
                <b>{report.title}</b>
                <p>{report.description}</p>
              </div>
              <ArrowRight size={15}/>
            </Link>;
          })}
        </section>

        <section className="panel digital-principles">
          <div><span className="eyebrow">ЄДИНА ФІНАНСОВА ПРАВДА</span><h2>Digital не дублює P&L</h2></div>
          <div className="digital-principle-grid">
            <div><b>GA4</b><span>поведінка, сесії, події та аналітична атрибуція.</span></div>
            <div><b>Search Console</b><span>SEO: покази, кліки, CTR та позиції.</span></div>
            <div><b>Операційний BI</b><span>фактичні замовлення й реальна виручка.</span></div>
            <div><b>P&L</b><span>узгоджена прибутковість; витрати не дублюємо в Digital.</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}
