import { formatMetric } from "@/lib/digital-quality";
import { sourceMoney as money } from "@/lib/source-evidence";
import { adsCampaignSignal as signal, hasSpendWithoutConversions } from "@/lib/ads-presentation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DigitalAdsTrendChart } from "@/components/DigitalAdsTrendChart";
import { DigitalSourceEvidence } from "@/components/DigitalSourceEvidence";
import { loadDigitalMetaAdsData, loadDigitalAdsData } from "@/lib/data/digital-sources";

function n(v:number|null|undefined){return formatMetric(v);}
function pct(v:number|null){if(v===null)return "—";return `${(v*100).toFixed(2)}%`;}
function x(v:number|null){if(v===null)return "—";return `${v.toFixed(2)}x`;}
function dateLabel(v:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}

export default async function Page(){
  const [googleResult, metaResult]=await Promise.allSettled([loadDigitalAdsData(), loadDigitalMetaAdsData()]);
  if (googleResult.status === "rejected") throw googleResult.reason;
  const data=googleResult.value;
  const meta=metaResult.status === "fulfilled" ? metaResult.value : null;
  const s=data.summary;
  const noConversions=data.campaigns.filter(hasSpendWithoutConversions);
  const unvalued=data.campaigns.filter(r=>r.conversions!==null&&r.conversions>0&&r.conversionValue===0);
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Paid Advertising" statusDetail={`Google Ads ${data.meta.available ? "дані є" : "очікує"} · Meta Ads ${meta?.meta.status ?? "недоступно"}`}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · PAID ADVERTISING</span><h1>Paid Advertising · Google Ads / Meta Ads</h1></div><div className="digital-source-badge">Google Ads · М’ясторія · 824-018-4168</div></header>
      <DigitalTabs active="ads"/>
      <h2>Google Ads · окрема атрибуція</h2>
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
              <div><b>Кампанії у вибірці з витратами і 0 conversions · без грошового порогу</b><span>{n(noConversions.length)}</span></div>
              <div><b>Conversions є, але conversion value = 0</b><span>{n(unvalued.length)} кампаній</span></div>
              <div><b>Середній Google Ads ROAS</b><span>{x(s.roas)}</span></div>
            </div>
          </article>
          <article className="panel">
            <span className="eyebrow">ЯК ЧИТАТИ</span>
            <div className="digital-decision-list">
              <div><span>1</span><b>ROAS тут — атрибуція Google Ads, не фінальний бізнес-ROAS.</b></div>
              <div><span>2</span><b>Value = 0 при conversions потребує перевірки цілей і передавання цінності; це не доводить відсутність продажів.</b></div>
              <div><span>3</span><b>Валюта Google Ads UNKNOWN. Грошові значення та поріг 500 приховано до підтвердження валюти; кількість кампаній з витратами та 0 conversions — спостереження для перевірки, без ранжування бюджету.</b></div>
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
      <h2>Meta Ads · окрема атрибуція</h2>
      {meta ? <>
      <DigitalSourceEvidence name="Meta Ads" evidence={meta.meta}/>
      <div className="lfl-banner">Google Ads conversion value та Meta purchase value мають різну атрибуцію. Не підсумовуємо їх та не об’єднуємо ROAS. Валюта з джерела показана окремо; акаунти та налаштування атрибуції Meta ще не звірені. ROAS потребує перевірки атрибуції. Reach / frequency недоступні: їх не можна складати між оголошеннями та днями.</div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Meta spend</span><strong>{n(meta.summary.spend)}</strong><small>{meta.meta.currency || "валюта невідома / змішана"}</small><em>{meta.meta.status}</em></article>
        <article className="digital-kpi-card"><span>Meta clicks</span><strong>{n(meta.summary.clicks)}</strong><small>{n(meta.summary.impressions)} показів</small><em>CTR {pct(meta.summary.ctr)}</em></article>
        <article className="digital-kpi-card"><span>Meta purchases</span><strong>{n(meta.summary.purchases)}</strong><small>атрибуція Meta Ads</small></article>
        <article className="digital-kpi-card"><span>Meta purchase value</span><strong>{n(meta.summary.purchaseValue)}</strong><small>{meta.meta.currency || "валюта невідома / змішана"}</small></article>
        <article className="digital-kpi-card"><span>Meta ROAS</span><strong>{x(meta.summary.roas)}</strong><small>purchase value / spend</small><em>атрибуція Meta Ads</em></article>
      </section>
      {meta.campaigns.length > 0 && <section className="panel">
        <h2>Meta campaigns · за витратами</h2>
        <div className="management-table-wrap"><div className="management-table" style={{minWidth:800}}>
          <div className="table-row table-head" style={{gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr"}}><span>Кампанія / account</span><span>Spend</span><span>Purchases</span><span>Purchase value</span><span>ROAS</span></div>
          {meta.campaigns.map(r => <div className="table-row" style={{gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr"}} key={`${r.accountId}:${r.campaignId}:${r.currency}`}><b>{r.campaignName || r.campaignId} · {r.accountId} · {r.currency || "валюта невідома"}</b><span>{n(r.spend)}</span><span>{n(r.purchases)}</span><span>{n(r.purchaseValue)}</span><span>{x(r.roas)}</span></div>)}
        </div></div><small>Ліміт 50 кампаній; повнота невідома. Різні валюти не підсумовуємо; конвертацію не виконуємо.</small>
      </section>}
      {!meta.meta.available && <small>Для Meta Ads немає підтверджених вимірювань періоду. До перевірки джерела показники недоступні для бюджетних рішень.</small>}
      </> : <div className="lfl-banner">Meta Ads · джерело недоступне. Статус і показники не визначені; спробуйте пізніше.</div>}
    </section>
  </main>;
}
