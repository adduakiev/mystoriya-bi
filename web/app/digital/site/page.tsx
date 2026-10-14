import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData } from "@/lib/data/digital";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function money(v:number){return `₴ ${Math.round(v).toLocaleString("uk-UA")}`;}
function pct(v:number){return `${(v*100).toFixed(2)}%`;}

export default async function Page(){
  const data=await loadDigitalData();
  const known=data.landingPages.filter(x=>x.landingPage!=="(not set)");
  const unknown=data.landingPages.find(x=>x.landingPage==="(not set)");

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Сайт / UX" statusDetail="GA4 · live"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SITE / UX</span><h1>Сайт та поведінка</h1></div><div className="digital-source-badge">GA4 · landing pages + devices</div></header>
      <DigitalTabs active="site"/>

      <section className="digital-source-flow" style={{marginBottom:12}}>
        {data.devices.map(row=><div key={row.device}><b>{row.device}</b><span>{n(row.sessions)} сесій · {pct(row.conversionRate)} конверсія</span><span>{n(row.purchases)} purchase · {money(row.purchaseRevenue)}</span></div>)}
      </section>

      {unknown&&<div className="lfl-banner">GA4 має {n(unknown.sessions)} сесій із landing page “(not set)”. Це окремий сигнал для перевірки tracking / session_start.</div>}

      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">LANDING PAGES</span><h2>Які сторінки приводять трафік і покупки</h2></div></div>
        <div className="management-table-wrap">
          <div className="management-table" style={{minWidth:950}}>
            <div className="table-row table-head" style={{gridTemplateColumns:"2fr .8fr .8fr .8fr 1fr"}}>
              <span>Landing page</span><span>Сесії</span><span>Purchase</span><span>Конверсія</span><span>Revenue GA4</span>
            </div>
            {known.slice(0,30).map(row=><div className="table-row" style={{gridTemplateColumns:"2fr .8fr .8fr .8fr 1fr"}} key={row.landingPage}>
              <b>{row.landingPage}</b><span>{n(row.sessions)}</span><span>{n(row.purchases)}</span><span>{pct(row.conversionRate)}</span><span>{money(row.purchaseRevenue)}</span>
            </div>)}
          </div>
        </div>
      </section>
    </section>
  </main>;
}
