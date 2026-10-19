import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalAppData } from "@/lib/data/digital-sources";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function money(v:number){return "₴ "+Math.round(v).toLocaleString("uk-UA");}
function pct(v:number){return (v*100).toFixed(2)+"%";}
function ratio(a:number,b:number){return b>0?a/b:0;}
function dateLabel(v?:string){return v?new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(v+"T00:00:00Z")):"—";}

export default async function Page(){
  const data=await loadDigitalAppData();
  const o=data.overview,e=data.economics;
  const android=data.googleAdsApp.find(x=>x.platform==="android");
  const ios=data.googleAdsApp.find(x=>x.platform==="ios");
  const storeReady=data.sources.store.rows>0;
  const firebaseReady=data.sources.firebase.rows>0;
  const usersReady=data.sources.users.rows>0;
  const ordersReady=data.sources.orders.rows>0;
  const acquisitionReady=data.sources.acquisition.rows>0;
  const cpi=ratio(e.spend,e.installs), cpr=ratio(e.spend,e.registrations), cac=ratio(e.spend,e.firstBuyers), roas=ratio(e.revenue,e.spend);
  const regToBuyer=ratio(o.buyers,o.registeredUsers), repeatRate=ratio(o.repeatBuyers,o.buyers);
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
      <div className="lfl-banner">App Analytics уже побудований як окремий бізнес-канал. Нулі не підставляємо: якщо джерело ще не передає дані, показуємо «—». Перший живий шар зараз — Google Ads App campaigns.</div>

      <div className="pnl-section-heading"><div><span className="eyebrow">ЩО ВЖЕ БАЧИМО</span><h2>Google Ads · App acquisition</h2></div><small>Conversions поки не вважаємо installs або buyers</small></div>
      <section className="digital-kpi-grid">
        <article className="digital-kpi-card"><span>Android Spend</span><strong>{android?money(android.spend):"—"}</strong><small>{android?n(android.clicks):"—"} кліків · {android?n(android.impressions):"—"} показів</small><em>{android?dateLabel(android.fromDate)+" — "+dateLabel(android.toDate):"немає даних"}</em></article>
        <article className="digital-kpi-card"><span>Android Ads conversions</span><strong>{android?n(android.conversions):"—"}</strong><small>тип conversion action ще підтверджуємо</small><em>{android?money(android.costPerConversion)+" / conversion":"—"}</em></article>
        <article className="digital-kpi-card"><span>iOS Spend</span><strong>{ios?money(ios.spend):"—"}</strong><small>{ios?n(ios.clicks):"—"} кліків</small><em>App_IOS</em></article>
        <article className="digital-kpi-card"><span>Conversion Value</span><strong>{android?money(android.conversionValue):"—"}</strong><small>App_Android</small><em>value tracking треба перевірити</em></article>
      </section>
      <div className="lfl-banner">Критична перевірка: Google Ads conversions не можна називати installs або клієнтами, доки агенція не підтвердить conversion action. Тому CAC з цієї цифри поки не рахуємо.</div>

      <div className="pnl-section-heading"><div><span className="eyebrow">APP FUNNEL</span><h2>Store → Install → Registration → Buyer → Repeat</h2></div><small>автоматично оживе після надходження джерел</small></div>
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
        <article className="digital-kpi-card"><span>ROAS App</span><strong>{acquisitionReady?roas.toFixed(2)+"x":"—"}</strong><small>attributed revenue / spend</small><em>до звірки з order DB</em></article>
        <article className="digital-kpi-card"><span>LTV 30 / 60 / 90</span><strong>—</strong><small>user_id_hash + orders</small><em>по contribution margin</em></article>
        <article className="digital-kpi-card"><span>LTV / CAC</span><strong>—</strong><small>економіка клієнта</small><em>+ payback period</em></article>
      </section>

      <section className="content-grid">
        <article className="panel"><div className="panel-head"><div><span className="eyebrow">DATA SOURCES</span><h2>Готовність джерел</h2></div></div><div className="digital-metric-list">
          {sources.map(([name,source,hint])=><div key={name}><b>{name}</b><span>{source.rows>0?"LIVE · "+n(source.rows)+" rows"+(source.latest?" · "+dateLabel(source.latest.slice(0,10)):""):"очікує · "+hint}</span></div>)}
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