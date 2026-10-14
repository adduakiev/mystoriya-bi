import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Megaphone,
  MousePointerClick,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { DIGITAL_MAIN_KPIS, DIGITAL_REPORTS } from "@/lib/digital-reports";

const REPORT_ICONS = {
  funnel: MousePointerClick,
  channels: BarChart3,
  seo: Search,
  ads: Megaphone,
  site: Activity,
  audience: Users,
  tracking: ShieldCheck
};

export default function DigitalPage(){
  return (
    <main className="shell">
      <DashboardSidebar
        activeHref="/digital"
        lfl={false}
        statusTitle="Digital · структура готова"
        statusDetail="GA4 / Search Console / Ads · очікують підключення"
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">DIGITAL · BUSINESS PERFORMANCE</span>
            <h1>Digital-аналітика</h1>
          </div>
          <div className="digital-head-note">
            <span>Ціль</span>
            <b>Трафік → Замовлення → Виручка → Окупність</b>
          </div>
        </header>

        <DigitalTabs active="overview"/>

        <section className="digital-kpi-grid">
          {DIGITAL_MAIN_KPIS.map(kpi=>(
            <article className="digital-kpi-card" key={kpi.label}>
              <span>{kpi.label}</span>
              <strong>—</strong>
              <small>{kpi.hint}</small>
              <em>{kpi.source}</em>
            </article>
          ))}
        </section>

        <section className="panel digital-connection-panel">
          <div>
            <span className="eyebrow">ДЖЕРЕЛА ДАНИХ</span>
            <h2>Підключаємо дані поетапно, без змішування «аналітичної» та реальної виручки</h2>
          </div>
          <div className="digital-source-flow">
            <div><b>GA4</b><span>трафік · поведінка · воронка</span></div>
            <div><b>Search Console</b><span>SEO · запити · сторінки</span></div>
            <div><b>Google Ads</b><span>витрати · кампанії · CPA</span></div>
            <div><b>Замовлення М’ЯСТОРІЇ</b><span>замовлення · виручка · середній чек</span></div>
          </div>
        </section>

        <div className="pnl-section-heading">
          <div>
            <span className="eyebrow">ГРУПА ЗВІТІВ</span>
            <h2>Звіти, які допомагають керувати Digital-бізнесом</h2>
          </div>
          <small>Без дублювання кабінетів Google — тільки показники для рішень</small>
        </div>

        <section className="digital-report-grid">
          {DIGITAL_REPORTS.map(report=>{
            const Icon=REPORT_ICONS[report.slug as keyof typeof REPORT_ICONS] ?? Activity;
            return (
              <Link href={`/digital/${report.slug}`} className="digital-report-card" key={report.slug}>
                <div className="digital-report-icon"><Icon size={18}/></div>
                <div>
                  <span>{report.label}</span>
                  <b>{report.title}</b>
                  <p>{report.description}</p>
                </div>
                <ArrowRight size={15}/>
              </Link>
            );
          })}
        </section>

        <section className="panel digital-principles">
          <div>
            <span className="eyebrow">ПРАВИЛА ДАНИХ</span>
            <h2>Що вважаємо «правдою» у Digital BI</h2>
          </div>
          <div className="digital-principle-grid">
            <div><b>Виручка та замовлення</b><span>беремо з реальної системи замовлень, не з GA4.</span></div>
            <div><b>Трафік та поведінка</b><span>беремо з GA4.</span></div>
            <div><b>SEO</b><span>Search Console — кліки, покази, CTR та позиції.</span></div>
            <div><b>Рекламні витрати</b><span>Google Ads — фактичний spend; далі зв'язуємо з реальною виручкою.</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}
