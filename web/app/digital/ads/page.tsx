import { formatMetric, metricSum } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DigitalAdsTrendChart } from "@/components/DigitalAdsTrendChart";
import { loadDigitalAdsData, type AdsCampaign } from "@/lib/data/digital-sources";

function n(v:number|null|undefined){return formatMetric(v);}
function money(v:number|null){if(v===null)return "—";return `₴ ${Math.round(v).toLocaleString("uk-UA")}`;}
function pct(v:number|null){if(v===null)return "—";return `${(v*100).toFixed(2)}%`;}
function x(v:number|null){if(v===null)return "—";return `${v.toFixed(2)}x`;}
function dateLabel(v:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}
function signal(r:AdsCampaign){
  if(r.cost!==null&&r.cost>=500&&r.conversions===0) return {label:"0 conversions",cls:"negative"};
  if(r.conversions!==null&&r.conversions>0&&r.conversionValue===0) return {label:"Value = 0",cls:""};
  if(r.roas===null) return {label:"ROAS не визначено",cls:""};
  if(r.roas>0&&r.roas<1) return {label:"Value нижче spend",cls:"negative"};
  return {label:"Перевірити",cls:""};
}

export default async function Page(){
  const data=await loadDigitalAdsData();
  const s=data.summary;
  const noConversions=data.campaigns.filter(r=>r.cost!==null&&r.cost>=500&&r.conversions===0);
  const noConversionSpend=metricSum(...noConversions.map(r=>r.cost));
  const unvalued=data.campaigns.filter(r=>r.conversions!==null&&r.conversions>0&&r.conversionValue===0);
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Google Ads" statusDetail={data.meta.available?`LIVE · ${formatMetric(data.meta.days)} календарних днів у вікні`:"джерело підключено · sync очікує"}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · PAID ADVERTISING</span><h1>Google Ads</h1></div><div className="digital-source-badge">акаунт М’ясторія · 824-018-4168</div></header>
      <DigitalTabs active="ads"/>
      <div className="lfl-banner">Дати Google Ads: {data.meta.from || "невідомо"} — {data.meta.to || "невідомо"}. Повнота: {data.meta.coverage}. Календарне вікно не підтверджує кількість днів з даними. Підсумки warehouse та кампанії staging можуть мати різні дати оновлення; валюта не підтверджена контрактом.</div>
      {!data.meta.available?<div className="lfl-banner">Google Ads підключений, але в бойовій таблиці ще немає імпортованих рядків. Нулі не підставляємо — чекаємо фактичний sync.</div>:<>
        <section className="digital-kpi-grid">
          <article className="digital-kpi-card"><span>Витрати</span><strong>{money(s.cost)}</strong><small>Google Ads spend</small><em>{formatMetric(data.meta.days)} календарних днів у вікні</em></article>
          <article className="digital-kpi-card"><span>Кліки</span><strong>{n(s.clicks)}</strong><small>{n(s.impressions)} показів</small><em>CTR {pct(s.ctr)}</em></article>
          <article className="digital-kpi-card"><span>CPC</span><strong>{money(s.cpc)}</strong><small>вартість кліку</small><em>cost / clicks</em></article>
          <article className="digital-kpi-card"><span>Conversions</span><strong>{formatMetric(s.conversions, 1)}</strong><small>конверсії Ads</small><em>CPA {money(s.cpa)}</em></article>
          <article className="digital-kpi-card"><span>Conversion value</span><strong>{money(s.conversionValue)}</strong><small>цінність конверсій Ads</small><em>Google Ads attribution</em></article>
          <article className="digital-kpi-card"><span>ROAS Ads</span><strong>{x(s.roas)}</strong><small>conversion value / spend</small><em>не P&L ROAS</em></article>
        </section>
        {data.meta.days!==null&&data.meta.maxWindowDays!==null&&data.meta.days<data.meta.maxWindowDays&&<div className="lfl-banner">Календарне вікно Google Ads: {formatMetric(data.meta.days)} календарних днів ({dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}). Максимальне вікно контракту — {formatMetric(data.meta.maxWindowDays)} днів.</div>}

        <section className="content-grid">
          <article className="panel">
            <span className="eyebrow">ПОТРЕБУЄ УВАГИ</span>
            <div className="digital-metric-list">
              <div><b>Кампанії у вибірці з витратами ≥ ₴500 і 0 conversions</b><span>{n(noConversions.length)} · {money(noConversionSpend)}</span></div>
              <div><b>Conversions є, але conversion value = 0</b><span>{n(unvalued.length)} кампаній</span></div>
              <div><b>Середній Google Ads ROAS</b><span>{x(s.roas)}</span></div>
            </div>
          </article>
          <article className="panel">
            <span className="eyebrow">ЯК ЧИТАТИ</span>
            <div className="digital-decision-list">
              <div><span>1</span><b>ROAS тут — атрибуція Google Ads, не фінальний бізнес-ROAS.</b></div>
              <div><span>2</span><b>Value = 0 при conversions потребує перевірки цілей і передавання цінності; це не доводить відсутність продажів.</b></div>
              <div><span>3</span><b>Кампанії з витратами та 0 conversions — перші кандидати на перевірку.</b></div>
            </div>
          </article>
        </section>

        <section className="panel" style={{marginTop:12}}>
          <div className="panel-head"><div><span className="eyebrow">DAILY TREND</span><h2>Динаміка Google Ads</h2></div><span className="pnl-source-chip">{dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}</span></div>
          <DigitalAdsTrendChart data={data.trend}/>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span className="eyebrow">CAMPAIGNS</span><h2>Кампанії за витратами</h2></div><span className="pnl-source-chip">{dateLabel(data.meta.from)} — {dateLabel(data.meta.to)}</span></div>
          <div className="management-table-wrap"><div className="management-table" style={{minWidth:1050}}>
            <div className="table-row table-head" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .8fr .8fr .7fr .9fr"}}><span>Кампанія</span><span>Spend</span><span>Кліки</span><span>Conv.</span><span>CPA</span><span>Conv. value</span><span>ROAS</span><span>Сигнал</span></div>
            {data.campaigns.map(r=>{const s=signal(r);return <div className="table-row" style={{gridTemplateColumns:"1.7fr .8fr .7fr .7fr .8fr .8fr .7fr .9fr"}} key={r.campaignName}><b>{r.campaignName}</b><span>{money(r.cost)}</span><span>{n(r.clicks)}</span><span>{formatMetric(r.conversions, 1)}</span><span>{money(r.cpa)}</span><span>{money(r.conversionValue)}</span><span>{x(r.roas)}</span><span className={s.cls}>{s.label}</span></div>})}
          </div></div>
          <small className="table-note">«—» означає, що показник неможливо обчислити: відсутні дані або знаменник дорівнює нулю. ROAS не визначає прибутковість без маржі та перевірки цілей конверсій. Це рекламна атрибуція Google Ads. Реальний бізнес-ROAS згодом рахуємо через фактичні замовлення та виручку warehouse.</small>
        </section>
      </>}
    </section>
  </main>;
}
