import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData } from "@/lib/data/digital";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function pct(v:number){return `${(v*100).toFixed(2)}%`;}
function shortUrl(value:string){try{const u=new URL(value);return u.pathname||"/";}catch{return value;}}

export default async function Page(){
  const data=await loadDigitalData();
  const s=data.seo;
  const opportunities=[...data.seoQueries]
    .filter(x=>x.impressions>=1000 && x.ctr<s.ctr && x.position<=10)
    .sort((a,b)=>b.impressions-a.impressions)
    .slice(0,10);

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · SEO" statusDetail="Search Console · live"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SEO</span><h1>Органічний пошук</h1></div><div className="digital-source-badge">Google Search Console · 30 днів</div></header>
      <DigitalTabs active="seo"/>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Покази Google</span><strong>{n(s.impressions)}</strong><small>видимість сайту у пошуку</small><em>Search Console</em></article>
        <article className="digital-kpi-card"><span>Кліки</span><strong>{n(s.clicks)}</strong><small>переходи з органічного пошуку</small><em>Search Console</em></article>
        <article className="digital-kpi-card"><span>CTR</span><strong>{pct(s.ctr)}</strong><small>кліки / покази</small><em>чим вище — тим краще</em></article>
        <article className="digital-kpi-card"><span>Середня позиція</span><strong>{s.position.toFixed(1)}</strong><small>середня позиція у видачі</small><em>чим нижче число — тим краще</em></article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-head"><div><span className="eyebrow">TOP QUERIES</span><h2>Запити, що приводять кліки</h2></div></div>
          <div className="location-table">
            <div className="table-row table-head"><span>Запит</span><span>Кліки</span><span>CTR</span><span>Позиція</span></div>
            {data.seoQueries.slice(0,15).map(row=><div className="table-row" key={row.name}><b>{row.name}</b><span>{n(row.clicks)}</span><span>{pct(row.ctr)}</span><span>{row.position.toFixed(1)}</span></div>)}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span className="eyebrow">SEO OPPORTUNITIES</span><h2>Багато показів, CTR нижче середнього</h2></div></div>
          <div className="channel-list">
            {opportunities.map(row=><div className="channel-row" key={row.name}><div><b>{row.name}</b><span>{n(row.impressions)} показів · позиція {row.position.toFixed(1)}</span></div><span className="share">{pct(row.ctr)}</span></div>)}
          </div>
        </article>
      </section>

      <section className="panel" style={{marginTop:12}}>
        <div className="panel-head"><div><span className="eyebrow">TOP PAGES</span><h2>SEO-сторінки, що приводять трафік</h2></div></div>
        <div className="location-table">
          <div className="table-row table-head"><span>Сторінка</span><span>Кліки</span><span>CTR</span><span>Позиція</span></div>
          {data.seoPages.slice(0,20).map(row=><div className="table-row" key={row.name}><b>{shortUrl(row.name)}</b><span>{n(row.clicks)}</span><span>{pct(row.ctr)}</span><span>{row.position.toFixed(1)}</span></div>)}
        </div>
      </section>
    </section>
  </main>;
}
