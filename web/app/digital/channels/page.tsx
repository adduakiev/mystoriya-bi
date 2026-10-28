import { ga4Money as money, GA4_MONEY_NOTICE } from "@/lib/ga4-presentation";
import { formatMetric, dimensionWindowEvidence } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData, loadDigitalHistory } from "@/lib/data/digital";

function n(v:number|null|undefined){return formatMetric(v);}
function pct(v:number|null){return v===null?"—":`${(v*100).toFixed(2)}%`;}

export default async function Page(){
  const [data,history]=await Promise.all([loadDigitalData(),loadDigitalHistory()]);
  const evidence=dimensionWindowEvidence(data.meta.from,data.meta.to,history.quality.channels.from,history.quality.channels.to);
  const bound=evidence.maximumPossibleDays===null?"UNKNOWN":`не більше ${evidence.maximumPossibleDays} із ${evidence.selectedDays} днів`;
  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Канали" statusDetail="GA4 · PARTIAL · completeness UNKNOWN"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · КАНАЛИ</span><h1>Канали залучення</h1></div><div className="digital-source-badge">GA4 · Session default channel group</div></header>
      <DigitalTabs active="channels"/>
      <div className="lfl-banner">{GA4_MONEY_NOTICE}</div>
      <div className="lfl-banner">GA4: {data.meta.from} — {data.meta.to}; дані до {data.meta.ga4Latest || "невідомо"}. Дата каналів: {history.quality.channels.to ?? "невідомо"}; за датами джерела доступно ${bound}; фактична кількість днів UNKNOWN. Частка від усіх GA4-сесій прихована: немає доказу повноти та зіставності знаменника.</div>
      <section className="digital-kpi-grid">
        {data.channels.slice(0,4).map(row=><article className="digital-kpi-card" key={row.channel}>
          <span>{row.channel}</span><strong>{n(row.sessions)}</strong>
          <small>{pct(null)} трафіку · {n(row.purchases)} покупок</small>
          <em>{pct(row.conversionRate)} конверсія</em>
        </article>)}
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">CHANNEL PERFORMANCE</span><h2>Трафік → покупки → аналітична виручка</h2></div></div>
        <div className="management-table-wrap">
          <div className="management-table" style={{minWidth:900}}>
            <div className="table-row table-head" style={{gridTemplateColumns:"1.4fr .8fr .7fr .8fr .8fr 1fr"}}>
              <span>Канал</span><span>Сесії</span><span>Частка трафіку (UNKNOWN)</span><span>Purchase</span><span>Конверсія</span><span>Revenue GA4</span>
            </div>
            {data.channels.map(row=><div className="table-row" style={{gridTemplateColumns:"1.4fr .8fr .7fr .8fr .8fr 1fr"}} key={row.channel}>
              <b>{row.channel}</b><span>{n(row.sessions)}</span><span>{pct(null)}</span><span>{n(row.purchases)}</span><span>{pct(row.conversionRate)}</span><span>{money(row.purchaseRevenue)}</span>
            </div>)}
          </div>
        </div>
        <small className="table-note">Revenue тут — purchase revenue у GA4. Фінансову виручку звіряємо з основним warehouse BI.</small>
      </section>
    </section>
  </main>;
}
