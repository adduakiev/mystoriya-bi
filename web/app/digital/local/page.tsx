import { formatMetric, metricRatio, metricSum } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalLocalData } from "@/lib/data/digital-sources";
import { labelGbpLocations } from "@/lib/gbp-location-labels";

function n(v:number|null|undefined){return formatMetric(v);}
function rate(clicks:number|null,impressions:number|null){return pct(metricRatio(clicks,impressions));}
function pct(v:number|null){return v===null?"—":`${(v*100).toFixed(2)}%`;}
function dateLabel(v:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}

export default async function Page(){
  const data=await loadDigitalLocalData();
  const s=data.summary;
  const available=Object.values(s).some(value=>value!==null);
  const ranked=labelGbpLocations(data.locations).map(row=>({
    ...row,
    intentActions:metricSum(row.calls,row.directions,row.websiteClicks,row.menuClicks),
    intentRate:metricRatio(metricSum(row.calls,row.directions,row.websiteClicks,row.menuClicks),row.impressions)
  })).sort((a,b)=>(b.intentActions??-Infinity)-(a.intentActions??-Infinity));
  const topIntent=ranked[0]??null;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Google / Maps" statusDetail={available?`PARTIAL · completeness UNKNOWN · ${formatMetric(data.meta.locationCount)} GBP-профілів · ${formatMetric(data.meta.days)} днів`:"джерело підключено · sync очікує"}/>
    <section className="workspace">
      <header className="topbar">
        <div><span className="eyebrow">DIGITAL · LOCAL INTELLIGENCE</span><h1>Google / Maps</h1></div>
        <div className="digital-source-badge">Google Business Profile · {formatMetric(data.meta.locationCount)} GBP-профілів</div>
      </header>
      <DigitalTabs active="local"/>
      <div className="lfl-banner">Дати GBP: {data.meta.from || "невідомо"} — {data.meta.to || "невідомо"}. Повнота: {data.meta.coverage}. Фактична кількість рядків та пропуски по точках невідомі.</div>

      {!available ? <div className="lfl-banner">
        Джерело Google Business Profile підключене, але за період звіту немає підтверджених вимірювань. Належність профілів до власних закладів не підтверджена.
      </div> : <>
        <section className="digital-kpi-grid">
          <article className="digital-kpi-card"><span>Покази</span><strong>{n(s.impressions)}</strong><small>Search + Maps</small><em>{formatMetric(data.meta.days)} календарних днів у вікні</em></article>
          <article className="digital-kpi-card"><span>Переходи</span><strong>{n(s.clicks)}</strong><small>дзвінки + website clicks</small><em>CTR {rate(s.clicks,s.impressions)}</em></article>
          <article className="digital-kpi-card"><span>Дзвінки</span><strong>{n(s.calls)}</strong><small>натискання кнопки дзвінка</small><em>Google Business Profile</em></article>
          <article className="digital-kpi-card"><span>Маршрути</span><strong>{n(s.directions)}</strong><small>запити маршруту до точки</small><em>локальний намір</em></article>
          <article className="digital-kpi-card"><span>Переходи на сайт</span><strong>{n(s.websiteClicks)}</strong><small>website clicks</small><em>з профілю Google</em></article>
          <article className="digital-kpi-card"><span>Menu clicks</span><strong>{n(s.menuClicks)}</strong><small>взаємодія з меню</small><em>Google Business Profile</em></article>
        </section>

        <div className="lfl-banner">Звіт охоплює GBP-профілі підключеного джерела. Прив’язка GBP ID до фізичних адрес, власності та брендів не підтверджена; виключення франшиз та інших брендів не доведене. Період: {dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}.</div>

        {topIntent&&<section className="content-grid">
          <article className="panel">
            <span className="eyebrow">LOCAL INTENT</span>
            <div className="digital-metric-list">
              <div><b>Усі локальні дії</b><span>{n(metricSum(s.calls,s.directions,s.websiteClicks,s.menuClicks))}</span></div>
              <div><b>Дії / покази</b><span>{rate(metricSum(s.calls,s.directions,s.websiteClicks,s.menuClicks),s.impressions)}</span></div>
              <div><b>Найбільше локальних дій</b><span aria-label={`${n(topIntent.intentActions)} · ${topIntent.locationLabel} · ${topIntent.locationIdentityNote}`}>{n(topIntent.intentActions)} · {topIntent.locationLabel}</span></div>
            </div>
          </article>
          <article className="panel">
            <span className="eyebrow">ЩО ВВАЖАЄМО НАМІРОМ</span>
            <div className="digital-decision-list">
              <div><span>1</span><b>Маршрут до закладу.</b></div>
              <div><span>2</span><b>Дзвінок або перехід на сайт.</b></div>
              <div><span>3</span><b>Перегляд / взаємодія з меню.</b></div>
            </div>
          </article>
        </section>}

        <section className="panel">
          <div className="panel-head">
            <div><span className="eyebrow">LOCATIONS</span><h2>Локальний попит по профілях</h2></div>
          </div>
          <div className="management-table-wrap">
            <div className="management-table" style={{minWidth:980}}>
              <div className="table-row table-head" style={{gridTemplateColumns:"1.55fr .7fr .65fr .65fr .65fr .65fr .7fr .7fr"}}>
                <span>Профіль</span><span>Покази</span><span>Дзвінки</span><span>Маршрути</span><span>Сайт</span><span>Меню</span><span>Дії</span><span>Action rate</span>
              </div>
              {ranked.map(row=><div className="table-row" style={{gridTemplateColumns:"1.55fr .7fr .65fr .65fr .65fr .65fr .7fr .7fr"}} key={row.locationId}>
                <div><b>{row.locationLabel}</b><small className="table-note">{row.locationIdentityNote}</small></div><span>{n(row.impressions)}</span><span>{n(row.calls)}</span><span>{n(row.directions)}</span><span>{n(row.websiteClicks)}</span><span>{n(row.menuClicks)}</span><span>{n(row.intentActions)}</span><span>{pct(row.intentRate)}</span>
              </div>)}
            </div>
          </div>
        </section>
      </>}
    </section>
  </main>;
}
