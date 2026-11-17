import Link from "next/link";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import type { IsoWeeklyReport } from "@/lib/iso-week-contract";

export function WeeklyReportStatus({report}:{report:IsoWeeklyReport}) {
  return <p className="context-line">ISO-тижні · понеділок–неділя · дані до {report.cutoff}.
    {report.partial ? " Неповний тиждень: усі роки порівнюються до однакового дня тижня." : " Повний календарний тиждень."}
    {" Пропуски означають відсутність спостережень, а не нуль."}</p>;
}

export function WeeklyReportUnavailable({href,lfl=false}:{href:string;lfl?:boolean}) {
  return <main className="shell"><DashboardSidebar activeHref={href} lfl={lfl} statusTitle="ISO-тижні" statusDetail="Дані періоду не підтверджені" /><section className="workspace"><section className="panel" role="status">
    <h1>Тижневий звіт поки недоступний</h1>
    <p>Сервер не підтвердив узгоджений ISO-рік, тиждень і період порівняння. Неперевірені показники приховано.</p>
    <Link className="clear-filter" href={href}>Повернутися до місячного звіту</Link>
  </section></section></main>;
}
