import { DashboardSidebar } from "@/components/DashboardSidebar";
import { OperatingTasks } from "@/components/OperatingTasks";
import { loadOperatingData } from "@/lib/operating-data";
import { kpiStatus, isBusinessEvidence } from "@/lib/operating-core";
import styles from "./operating.module.css";
export const dynamic = "force-dynamic";
export const metadata = {title:"Оперативне керування"};
const units: Record<string,string> = {sessions:"сесій",events:"подій",clicks:"кліків",rows:"рядків", "currency-unconfirmed":"(валюта не підтверджена)"};
const number = (value: number | null, unit = "") => value === null ? "Невідомо" : `${new Intl.NumberFormat("uk-UA",{maximumFractionDigits:2}).format(value)} ${units[unit] ?? unit}`.trim();
export default async function OperatingPage() {
  const data = await loadOperatingData();
  const {packet,quality,council,astra,runId,runMode,runStatus,runAsOf,runIssues} = data;
  const {analysis}=data;
  const canCreate = analysis.canCreate;
  const businessEvidence = packet.evidence.filter(isBusinessEvidence);
  const sourceEvidence = packet.evidence.filter(e => !isBusinessEvidence(e));
  return <div className={styles.shell}>
    <DashboardSidebar activeHref="/operating" lfl={false} statusTitle="Оперативне керування" statusDetail="Стан джерел і запусків — у звіті"/>
    <main className={styles.main}>
      <header><p className={styles.eyebrow}>М’ЯСТОРІЯ · Executive cockpit</p><h1>Оперативне керування</h1>
        <p>Дані → пояснення → рішення → контроль результату.</p>
        <section aria-label="Стан аналізу">
          <h2>Стан аналізу</h2>
          <p>Останній успішний run: {analysis.lastSuccessful?.finished_at ?? "не підтверджений"} · {analysis.lastSuccessful?.mode.toUpperCase() ?? "НЕ ЗАПУСКАВСЯ"}</p>
          <p>Якість джерел: PASS {analysis.counts.PASS} / WARN {analysis.counts.WARN} / BLOCK {analysis.counts.BLOCK}</p>
          <p>{canCreate ? "Створення задач доступне." : "Створення задач недоступне."}</p>
          <button type="button" disabled aria-describedby="manual-reasons">Запустити новий аналіз</button>
          <p id="manual-reasons" className={styles.meta}>{analysis.manual.reasons.join(' ')}</p>
        </section>
        {runIssues.length > 0 && <ul className={styles.warning} role="status">{runIssues.map(reason => <li key={reason}>{reason}</li>)}</ul>}
        <nav className={styles.anchorNav} aria-label="Розділи оперативного керування">{[["kpi","KPI"],["sources","Data Quality / Sources"],["direction","Куди йдемо"],["changes","Що змінилось"],["why","Чому"],["decisions","Рішення"],["tasks","Задачі"]].map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
      </header>
      <section id="kpi"><h2>KPI</h2><p>Платформні конверсії та GA4 не є підтвердженими замовленнями або фінансовим результатом.</p>
        {!businessEvidence.length && <p className={styles.warning}>Підтверджений пакет KPI відсутній.</p>}
        <div className={styles.grid}>{businessEvidence.map(e => {
          const q = quality.find(q => q.evidence_id === e.id) ?? {evidence_id:e.id,status:"BLOCK" as const,confidence:0,reasons:["Перевірка якості відсутня"]};
          return <article className={styles.card} key={e.id}><span className={styles.badge}>Business: {kpiStatus(e,q)}</span><h3>{e.label}</h3><div className={styles.value}>{number(e.value,e.unit)}</div>
            <dl><dt>Попереднє значення</dt><dd>{number(e.previous,e.unit)}</dd><dt>Ціль</dt><dd>{number(e.target,e.unit)}</dd><dt>Джерело</dt><dd>{e.source}</dd><dt>Дата джерела</dt><dd>{e.source_date ?? "невідома"}</dd><dt>Період</dt><dd>{e.period_from ?? "?"} — {e.period_to ?? "?"}</dd><dt>Покриття</dt><dd>{e.coverage}</dd><dt>Data Quality</dt><dd>{q.status}</dd><dt>Confidence</dt><dd>{Math.round(q.confidence*100)}%</dd></dl>
            <details><summary>Якість та походження</summary><p>{e.id} · {e.source_status} · {q.status}</p><p>Спостереження: {e.observed_at ?? "невідомо"}; отримано: {e.fetched_at}</p><p>Атрибуція: {e.attribution}</p>{q.reasons.length ? <ul>{q.reasons.map(r => <li key={r}>{r}</li>)}</ul> : <p>Перевірки контракту пройдено.</p>}</details>
          </article>;
        })}</div>
      </section>
      <section id="sources"><h2>Data Quality / Sources</h2><p>Технічні лічильники покриття не є бізнес-KPI.</p>
        <details><summary>Деталі запуску та свіжості</summary>
          <p>Поточний collector time: {packet.as_of}; це не source freshness.</p>
          <p>Run: {runId ?? "немає"} · Mode: {runMode?.toUpperCase() ?? "невідомо"} · Lifecycle: {runStatus?.toUpperCase() ?? "невідомо"}</p>
          <p>Source as-of пакета запуску: {runAsOf ?? "невідомо"}; collector завершено: {analysis.collectorAt ?? "невідомо"}; Council time: {analysis.councilAt ?? "невідомо"}.</p>
          <ul>{packet.evidence.map(e=><li key={e.id}>{e.source}: source date {e.source_date ?? "невідома"}; SLA {e.freshness_sla_days} днів</li>)}</ul>
          <p>Причини недоступності задач:</p><ul>{analysis.taskReasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
        </details>
        <div className={styles.grid}>{sourceEvidence.map(e => {
          const q = quality.find(item => item.evidence_id === e.id);
          return <article key={e.id} className={styles.card}><h3>{e.label}</h3><p>{number(e.value,e.unit)}</p>
            <dl><dt>Data Quality</dt><dd>{q?.status ?? "BLOCK"}</dd><dt>Confidence</dt><dd>{Math.round((q?.confidence ?? 0)*100)}%</dd><dt>Джерело</dt><dd>{e.source}</dd><dt>Дата джерела</dt><dd>{e.source_date ?? "невідома"}</dd><dt>Покриття</dt><dd>{e.coverage}</dd></dl>
            <p className={styles.meta}>{e.id}</p><ul>{q?.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
          </article>;
        })}</div>
      </section>
      <section id="direction"><h2>Куди йдемо</h2>{businessEvidence.every(e=>e.target===null&&e.forecast===null)
        ? <p className={styles.warning}>Цілі не надані, обґрунтований прогноз відсутній. Напрям зміни нижче описує минулий період і не є прогнозом.</p>
        : <div className={styles.grid}>{businessEvidence.filter(e=>e.target!==null||e.forecast!==null).map(e=><article className={styles.card} key={e.id}><h3>{e.label}</h3><p>Ціль: {number(e.target,e.unit)}</p><p>Прогноз: {number(e.forecast,e.unit)}</p></article>)}</div>}</section>
      <section id="changes"><h2>Що змінилось</h2><ul>{businessEvidence.map(e => <li key={e.id}><strong>{e.label}:</strong> {e.value === null || e.previous === null ? "немає зіставних значень для порівняння" : `зміна ${number(e.value-e.previous,e.unit)} проти попереднього значення`}</li>)}</ul><p className={styles.meta}>Зміна показника сама по собі не доводить причину.</p></section>
      <section id="why"><h2>Чому</h2>{!council ? <p>Перевірений Council ще не доступний. Пояснення причин не сформоване.</p> : <>
        <p>Council відокремлює факти, припущення, рекомендації та блокування якості.</p>
        <details><summary>Розглянути висновки Council ({council.items.length})</summary>{council.items.map(item => <article key={item.id} className={styles.card}><span className={styles.badge}>{item.classification} · {Math.round(item.confidence*100)}%</span><h3>{item.problem}</h3><p>{item.recommendation}</p><p className={styles.meta}>Докази: {item.evidence.join(", ") || "відсутні"}</p><ul>{item.reasons.map(r => <li key={r}>{r}</li>)}</ul></article>)}</details>
        <p>Суперечності: {council.contradictions.length ? council.contradictions.join(", ") : "не позначені алгоритмом; це не гарантує їх відсутності"}.</p>
        {council.related.map((r,i) => <p key={i}>{r.ids.join(" ↔ ")}: {r.reason}</p>)}<p className={styles.meta}>Спільний доказ є підставою для перевірки зв’язку, а не доказом спільної причини.</p>
      </>}</section>
      <section id="decisions"><h2>Рішення Astra</h2>{!astra ? <p>Executive-висновок ще не сформований. Автоматичні бізнес-дії не виконуються.</p> : <><p>Стан: {astra.status}</p>{!astra.decisions.length && <p>{astra.summary}</p>}<div className={styles.grid}>{astra.decisions.slice(0,5).map(d => <article key={d.id} className={styles.card}><span className={styles.badge}>{d.priority} · {d.classification}</span><h3>{d.problem}</h3><p>{d.recommendation}</p><p>Вплив: {d.expected_impact ?? "не визначено"} · Confidence: {Math.round(d.confidence*100)}%</p><p className={styles.meta}>Докази: {d.evidence.join(", ") || "відсутні"}</p></article>)}</div></>}</section>
      <section id="tasks"><h2>Задачі</h2><OperatingTasks recommendations={council?.recommendations ?? []} runId={runId} canCreate={canCreate}/></section>
    </main>
  </div>;
}
