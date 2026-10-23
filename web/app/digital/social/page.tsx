import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DigitalSourceEvidence } from "@/components/DigitalSourceEvidence";
import { loadDigitalSocialData, type SocialContent } from "@/lib/data/digital-sources";
import { formatMetric, metricRatio } from "@/lib/digital-quality";

const n = formatMetric;
function pct(v: number | null) { return v === null ? "—" : (v * 100).toFixed(2) + "%"; }
function short(v: string) { return v.length > 120 ? v.slice(0, 117) + "…" : v; }
function Content({title, rows}: {title: string; rows: SocialContent[]}) {
  return <section className="panel" style={{marginTop: 12}}>
    <div className="panel-head"><h2>{title}</h2></div>
    <small>Повернуто {rows.length} записів, ліміт 30; повнота невідома. Дата публікації не підтверджує свіжість Insights. «—» — невідомий показник.</small>
    {rows.length === 0 ? <p>Немає даних контенту.</p> : <div className="management-table-wrap"><div className="management-table" style={{minWidth: 980}}>
      <div className="table-row table-head" style={{gridTemplateColumns: "2.4fr .65fr .65fr .65fr .65fr"}}><span>Контент</span><span>Impr.</span><span>Reach</span><span>Clicks</span><span>Eng.</span></div>
      {rows.map(row => <div className="table-row" style={{gridTemplateColumns: "2.4fr .65fr .65fr .65fr .65fr"}} key={row.id}>
        <b>{short(row.message || row.id)}<small> · {row.publishedAt || "—"}</small></b><span>{n(row.impressions)}</span><span>{n(row.reach)}</span><span>{n(row.clicks)}</span><span>{n(row.engagements)}</span>
      </div>)}
    </div></div>}
  </section>;
}
export default async function Page() {
  const data = await loadDigitalSocialData();
  const f = data.facebook, i = data.instagram;
  const delta = f.followers !== null && f.followersStart !== null ? f.followers - f.followersStart : null;
  const organicShare = metricRatio(f.organicImpressions, f.impressions);
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Social" statusDetail={`Facebook ${f.evidence.status} · Instagram ${i.evidence.status}`}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · SOCIAL</span><h1>Facebook / Instagram Organic</h1></div><div className="digital-source-badge">Organic Social</div></header>
      <DigitalTabs active="social"/>
      <div className="lfl-banner">Facebook та Instagram мають окремі періоди джерела. Застарілі вимірювання залишаються видимими зі статусом STALE. Невідомі значення — «—». Total Page impressions можуть включати платні покази.</div>
      <DigitalSourceEvidence name="Facebook Organic" evidence={f.evidence}/>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Followers · Facebook</span><strong>{n(f.followers)}</strong><small>Зміна між кінцями періоду: {n(delta)}</small><em>{n(f.dailyFollows)} follows · {n(f.dailyUnfollows)} unfollows</em></article>
        <article className="digital-kpi-card"><span>Total impressions</span><strong>{n(f.impressions)}</strong><small>усі Page impressions</small><em>Facebook</em></article>
        <article className="digital-kpi-card"><span>Organic impressions</span><strong>{n(f.organicImpressions)}</strong><small>{pct(organicShare)} від total impressions</small><em>Facebook</em></article>
        <article className="digital-kpi-card"><span>Page Views</span><strong>{n(f.pageViews)}</strong><small>перегляди сторінки</small><em>Facebook</em></article>
      </section>
      <DigitalSourceEvidence name="Instagram Organic" evidence={i.evidence}/>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Followers · Instagram</span><strong>{n(i.followers)}</strong><small>{i.evidence.status}</small><em>останній вимір періоду</em></article>
        <article className="digital-kpi-card"><span>Impressions</span><strong>{n(i.impressions)}</strong><small>Instagram</small></article>
        <article className="digital-kpi-card"><span>Profile views</span><strong>{n(i.profileViews)}</strong><small>Instagram</small></article>
        <article className="digital-kpi-card"><span>Website clicks</span><strong>{n(i.websiteClicks)}</strong><small>Instagram</small></article>
      </section>
      <section className="panel">
        <h2>Як читати дані</h2>
        <p>Зміна аудиторії Facebook за період: {n(delta)}. Частка organic impressions: {pct(organicShare)}. Порівняння потребує звіреної повноти періодів.</p>
        <p>Reach та accounts engaged за кілька днів не підсумовуємо як унікальну аудиторію. Метрики Meta Ads дивіться окремо у звіті «Реклама».</p>
        <p>Рядки за всю історію: Facebook {n(data.meta.facebookRows)}, пости {n(data.meta.facebookPostRows)}; Instagram {n(data.meta.instagramRows)}, media {n(data.meta.instagramMediaRows)}. Ці кількості не доводять повноту вибраного періоду.</p>
        <small>Історичні нулі потребують звірки з джерелом: частина пропусків могла бути збережена як 0. Перед рішеннями перевірте повноту та походження показників.</small>
      </section>
      <Content title="Facebook content · за impressions" rows={data.facebookPosts}/>
      <Content title="Instagram media · за reach" rows={data.instagramMedia}/>
    </section>
  </main>;
}
