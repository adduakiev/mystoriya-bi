import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalSocialData } from "@/lib/data/digital-sources";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function pct(v:number){return (v*100).toFixed(2)+"%";}
function short(v:string){return v.length>120?v.slice(0,117)+"…":v;}

export default async function Page(){
  const data=await loadDigitalSocialData();
  const f=data.facebook;
  const followerDelta=f.followers-f.followersStart;
  const organicShare=f.impressions>0?f.organicImpressions/f.impressions:0;
  const fbAvailable=data.meta.facebookStatus==="live";
  const igLive=data.meta.instagramStatus==="live";

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Social" statusDetail="Facebook SNAPSHOT · Instagram очікує"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SOCIAL</span><h1>Facebook / Instagram Organic</h1></div><div className="digital-source-badge">Organic Social</div></header>
      <DigitalTabs active="social"/>

      <div className="lfl-banner">Facebook Organic уже завантажений у наш warehouse як актуальний snapshot. Total impressions і organic impressions показуємо окремо, бо Facebook Page impressions можуть включати не лише чисту органіку. Instagram підключимо окремим OAuth і додамо в цей же звіт.</div>

      <div className="pnl-section-heading"><div><span className="eyebrow">FACEBOOK · 30 DAYS</span><h2>Органічна аудиторія та контент</h2></div><small>{f.from&&f.to?f.from+" — "+f.to:"—"}</small></div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Followers</span><strong>{fbAvailable?n(f.followers):"—"}</strong><small>{fbAvailable?(followerDelta>=0?"+":"")+n(followerDelta)+" за 30 днів":"—"}</small><em>{fbAvailable?n(f.dailyFollows)+" follows · "+n(f.dailyUnfollows)+" unfollows":"—"}</em></article>
        <article className="digital-kpi-card"><span>Total impressions</span><strong>{fbAvailable?n(f.impressions):"—"}</strong><small>усі Page impressions</small><em>не трактуємо як чисту органіку</em></article>
        <article className="digital-kpi-card"><span>Organic impressions</span><strong>{fbAvailable?n(f.organicImpressions):"—"}</strong><small>{fbAvailable?pct(organicShare)+" від total impressions":"—"}</small><em>organic distribution</em></article>
        <article className="digital-kpi-card"><span>Page Views</span><strong>{fbAvailable?n(f.pageViews):"—"}</strong><small>перегляди сторінки</small><em>Facebook</em></article>
        <article className="digital-kpi-card"><span>Posts in warehouse</span><strong>{n(data.meta.facebookPostRows)}</strong><small>за доступну історію</small><em>{n(data.meta.facebookRows)} daily rows</em></article>
        <article className="digital-kpi-card"><span>Instagram</span><strong>{igLive?n(data.instagram.followers):"—"}</strong><small>{igLive?"LIVE":"очікує авторизацію"}</small><em>Insights connector ready</em></article>
      </section>

      <section className="content-grid">
        <article className="panel"><span className="eyebrow">SOCIAL SIGNAL</span><div className="digital-decision-list">
          <div><span>1</span><b>Аудиторія Facebook за 30 днів скоротилася на {Math.abs(followerDelta)} підписників.</b></div>
          <div><span>2</span><b>Organic impressions становлять лише {pct(organicShare)} від total Page impressions — ці метрики не можна змішувати.</b></div>
          <div><span>3</span><b>Найкращий контент оцінюємо окремо за reach, clicks і engagement, а не лише за impressions.</b></div>
          <div><span>4</span><b>Після Instagram і правильного Meta Ads account зведемо Organic + Paid в один Social acquisition view.</b></div>
        </div></article>
        <article className="panel"><span className="eyebrow">SOURCE STATUS</span><div className="digital-metric-list">
          <div><b>Facebook Organic</b><span>SNAPSHOT · {n(data.meta.facebookRows)} daily rows · {n(data.meta.facebookPostRows)} posts</span></div>
          <div><b>Instagram Organic</b><span>{igLive?"LIVE":"очікує OAuth"}</span></div>
          <div><b>Meta Ads</b><span>очікує правильний Ad Account М’ЯСТОРІЯ</span></div>
        </div></article>
      </section>

      <section className="panel" style={{marginTop:12}}>
        <div className="panel-head"><div><span className="eyebrow">TOP FACEBOOK CONTENT</span><h2>Пости за impressions</h2></div></div>
        <div className="management-table-wrap"><div className="management-table" style={{minWidth:980}}>
          <div className="table-row table-head" style={{gridTemplateColumns:"2.4fr .65fr .65fr .65fr .65fr"}}><span>Пост</span><span>Impr.</span><span>Reach</span><span>Clicks</span><span>Eng.</span></div>
          {data.facebookPosts.map(row=><div className="table-row" style={{gridTemplateColumns:"2.4fr .65fr .65fr .65fr .65fr"}} key={row.postId}><b>{short(row.message||row.postId)}</b><span>{n(row.impressions)}</span><span>{n(row.reach)}</span><span>{n(row.clicks)}</span><span>{n(row.engagements)}</span></div>)}
        </div></div>
      </section>
    </section>
  </main>;
}