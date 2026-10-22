import { DigitalQualityNotice } from "@/components/DigitalQualityNotice";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData } from "@/lib/data/digital";
import { loadDigitalLocalData } from "@/lib/data/digital-sources";

function n(v:number|null|undefined){if(v==null)return "—";return Math.round(v).toLocaleString("uk-UA");}
function money(v:number|null|undefined){if(v==null)return "—";return `₴ ${Math.round(v).toLocaleString("uk-UA")}`;}
function pct(v:number|null|undefined){if(v==null)return "—";return `${(v*100).toFixed(2)}%`;}
function ms(v:number|null|undefined){if(v==null)return "—";return `${Math.round(v)} ms`;}
function categoryLabel(v:string){
  if(v==="GOOD") return "Добре";
  if(v==="NEEDS_IMPROVEMENT") return "Потребує покращення";
  if(v==="POOR") return "Погано";
  return "—";
}

export default async function Page(){
  const [data,local]=await Promise.all([loadDigitalData(),loadDigitalLocalData()]);
  const speed=local.pageSpeed;
  const known=data.landingPages.filter(x=>x.landingPage!=="(not set)");
  const unknown=data.landingPages.find(x=>x.landingPage==="(not set)");

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Сайт / UX" statusDetail="GA4 + PageSpeed · live"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SITE / UX</span><h1>Сайт та поведінка</h1></div><div className="digital-source-badge">GA4 + Google PageSpeed</div></header>
      <DigitalTabs active="site"/>
      <DigitalQualityNotice quality={data.quality} sources={data.sources} dates={`GA4 до ${data.meta.ga4Latest || "UNKNOWN"}; GSC до ${data.meta.searchLatest || "UNKNOWN"}. Період: ${data.meta.from || "UNKNOWN"} — ${data.meta.to || "UNKNOWN"}`} snapshot={data.snapshots.landingPages}/>

      {speed&&<div className="lfl-banner">PageSpeed: дата збору {speed.capturedOn}; дата вимірювання та CrUX-вікно UNKNOWN.</div>}
      {speed&&<section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>PageSpeed · Mobile</span><strong>{n(speed.mobileScore)}</strong><small>Google PSI score</small><em>{categoryLabel(speed.mobileCategory)}</em></article>
        <article className="digital-kpi-card"><span>PageSpeed · Desktop</span><strong>{n(speed.desktopScore)}</strong><small>Google PSI score</small><em>{categoryLabel(speed.desktopCategory)}</em></article>
        <article className="digital-kpi-card"><span>Mobile LCP</span><strong>{ms(speed.mobileLcp)}</strong><small>Largest Contentful Paint · CrUX p75</small><em>INP {ms(speed.mobileInp)}</em></article>
        <article className="digital-kpi-card"><span>Mobile CLS</span><strong>{(speed.mobileCls?.toFixed(2) ?? "—")}</strong><small>стабільність layout · CrUX p75</small><em>Desktop CLS {(speed.desktopCls?.toFixed(2) ?? "—")}</em></article>
      </section>}

      {speed&&["POOR","NEEDS_IMPROVEMENT"].includes(speed.mobileCategory)&&<div className="lfl-banner">Mobile Core Web Vitals потребують уваги: PageSpeed {n(speed.mobileScore)}, LCP {ms(speed.mobileLcp)}, INP {ms(speed.mobileInp)}, CLS {(speed.mobileCls?.toFixed(2) ?? "—")}. Поточний статус: {categoryLabel(speed.mobileCategory)}.</div>}

      <section className="digital-source-flow" style={{marginBottom:12}}>
        {data.devices.map(row=><div key={row.device}><b>{row.device}</b><span>{n(row.sessions)} сесій · {pct(row.conversionRate)} конверсія</span><span>{n(row.purchases)} purchase · {money(row.purchaseRevenue)}</span></div>)}
      </section>

      {unknown&&<div className="lfl-banner">GA4 має {n(unknown.sessions)} сесій із landing page “(not set)”. Це окремий сигнал для перевірки tracking / session_start.</div>}

      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">LANDING PAGES</span><h2>Які сторінки приводять трафік і покупки</h2></div></div>
        <div className="management-table-wrap"><div className="management-table" style={{minWidth:950}}>
          <div className="table-row table-head" style={{gridTemplateColumns:"2fr .8fr .8fr .8fr 1fr"}}><span>Landing page</span><span>Сесії</span><span>Purchase</span><span>Конверсія</span><span>Revenue GA4</span></div>
          {known.slice(0,30).map(row=><div className="table-row" style={{gridTemplateColumns:"2fr .8fr .8fr .8fr 1fr"}} key={row.landingPage}><b>{row.landingPage}</b><span>{n(row.sessions)}</span><span>{n(row.purchases)}</span><span>{pct(row.conversionRate)}</span><span>{money(row.purchaseRevenue)}</span></div>)}
        </div></div>
      </section>
    </section>
  </main>;
}
