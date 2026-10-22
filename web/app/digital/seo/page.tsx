import { DigitalQualityNotice } from "@/components/DigitalQualityNotice";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData, loadDigitalHistory, loadSeoSnapshots } from "@/lib/data/digital";

function n(v:number|null|undefined){if(v==null)return "—";return Math.round(v).toLocaleString("uk-UA");}
function pct(v:number|null|undefined){if(v==null)return "—";return `${(v*100).toFixed(2)}%`;}
function shortUrl(value:string){try{const u=new URL(value);return u.pathname||"/";}catch{return value;}}

export default async function Page(){
  const [data,history]=await Promise.all([loadDigitalData(),loadDigitalHistory()]);
  const snapshots=await loadSeoSnapshots(data,history);
  const s=data.seo;
  const opportunities=[...snapshots.queries]
    .filter(x=>snapshots.queryPeriodCtr!==null && x.impressions!==null&&x.impressions>=1000 && x.ctr!==null&&x.ctr<snapshots.queryPeriodCtr && x.position!==null&&x.position<=10)
    .sort((a,b)=>(b.impressions ?? -Infinity)-(a.impressions ?? -Infinity))
    .slice(0,10);

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · SEO" statusDetail={`Search Console · дані до ${data.meta.searchLatest || "невідомо"}`}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SEO</span><h1>Органічний пошук</h1></div><div className="digital-source-badge">Google Search Console · 30 днів</div></header>
      <DigitalTabs active="seo"/>
      <DigitalQualityNotice quality={data.quality} sources={data.sources} dates={`GA4 до ${data.meta.ga4Latest || "UNKNOWN"}; GSC до ${data.meta.searchLatest || "UNKNOWN"}. Період: ${data.meta.from || "UNKNOWN"} — ${data.meta.to || "UNKNOWN"}`}/>
      <div className="lfl-banner">Підсумки: {data.meta.from} — {data.meta.to}. Таблиці нижче — окремі 30-денні знімки: запити до {snapshots.queryDate ?? "невідомо"}, сторінки до {snapshots.pageDate ?? "невідомо"}. Це обмежена вибірка, повнота й ліміт джерела UNKNOWN; RPC повертає до 40 запитів та 30 сторінок. Ідентичність збору не підтверджена. Сума запитів може відрізнятися від підсумків сайту через пропуски Search Console.</div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Покази Google</span><strong>{n(s.impressions)}</strong><small>видимість сайту у пошуку</small><em>Search Console</em></article>
        <article className="digital-kpi-card"><span>Кліки</span><strong>{n(s.clicks)}</strong><small>переходи з органічного пошуку</small><em>Search Console</em></article>
        <article className="digital-kpi-card"><span>CTR</span><strong>{pct(s.ctr)}</strong><small>кліки / покази</small><em>чим вище — тим краще</em></article>
        <article className="digital-kpi-card"><span>Середня позиція</span><strong>{(s.position?.toFixed(1) ?? "—")}</strong><small>середня позиція у видачі</small><em>чим нижче число — тим краще</em></article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-head"><div><span className="eyebrow">TOP QUERIES</span><h2>Запити, що приводять кліки</h2></div></div>
          <div className="location-table">
            <div className="table-row table-head"><span>Запит</span><span>Кліки</span><span>CTR</span><span>Позиція</span></div>
            {snapshots.queries.slice(0,15).map(row=><div className="table-row" key={row.name}><b>{row.name}</b><span>{n(row.clicks)}</span><span>{pct(row.ctr)}</span><span>{(row.position?.toFixed(1) ?? "—")}</span></div>)}
            {!snapshots.queries.length&&<p>Немає доступного знімка запитів на дату звіту.</p>}
            <small className="table-note">Показано до 15 із {snapshots.queries.length} отриманих запитів.</small>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span className="eyebrow">SEO OPPORTUNITIES</span><h2>Багато показів, CTR нижче середнього</h2></div></div>
          <div className="channel-list">
            {opportunities.map(row=><div className="channel-row" key={row.name}><div><b>{row.name}</b><span>{n(row.impressions)} показів · позиція {(row.position?.toFixed(1) ?? "—")}</span></div><span className="share">{pct(row.ctr)}</span></div>)}
            {!opportunities.length&&<p>У доступній вибірці немає кандидатів за цим правилом або бракує даних.</p>}
            <small className="table-note">CTR порівнюється з підсумком сайту за період знімка. Це сигнал для аналізу, а не доказ втрати продажів.</small>
          </div>
        </article>
      </section>

      <section className="panel" style={{marginTop:12}}>
        <div className="panel-head"><div><span className="eyebrow">TOP PAGES</span><h2>SEO-сторінки, що приводять трафік</h2></div></div>
        <div className="location-table">
          <div className="table-row table-head"><span>Сторінка</span><span>Кліки</span><span>CTR</span><span>Позиція</span></div>
          {snapshots.pages.slice(0,20).map(row=><div className="table-row" key={row.name}><b>{shortUrl(row.name)}</b><span>{n(row.clicks)}</span><span>{pct(row.ctr)}</span><span>{(row.position?.toFixed(1) ?? "—")}</span></div>)}
          {!snapshots.pages.length&&<p>Немає доступного знімка сторінок на дату звіту.</p>}
          <small className="table-note">Показано до 20 із {snapshots.pages.length} отриманих сторінок.</small>
        </div>
      </section>
    </section>
  </main>;
}
