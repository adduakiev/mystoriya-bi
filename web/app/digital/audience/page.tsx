import { ga4Money as money, GA4_MONEY_NOTICE } from "@/lib/ga4-presentation";
import { formatMetric, metricRatio, dimensionWindowEvidence } from "@/lib/digital-quality";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData, loadDigitalHistory } from "@/lib/data/digital";

function n(v:number|null|undefined){return formatMetric(v);}
function pct(v:number|null){return v===null?"—":`${(v*100).toFixed(2)}%`;}
function dec(v:number|null){return formatMetric(v,2);}

export default async function Page(){
  const [data,history]=await Promise.all([loadDigitalData(),loadDigitalHistory()]);
  const c=data.current;
  const sessionsPerUser=metricRatio(c.sessions,c.activeUsers);
  const purchasesPerUser=metricRatio(c.purchases,c.activeUsers);
  const deviceEvidence=dimensionWindowEvidence(data.meta.from,data.meta.to,history.quality.devices.from,history.quality.devices.to);
  const deviceBound=deviceEvidence.maximumPossibleDays===null?"UNKNOWN":`не більше ${deviceEvidence.maximumPossibleDays} із ${deviceEvidence.selectedDays} днів`;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Аудиторія" statusDetail="GA4 · web audience"/>
    <section className="workspace">
      <header className="topbar">
        <div><span className="eyebrow">DIGITAL · AUDIENCE</span><h1>Аудиторія сайту</h1></div>
        <div className="digital-source-badge">GA4 · Web</div>
      </header>
      <DigitalTabs active="audience"/>
      <div className="lfl-banner">{GA4_MONEY_NOTICE}</div>
      <div className="lfl-banner">GA4: {data.meta.from} — {data.meta.to}; дані до {data.meta.ga4Latest || "невідомо"}. Дата зрізу пристроїв: {history.quality.devices.to ?? "невідомо"}. За датами джерела доступно {deviceBound}; фактична кількість днів UNKNOWN, статус {deviceEvidence.status}. Показники пристроїв - лише наявний зріз, не повний період GA4. Унікальні користувачі за період недоступні: сума денних active_users не є унікальною аудиторією.</div>

      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Active users</span><strong>{n(c.activeUsers)}</strong><small>унікальні за період · недоступно</small><em>web</em></article>
        <article className="digital-kpi-card"><span>Сесії</span><strong>{n(c.sessions)}</strong><small>усі візити</small><em>{dec(sessionsPerUser)} сесії / active user</em></article>
        <article className="digital-kpi-card"><span>Engagement rate</span><strong>{pct(c.engagementRate)}</strong><small>{n(c.engagedSessions)} engaged sessions</small><em>GA4</em></article>
        <article className="digital-kpi-card"><span>Purchase / active user</span><strong>{pct(purchasesPerUser)}</strong><small>{n(c.purchases)} purchase events</small><em>діагностична метрика</em></article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">DEVICES</span><h2>Поведінка за пристроями</h2></div>
        </div>
        <div className="management-table-wrap">
          <div className="management-table" style={{minWidth:850}}>
            <div className="table-row table-head" style={{gridTemplateColumns:"1.2fr .9fr .8fr .8fr 1fr"}}>
              <span>Пристрій</span><span>Сесії</span><span>Purchase</span><span>Конверсія</span><span>Revenue GA4</span>
            </div>
            {data.devices.map(row=><div className="table-row" style={{gridTemplateColumns:"1.2fr .9fr .8fr .8fr 1fr"}} key={row.device}>
              <b>{row.device}</b><span>{n(row.sessions)}</span><span>{n(row.purchases)}</span><span>{pct(row.conversionRate)}</span><span>{money(row.purchaseRevenue)}</span>
            </div>)}
          </div>
        </div>
      </section>

      <section className="digital-plan-grid" style={{marginTop:12}}>
        <article className="panel">
          <span className="eyebrow">ЩО ВЖЕ МОЖЕМО ВИРІШУВАТИ</span>
          <div className="digital-decision-list">
            <div><span>1</span><b>На яких пристроях найслабша purchase/session конверсія за наявним зрізом (не повний період).</b></div>
            <div><span>2</span><b>Чи достатньо залучені користувачі після входу на сайт.</b></div>
            <div><span>3</span><b>Де UX-проблема може впливати на продажі.</b></div>
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">НАСТУПНИЙ ШАР</span>
          <div className="digital-decision-list">
            <div><span>1</span><b>New vs Returning — окремий GA4 зріз.</b></div>
            <div><span>2</span><b>Географія та локальні сегменти.</b></div>
            <div><span>3</span><b>CRM retention / repeat purchase / LTV після зв’язки з order_id.</b></div>
          </div>
        </article>
      </section>
    </section>
  </main>;
}
