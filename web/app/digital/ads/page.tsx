import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalAdsData } from "@/lib/data/digital-sources";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function money(v:number){return `₴ ${Math.round(v).toLocaleString("uk-UA")}`;}
function pct(v:number){return `${(v*100).toFixed(2)}%`;}
function x(v:number){return `${v.toFixed(2)}x`;}
function dateLabel(v:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}

export default async function Page(){
  const data=await loadDigitalAdsData();
  const s=data.summary;
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Google Ads" statusDetail={data.meta.available?`LIVE · ${data.meta.days} днів імпорту`:"джерело підключено · sync очікує"}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · PAID ADVERTISING</span><h1>Google Ads</h1></div><div className="digital-source-badge">акаунт М’ясторія · 824-018-4168</div></header>
      <DigitalTabs active="ads"/>
      {!data.meta.available?<div className="lfl-banner">Google Ads підключений, але в бойовій таблиці ще немає імпортованих рядків. Нулі не підставляємо — чекаємо фактичний sync.</div>:<>
        <section className="digital-kpi-grid">
          <article className="digital-kpi-card"><span>Витрати</span><strong>{money(s.cost)}</strong><small>Google Ads spend</small><em>{data.meta.days} днів імпорту</em></article>
          <article className="digital-kpi-card"><span>Кліки</span><strong>{n(s.clicks)}</strong><small>{n(s.impressions)} показів</small><em>CTR {pct(s.ctr)}</em></article>
          <article className="digital-kpi-card"><span>CPC</span><strong>{money(s.cpc)}</strong><small>вартість кліку</small><em>cost / clicks</em></article>
          <article className="digital-kpi-card"><span>Conversions</span><strong>{s.conversions.toFixed(1)}</strong><small>конверсії Ads</small><em>CPA {money(s.cpa)}</em></article>
          <article className="digital-kpi-card"><span>Conversion value</span><strong>{money(s.conversionValue)}</strong><small>цінність конверсій Ads</small><em>Google Ads attribution</em></article>
          <article className="digital-kpi-card"><span>ROAS Ads</span><strong>{x(s.roas)}</strong><small>conversion value / spend</small><em>не P&L ROAS</em></article>
        </section>
        {data.meta.days<data.meta.maxWindowDays&&<div className="lfl-banner">Автоматичний архів Google Ads запущений: зараз накопичено {data.meta.days} днів ({dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}). Вікно саме доросте до {data.meta.maxWindowDays} днів.</div>}
        <section className="panel">
          <div className="panel-head"><div><span className="eyebrow">CAMPAIGNS</span><h2>Кампанії за витратами</h2></div><span className="pnl-source-chip">{dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}</span></div>
          <div className="management-table-wrap"><div className="management-table" style={{minWidth:1050}}>
            <div className="table-row table-head" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .8fr .8fr .7fr"}}><span>Кампанія</span><span>Spend</span><span>Кліки</span><span>Conv.</span><span>CPA</span><span>Conv. value</span><span>ROAS</span></div>
            {data.campaigns.map(r=><div className="table-row" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .8fr .8fr .7fr"}} key={r.campaignName}><b>{r.campaignName}</b><span>{money(r.cost)}</span><span>{n(r.clicks)}</span><span>{r.conversions.toFixed(1)}</span><span>{money(r.cpa)}</span><span>{money(r.conversionValue)}</span><span>{x(r.roas)}</span></div>)}
          </div></div>
          <small className="table-note">Це рекламна атрибуція Google Ads. Реальний бізнес-ROAS згодом рахуємо через фактичні замовлення та виручку warehouse.</small>
        </section>
      </>}
    </section>
  </main>;
}
