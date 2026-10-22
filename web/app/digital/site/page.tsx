import { formatMetric } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData, loadDigitalHistory, loadSeoSnapshots } from "@/lib/data/digital";
import { loadDigitalLocalData } from "@/lib/data/digital-sources";

function n(v:number|null|undefined){return formatMetric(v);}
function money(v:number|null){return v===null?"—":`₴ ${formatMetric(v)}`;}
function pct(v:number|null){return v===null?"—":`${(v*100).toFixed(2)}%`;}
function ms(v:number|null){return v===null?"—":`${formatMetric(v)} ms`;}
function categoryLabel(v:string){
  if(v==="GOOD") return "Добре";
  if(v==="NEEDS_IMPROVEMENT") return "Потребує покращення";
  if(v==="POOR") return "Погано";
  return "—";
}

export default async function Page(){
  const [data,local,history]=await Promise.all([loadDigitalData(),loadDigitalLocalData(),loadDigitalHistory()]);
  const snapshots=await loadSeoSnapshots(data,history);
  const speed=local.pageSpeed;
  const known=snapshots.landings.filter(x=>x.landingPage!=="(not set)");
  const unknown=snapshots.landings.find(x=>x.landingPage==="(not set)");

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Сайт / UX" statusDetail="GA4 + PageSpeed · live"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SITE / UX</span><h1>Сайт та поведінка</h1></div><div className="digital-source-badge">GA4 + Google PageSpeed</div></header>
      <DigitalTabs active="site"/>
      <div className="lfl-banner">GA4: {data.meta.from} — {data.meta.to}; дані до {data.meta.ga4Latest || "невідомо"}. Дата пристроїв: {history.quality.devices.to ?? "невідомо"}. Landing pages: {snapshots.landingPeriod?.from ?? "недоступно"} — {snapshots.landingPeriod?.to ?? "недоступно"}, RPC до 30 рядків; повнота UNKNOWN. PageSpeed оброблено: {speed?.capturedOn ?? "невідомо"}; дата вимірювання невідома. CrUX-вікно невідоме. Історія показує лише найновішу дату знімка: якщо вона після cutoff, старіший знімок недоступний.</div>

      {speed&&<section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>PageSpeed · Mobile</span><strong>{n(speed.mobileScore)}</strong><small>Google PSI score</small><em>{categoryLabel(speed.mobileCategory)}</em></article>
        <article className="digital-kpi-card"><span>PageSpeed · Desktop</span><strong>{n(speed.desktopScore)}</strong><small>Google PSI score</small><em>{categoryLabel(speed.desktopCategory)}</em></article>
        <article className="digital-kpi-card"><span>Mobile LCP</span><strong>{ms(speed.mobileLcp)}</strong><small>Largest Contentful Paint · CrUX p75</small><em>INP {ms(speed.mobileInp)}</em></article>
        <article className="digital-kpi-card"><span>Mobile CLS</span><strong>{formatMetric(speed.mobileCls, 2)}</strong><small>стабільність layout · CrUX p75</small><em>Desktop CLS {formatMetric(speed.desktopCls, 2)}</em></article>
      </section>}

      {speed&&["POOR","NEEDS_IMPROVEMENT"].includes(speed.mobileCategory)&&<div className="lfl-banner">Mobile Core Web Vitals потребують уваги: PageSpeed {n(speed.mobileScore)}, LCP {ms(speed.mobileLcp)}, INP {ms(speed.mobileInp)}, CLS {formatMetric(speed.mobileCls, 2)}. Поточний статус: {categoryLabel(speed.mobileCategory)}.</div>}

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
