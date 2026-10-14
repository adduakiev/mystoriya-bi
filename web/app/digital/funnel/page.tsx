import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalData } from "@/lib/data/digital";

function n(v:number){return Math.round(v).toLocaleString("uk-UA");}
function pct(v:number){return `${(v*100).toFixed(2)}%`;}

export default async function Page(){
  const data=await loadDigitalData();
  const c=data.current;
  const steps=[
    {name:"Сесії",value:c.sessions,rate:1,detail:"усі візити на сайт"},
    {name:"Додавання в кошик",value:c.addToCarts,rate:c.sessions?c.addToCarts/c.sessions:0,detail:"подія add_to_cart"},
    {name:"Початок оформлення",value:c.checkouts,rate:c.sessions?c.checkouts/c.sessions:0,detail:"подія begin_checkout"},
    {name:"Покупка GA4",value:c.purchases,rate:c.sessions?c.purchases/c.sessions:0,detail:"подія purchase"}
  ];

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Воронка" statusDetail="GA4 · live"/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · ВОРОНКА</span><h1>Воронка сайту</h1></div><div className="digital-source-badge">GA4 · 30 днів</div></header>
      <DigitalTabs active="funnel"/>
      <section className="panel">
        <div className="panel-head"><div><span className="eyebrow">CUSTOMER JOURNEY</span><h2>Де ми втрачаємо користувача</h2></div></div>
        <div className="digital-source-flow">
          {steps.map(step=><div key={step.name}><b>{n(step.value)}</b><span>{step.name} · {pct(step.rate)}</span><span>{step.detail}</span></div>)}
        </div>
      </section>
      <section className="digital-plan-grid">
        <article className="panel">
          <span className="eyebrow">ПЕРЕХОДИ МІЖ КРОКАМИ</span>
          <div className="digital-metric-list">
            <div><b>Сесія → кошик</b><span>{pct(c.sessions?c.addToCarts/c.sessions:0)}</span></div>
            <div><b>Кошик → checkout</b><span>{pct(c.addToCarts?c.checkouts/c.addToCarts:0)}</span></div>
            <div><b>Checkout → purchase</b><span>{pct(c.checkouts?c.purchases/c.checkouts:0)}</span></div>
            <div><b>Загальна конверсія</b><span>{pct(c.conversionRate)}</span></div>
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">ЩО ДИВИМОСЯ ДАЛІ</span>
          <div className="digital-decision-list">
            <div><span>1</span><b>Сегментувати воронку mobile / desktop.</b></div>
            <div><span>2</span><b>Розкласти checkout по помилках і способах оплати.</b></div>
            <div><span>3</span><b>Зв’язати purchase GA4 з реальними замовленнями warehouse.</b></div>
          </div>
        </article>
      </section>
      <small className="table-note">Важливо: add_to_cart / begin_checkout / purchase — кількість подій GA4, не унікальних людей.</small>
    </section>
  </main>;
}
