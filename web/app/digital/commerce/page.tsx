import { formatMetric, metricNumber } from "@/lib/digital-quality";
import { merchantPresence } from "@/lib/data/merchant-contract";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalMerchantData } from "@/lib/data/digital-sources";

const n = formatMetric;
function pct(value: number | null) {
  const number = metricNumber(value);
  return number === null ? "—" : (number * 100).toFixed(2) + "%";
}

export default async function Page(){
  const data=await loadDigitalMerchantData();
  const status=merchantPresence(data.meta);
  const performanceReady=(data.meta.performanceRows??0)>0;
  const p=data.performance;
  const latestHealth=data.health[0]??null;
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Merchant" statusDetail={status+" · completeness UNKNOWN"}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · GOOGLE COMMERCE</span><h1>Google Merchant</h1></div><div className="digital-source-badge">Merchant Center · М’ЯСТОРІЯ</div></header>
      <DigitalTabs active="commerce"/>

      {status!=="PARTIAL"&&<div className="lfl-banner">Merchant: {status}. Доступ, schedule та повноту джерела не перевірено. Невідомі значення показано як «—».</div>}

      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Products with performance</span><strong>{performanceReady?n(p.products):"—"}</strong><small>товари з performance rows</small><em>Merchant</em></article>
        <article className="digital-kpi-card"><span>Impressions</span><strong>{performanceReady?n(p.impressions):"—"}</strong><small>видимість товарів у Google</small><em>30-day window</em></article>
        <article className="digital-kpi-card"><span>Clicks</span><strong>{performanceReady?n(p.clicks):"—"}</strong><small>переходи з Merchant surfaces</small><em>{performanceReady?pct(p.ctr):"—"} CTR</em></article>
        <article className="digital-kpi-card"><span>Conversions</span><strong>{performanceReady?n(p.conversions):"—"}</strong><small>Merchant conversion attribution</small><em>після sync</em></article>
        <article className="digital-kpi-card"><span>Catalog rows</span><strong>{n(data.meta.catalogRows)}</strong><small>{n(data.catalog.inStock)+" in stock"}</small><em>{n(data.catalog.outOfStock)+" out of stock"}</em></article>
        <article className="digital-kpi-card"><span>Disapproved</span><strong>{latestHealth?n(latestHealth.disapprovedCount):"—"}</strong><small>{latestHealth?latestHealth.reportingContext:"feed health"}</small><em>{latestHealth?n(latestHealth.pendingCount)+" pending":"—"}</em></article>
      </section>

      <section className="content-grid">
        <article className="panel"><span className="eyebrow">COMMERCE PERFORMANCE</span><div className="digital-decision-list">
          <div><span>1</span><b>Які товари отримують найбільше показів і кліків.</b></div>
          <div><span>2</span><b>Де високі покази, але слабкий CTR.</b></div>
          <div><span>3</span><b>Які товари реально генерують Merchant conversions.</b></div>
          <div><span>4</span><b>Що підсилює Shopping / Performance Max.</b></div>
        </div></article>
        <article className="panel"><span className="eyebrow">FEED HEALTH</span><div className="digital-decision-list">
          <div><span>1</span><b>Active / disapproved / pending / expiring products.</b></div>
          <div><span>2</span><b>Наявність і коректність цін.</b></div>
          <div><span>3</span><b>Проблеми feed, які обрізають покази Google.</b></div>
          <div><span>4</span><b>Окремо Shopping Ads і Free Listings.</b></div>
        </div></article>
      </section>

      <section className="panel" style={{marginTop:12}}>
        <div className="panel-head"><div><span className="eyebrow">TOP PRODUCTS</span><h2>Товари за видимістю</h2></div></div>
        {data.topProducts.length===0?<div className="lfl-banner">Performance rows з’являться тут одразу після першого Merchant → Supabase sync.</div>:
        <div className="management-table-wrap"><div className="management-table" style={{minWidth:900}}>
          <div className="table-row table-head" style={{gridTemplateColumns:"1.8fr .8fr .7fr .7fr .8fr"}}><span>Товар</span><span>Покази</span><span>Кліки</span><span>CTR</span><span>Conversions</span></div>
          {data.topProducts.map(row=><div className="table-row" style={{gridTemplateColumns:"1.8fr .8fr .7fr .7fr .8fr"}} key={row.productId}><b>{row.productTitle||row.productId}</b><span>{n(row.impressions)}</span><span>{n(row.clicks)}</span><span>{pct(row.ctr)}</span><span>{n(row.conversions)}</span></div>)}
        </div></div>}
      </section>
    </section>
  </main>;
}