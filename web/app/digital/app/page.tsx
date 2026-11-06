import { formatMetric, metricRatio } from "@/lib/digital-quality";
import { sourceMoney, presenceStatus } from "@/lib/source-evidence";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalAppData } from "@/lib/data/digital-sources";

function n(v:number|null){return formatMetric(v);}
const money=sourceMoney;
function pct(v:number|null){return v===null?"—":(v*100).toFixed(2)+"%";}

function dateLabel(v?:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}

export default async function Page(){
  const data=await loadDigitalAppData();
  const o=data.overview,e=data.economics;
  const storeReady=(data.sources.store.rows??0)>0;
  const firebaseReady=(data.sources.firebase.rows??0)>0;
  const usersReady=(data.sources.users.rows??0)>0;
  const ordersReady=(data.sources.orders.rows??0)>0;
  const acquisitionReady=(data.sources.acquisition.rows??0)>0;
  const cpi=metricRatio(e.spend,e.installs), cpr=metricRatio(e.spend,e.registrations), cac=metricRatio(e.spend,e.firstBuyers), roas=metricRatio(e.revenue,e.spend);
  const regToBuyer=metricRatio(o.buyers,o.registeredUsers), repeatRate=metricRatio(o.repeatBuyers,o.buyers);
  const sources=[
    ["App Store / Google Play",data.sources.store,"downloads / installs / store conversion"],
    ["Firebase Analytics",data.sources.firebase,"first_open / sign_up / cart / checkout / purchase"],
    ["Crashlytics / Quality",data.sources.quality,"crashes / ANR / errors / app version"],
    ["Attribution / MMP",data.sources.acquisition,"source / campaign / spend / installs / buyers"],
    ["App users",data.sources.users,"registration → first order → repeat"],
    ["Order backend",data.sources.orders,"order_id / revenue / contribution margin"]
  ] as const;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · App Analytics" statusDetail="контракт готовий · джерела підключаються"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · MOBILE APP</span><h1>App Analytics</h1></div><div className="digital-source-badge">iOS + Android</div></header>
      <DigitalTabs active="app"/>
      <div className="lfl-banner">App Analytics уже побудований як окремий бізнес-канал. Нулі не підставляємо: якщо джерело ще не передає дані, показуємо «—». Google Ads App — окремий частковий зріз; повнота та звірка UNKNOWN.</div>

      <div className="pnl-section-heading"><div><span className="eyebrow">ЩО ВЖЕ БАЧИМО</span><h2>Google Ads · App acquisition</h2></div><small>Conversions поки не вважаємо installs або buyers</small></div>
      <section className="panel">
        <div className="lfl-banner">PARTIAL · валюта та акаунт джерела потребують підтвердження. Без однозначної валюти грошові KPI показують UNKNOWN; змішані валюти не об’єднуємо. Період Ads незалежний від App funnel.</div>
        <div className="management-table-wrap"><table style={{minWidth:980,width:"100%"}}>
          <thead><tr><th>Campaign / platform</th><th>Account / currency</th><th>Dates</th><th>Spend</th><th>Clicks / impressions</th><th>Conversions</th><th>CPA</th><th>Conversion value</th></tr></thead>
          <tbody>{data.googleAdsApp.map((row,index)=><tr key={`${row.accountId}:${row.campaignName}:${index}`}>
            <td>{row.campaignName} · {row.platform}</td><td>{row.accountId??"UNKNOWN"} · {row.currency??row.currencyStatus}</td>
            <td>{dateLabel(row.fromDate)} — {dateLabel(row.toDate)}</td><td>{money(row.spend,row)}</td>
            <td>{n(row.clicks)} / {n(row.impressions)}</td><td>{n(row.conversions)}</td>
            <td>{money(row.costPerConversion,row)}</td><td>{money(row.conversionValue,row)}</td>
          </tr>)}</tbody>
        </table></div>
        {data.googleAdsApp.length===0&&<p>UNKNOWN · немає підтверджених campaign rows</p>}
      </section>
      <div className="lfl-banner">Критична перевірка: Google Ads conversions не можна називати installs або клієнтами, доки агенція не підтвердить conversion action. Тому CAC з цієї цифри поки не рахуємо.</div>

      <div className="pnl-section-heading"><div><span className="eyebrow">APP FUNNEL</span><h2>Store → Install → Registration → Buyer → Repeat</h2></div><small>наявність рядків не доводить повноту</small></div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Downloads</span><strong>{storeReady?n(o.downloads):"—"}</strong><small>App Store + Google Play</small><em>first-time окремо</em></article>
        <article className="digital-kpi-card"><span>First opens</span><strong>{firebaseReady?n(o.firstOpens):"—"}</strong><small>реально відкрили app</small><em>Firebase</em></article>
        <article className="digital-kpi-card"><span>Registrations</span><strong>{usersReady?n(o.registeredUsers):"—"}</strong><small>{usersReady?n(o.registeredNoOrder)+" без замовлення":"—"}</small><em>registration cohort</em></article>
        <article className="digital-kpi-card"><span>First buyers</span><strong>{usersReady?n(o.buyers):"—"}</strong><small>користувачі з першим order</small><em>{usersReady?pct(regToBuyer):"—"}</em></article>
        <article className="digital-kpi-card"><span>Orders</span><strong>{ordersReady?n(o.orders):"—"}</strong><small>фактичні app orders</small><em>{ordersReady?money(o.orderRevenue):"—"} revenue</em></article>
        <article className="digital-kpi-card"><span>Repeat buyers</span><strong>{ordersReady?n(o.repeatBuyers):"—"}</strong><small>2+ app orders</small><em>{ordersReady?pct(repeatRate):"—"}</em></article>
      </section>

      <div className="pnl-section-heading"><div><span className="eyebrow">UNIT ECONOMICS</span><h2>Скільки коштує мобільний клієнт</h2></div><small>тільки після підтвердженої атрибуції</small></div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>CPI</span><strong>{acquisitionReady?money(cpi):"—"}</strong><small>spend / installs</small><em>acquisition</em></article>
        <article className="digital-kpi-card"><span>Cost / Registration</span><strong>{acquisitionReady?money(cpr):"—"}</strong><small>spend / registrations</small><em>acquisition</em></article>
        <article className="digital-kpi-card"><span>CAC</span><strong>{acquisitionReady?money(cac):"—"}</strong><small>spend / first buyers</small><em>головний acquisition KPI</em></article>
        <article className="digital-kpi-card"><span>ROAS App</span><strong>{acquisitionReady&&roas!==null?roas.toFixed(2)+"x":"—"}</strong><small>attributed revenue / spend</small><em>до звірки з order DB</em></article>
        <article className="digital-kpi-card"><span>LTV 30 / 60 / 90</span><strong>—</strong><small>user_id_hash + orders</small><em>по contribution margin</em></article>
        <article className="digital-kpi-card"><span>LTV / CAC</span><strong>—</strong><small>економіка клієнта</small><em>+ payback period</em></article>
      </section>

      <section className="content-grid">
        <article className="panel"><div className="panel-head"><div><span className="eyebrow">DATA SOURCES</span><h2>Готовність джерел</h2></div></div><div className="digital-metric-list">
          {sources.map(([name,source,hint])=><div key={name}><b>{name}</b><span>{(source.rows??0)>0?"PARTIAL · "+n(source.rows)+" rows · completeness UNKNOWN"+(source.latest?" · "+dateLabel(source.latest.slice(0,10)):""):presenceStatus(source.rows)+" · "+hint}</span></div>)}
        </div></article>
        <article className="panel"><span className="eyebrow">ЄДИНИЙ CUSTOMER KEY</span><div className="digital-decision-list">
          <div><span>1</span><b>user_id_hash зв’язує registration, app events та orders без PII.</b></div>
          <div><span>2</span><b>order_id звіряє Firebase purchase з фактичним backend order.</b></div>
          <div><span>3</span><b>source / campaign прив’язує клієнта до acquisition і CAC.</b></div>
          <div><span>4</span><b>contribution_margin дає справжній margin LTV, а не тільки revenue.</b></div>
        </div></article>
      </section>

      <section className="panel" style={{marginTop:12}}><div className="panel-head"><div><span className="eyebrow">TARGET MODEL</span><h2>Що буде управляти бізнесом</h2></div></div>
        <div className="management-table-wrap"><div className="management-table" style={{minWidth:980}}>
          <div className="table-row table-head" style={{gridTemplateColumns:"1.25fr 1.4fr 2fr"}}><span>Метрика</span><span>Джерело</span><span>Що вирішуємо</span></div>
          {[["Store conversion","App Store / Google Play","Чи продає сторінка застосунку install"],["Install → Registration","Store + Firebase","Скільки інсталів стають відомими клієнтами"],["Registration → First order","Users + Orders","Де втрачаємо потенційного покупця"],["CAC","Attribution + First buyer","Скільки реально коштує новий app-клієнт"],["Repeat rate","Orders","Чи повертається клієнт після першої покупки"],["LTV30/60/90/180","Orders + margin","Скільки цінності дає когорта"],["LTV/CAC + Payback","LTV + acquisition","Чи можна масштабувати канал"],["Crash-free / errors","Crashlytics","Чи продуктова якість вбиває conversion"]].map(row=><div className="table-row" style={{gridTemplateColumns:"1.25fr 1.4fr 2fr"}} key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span></div>)}
        </div></div>
      </section>
    </section>
  </main>;
}