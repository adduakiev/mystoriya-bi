import { formatMetric, metricRatio } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData } from "@/lib/data/digital";

function n(v:number|null|undefined){return formatMetric(v);}
function pct(v:number|null){return v===null?"—":`${(v*100).toFixed(2)}%`;}

export default async function Page(){
  const data=await loadDigitalData();
  const c=data.current;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Funnel diagnostics" statusDetail="GA4 aggregate events"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · FUNNEL</span><h1>Діагностика воронки</h1></div><div className="digital-source-badge">GA4 · агреговані події</div></header>
      <DigitalTabs active="funnel"/>
      <div className="lfl-banner">GA4: {data.meta.from} — {data.meta.to}; дані до {data.meta.ga4Latest || "невідомо"}. Повнота UNKNOWN; невідомі значення та ділення на нуль показано як «—».</div>

      <div className="lfl-banner">
        Поточний набір не є точною послідовною user-funnel: «сесії» та ecommerce events мають різну одиницю вимірювання. Тому нижче — діагностичні сигнали, а не «відсоток людей, які відпали».
      </div>

      <section className="digital-source-flow" style={{marginBottom:12}}>
        <div><b>{n(c.sessions)}</b><span>Сесії</span><span>session_start</span></div>
        <div><b>{n(c.addToCarts)}</b><span>Add to cart</span><span>кількість подій</span></div>
        <div><b>{n(c.checkouts)}</b><span>Begin checkout</span><span>кількість подій</span></div>
        <div><b>{n(c.purchases)}</b><span>Purchase</span><span>кількість подій</span></div>
      </section>

      <section className="digital-plan-grid">
        <article className="panel">
          <span className="eyebrow">ДІАГНОСТИЧНІ СПІВВІДНОШЕННЯ</span>
          <div className="digital-metric-list">
            <div><b>Purchase / Sessions</b><span>{pct(c.conversionRate)}</span></div>
            <div><b>Checkout events / Add-to-cart events</b><span>{pct(metricRatio(c.checkouts,c.addToCarts))}</span></div>
            <div><b>Purchase events / Checkout events</b><span>{pct(metricRatio(c.purchases,c.checkouts))}</span></div>
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">ТОЧНА ВОРОНКА · НАСТУПНИЙ КРОК</span>
          <div className="digital-decision-list">
            <div><span>1</span><b>Одна одиниця вимірювання: користувач або сесія на всіх кроках.</b></div>
            <div><span>2</span><b>Послідовність: menu → item → cart → checkout → delivery/payment → confirmed order.</b></div>
            <div><span>3</span><b>Сегментація: mobile / desktop, channel, new / returning.</b></div>
          </div>
        </article>
      </section>
    </section>
  </main>;
}
