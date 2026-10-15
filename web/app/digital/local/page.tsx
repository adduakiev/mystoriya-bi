import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalLocalData } from "@/lib/data/digital-sources";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function rate(clicks:number,impressions:number){return impressions?`${(clicks/impressions*100).toFixed(2)}%`:"—";}

export default async function Page(){
  const data=await loadDigitalLocalData();
  const s=data.summary;
  const available=data.locations.length>0;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Google / Maps" statusDetail={available?"Google Business Profile · live":"джерело підключено · sync очікує"}/>
    <section className="workspace">
      <header className="topbar">
        <div><span className="eyebrow">DIGITAL · LOCAL INTELLIGENCE</span><h1>Google / Maps</h1></div>
        <div className="digital-source-badge">Google Business Profile</div>
      </header>
      <DigitalTabs active="local"/>

      {!available ? <div className="lfl-banner">
        Google Business Profile вже підключений: бачу 10 профілів М’ЯСТОРІЇ / MARMOO / Meat Bar. Сам звіт готовий, але для бойового BI треба налаштувати щоденний архів у Supabase — не показуємо порожній sync як нульовий попит.
      </div> : <>
        <section className="digital-kpi-grid">
          <article className="digital-kpi-card"><span>Покази</span><strong>{n(s.impressions)}</strong><small>Search + Maps</small><em>30 днів</em></article>
          <article className="digital-kpi-card"><span>Переходи</span><strong>{n(s.clicks)}</strong><small>дзвінки + website clicks</small><em>CTR {rate(s.clicks,s.impressions)}</em></article>
          <article className="digital-kpi-card"><span>Дзвінки</span><strong>{n(s.calls)}</strong><small>натискання кнопки дзвінка</small><em>Google Business Profile</em></article>
          <article className="digital-kpi-card"><span>Маршрути</span><strong>{n(s.directions)}</strong><small>запити маршруту до точки</small><em>локальний намір</em></article>
          <article className="digital-kpi-card"><span>Переходи на сайт</span><strong>{n(s.websiteClicks)}</strong><small>website clicks</small><em>з профілю Google</em></article>
          <article className="digital-kpi-card"><span>Menu clicks</span><strong>{n(s.menuClicks)}</strong><small>взаємодія з меню</small><em>Google Business Profile</em></article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">LOCATIONS</span><h2>Локальний попит по профілях</h2></div>
          </div>
          <div className="management-table-wrap">
            <div className="management-table" style={{minWidth:980}}>
              <div className="table-row table-head" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .7fr .7fr"}}>
                <span>Профіль</span><span>Покази</span><span>Дзвінки</span><span>Маршрути</span><span>Сайт</span><span>Меню</span>
              </div>
              {data.locations.map(row=><div className="table-row" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .7fr .7fr"}} key={row.locationId}>
                <b>{row.locationTitle}</b><span>{n(row.impressions)}</span><span>{n(row.calls)}</span><span>{n(row.directions)}</span><span>{n(row.websiteClicks)}</span><span>{n(row.menuClicks)}</span>
              </div>)}
            </div>
          </div>
        </section>
      </>}
    </section>
  </main>;
}
