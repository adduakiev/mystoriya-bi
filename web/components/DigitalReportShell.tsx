import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DIGITAL_REPORTS, type DigitalReport } from "@/lib/digital-reports";

export function DigitalTabs({active}:{active:string}) {
  return (
    <div className="digital-tabs">
      <Link href="/digital" className={active==="overview"?"active":""}>Огляд</Link>
      {DIGITAL_REPORTS.map(report=>(
        <Link
          key={report.slug}
          href={`/digital/${report.slug}`}
          className={active===report.slug?"active":""}
        >
          {report.label}
        </Link>
      ))}
    </div>
  );
}

export function DigitalEmptyState({source}:{source:string}) {
  return (
    <div className="digital-empty">
      <PlugZap size={18}/>
      <div>
        <b>Очікує підключення даних</b>
        <span>{source}</span>
      </div>
    </div>
  );
}

export function DigitalReportShell({report}:{report:DigitalReport}) {
  return (
    <main className="shell">
      <DashboardSidebar
        activeHref="/digital"
        lfl={false}
        statusTitle="Digital · структура готова"
        statusDetail="Джерела даних ще не підключені"
      />
      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">DIGITAL · {report.label.toUpperCase()}</span>
            <h1>{report.title}</h1>
          </div>
          <div className="digital-source-badge">{report.source}</div>
        </header>

        <DigitalTabs active={report.slug}/>

        <section className="panel digital-report-intro">
          <div>
            <span className="eyebrow">НАВІЩО ЦЕЙ ЗВІТ</span>
            <h2>{report.description}</h2>
          </div>
          <DigitalEmptyState source={report.source}/>
        </section>

        <section className="digital-plan-grid">
          <article className="panel">
            <span className="eyebrow">ГОЛОВНІ ПОКАЗНИКИ</span>
            <div className="digital-metric-list">
              {report.metrics.map(metric=>(
                <div key={metric}>
                  <b>{metric}</b>
                  <span>—</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel">
            <span className="eyebrow">ЯКІ РІШЕННЯ ДАЄ</span>
            <div className="digital-decision-list">
              {report.decisions.map((decision,index)=>(
                <div key={decision}>
                  <span>{index+1}</span>
                  <b>{decision}</b>
                </div>
              ))}
            </div>
          </article>
        </section>

        <Link href="/digital" className="digital-back-link">
          Повернутися до Digital-огляду <ArrowRight size={14}/>
        </Link>
      </section>
    </main>
  );
}
