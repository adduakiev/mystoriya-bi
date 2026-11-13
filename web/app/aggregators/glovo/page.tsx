import Link from "next/link";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { GLOVO_SORTS, selectGlovoReport, type GlovoFilters } from "@/lib/data/glovo-contract";
import { loadGlovoSource } from "@/lib/data/glovo-source";
import { GlovoReportPresenter } from "./GlovoReportPresenter";
import styles from "./report.module.css";

export const dynamic = "force-dynamic";

export default async function GlovoBrandsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const {searchParams} = props ?? {};
  const source = await loadGlovoSource();
  const params = await searchParams ?? {};
  const input = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters: GlovoFilters = {month: input("month"), brand: input("brand"), group: input("group"),
    location: input("location"), mapping: input("mapping"), sort: input("sort"), year: input("year"), from: input("from"), to: input("to"),
    physical: input("physical"), identity: input("identity"), ownership: input("ownership"), compare: input("compare")};
  if (!GLOVO_SORTS.includes(filters.sort as typeof GLOVO_SORTS[number])) filters.sort = "source";
  const report = source.report ? selectGlovoReport(source.report, filters) : null;
  return (
    <main className="shell">
      <DashboardSidebar activeHref="/aggregators/glovo" lfl={false}
        statusTitle={source.status} statusDetail={`Glovo · приватне читання · останній місяць ${source.latestEventMonth ?? "UNKNOWN"}`} />
      <section className={`workspace ${styles.report}`}>
        <nav aria-label="Звіти агрегаторів" className={styles.navigation}>
          <Link href="/aggregators" prefetch={false}>← Агрегатори</Link>
          <Link href="/aggregators/glovo" aria-current="page" prefetch={false}>Glovo · Аналітика брендів</Link>
        </nav>
        <header className="topbar">
          <div>
            <span className="eyebrow">GLOVO · READ-ONLY PREVIEW</span>
            <h1>Glovo · Аналітика брендів</h1>
          </div>
        </header>
        <section className="panel" aria-labelledby="glovo-source-heading">
          <h2 id="glovo-source-heading">{source.status}</h2>
          <p role="status">{source.reason}</p>
          <p>Останній місяць подій: {source.latestEventMonth ?? "UNKNOWN"} · Останнє читання: {source.lastReadAt ?? "UNKNOWN"} · Автооновлення не активне.</p>
          {source.report && <p><a href="/aggregators/glovo">Оновити з приватного джерела</a> · Повторне читання при відкритті сторінки.
            Час читання не підтверджує свіжість оригінального експорту.</p>}
          {!source.report && <p>Запланований період: січень–жовтень 2026. Листопад поза типовим періодом;
            його часткові дані потребують окремої перевірки. Покриття в BI не підтверджене.</p>}
        </section>

        {source.confirmations?.some(item => item.status === "CHANGED") && <section className="panel" aria-label="Змінені історичні факти">
          <h2>Підтвердження повноти втрачено</h2>
          {source.confirmations.filter(item => item.status === "CHANGED").map(item => <p key={item.month} role="status">{item.month} · CHANGED · очікуваний SHA-256 <code>{item.expectedDigest}</code> · поточний <code>{item.digest}</code>. Місяць PARTIAL; потрібне повторне підтвердження власника.</p>)}
        </section>}
        {source.parity && <section className="panel" aria-labelledby="glovo-parity-heading">
          <h2 id="glovo-parity-heading">Контрольні значення · січень–жовтень 2026</h2>
          <p>Порівняння прочитаних даних із D294. MATCH не означає незалежний аудит або перевірку Preview.</p>
          <ul>{source.parity.assertions.map(item => <li key={item.metric}>{item.metric}: {item.status} · відхилення {item.delta === null ? "UNKNOWN" : item.delta.toFixed(6)} (прочитано {item.observed ?? "UNKNOWN"}; орієнтир {item.expected}).</li>)}</ul>
        </section>}
        {source.report && report ? <GlovoReportPresenter report={report} sourceReport={source.report} filters={filters} /> : <>
        <section className={styles.kpis} aria-label="KPI · дані недоступні">
          {[
            ["Сума покупок, UAH", "Валюта підтверджена власником 13.11.2026"],
            ["Доставлені замовлення", "Місячний агрегат джерела"],
            ["Зважений середній чек, UAH", "Сума / замовлення лише парних рядків"],
            ["Частка віртуальних брендів, %", "Частка суми за відомої класифікації"]
          ].map(([label, detail]) => (
            <article className="panel" key={label}>
              <h2>{label}</h2><strong className={styles.value}>—</strong>
              <p>{detail}. SOURCE UNAVAILABLE.</p>
            </article>
          ))}
        </section>

        <section className="panel" aria-labelledby="glovo-trend-heading">
          <h2 id="glovo-trend-heading">Динаміка за місяцями</h2>
          <p>Order Created Local Month · локальний місяць створення замовлення з джерела.
            Графік з’явиться після перевірки даних; пропуски не означають нуль.</p>
          <div className={styles.scroll} role="region" aria-label="Таблиця місячної динаміки" tabIndex={0}>
            <table>
              <caption>Структура звіту · без даних джерела</caption>
              <thead><tr><th scope="col">Місяць</th><th scope="col">Доставлені замовлення</th>
                <th scope="col">Сума покупок, UAH</th><th scope="col">Покриття</th></tr></thead>
              <tbody><tr><td colSpan={4}>SOURCE UNAVAILABLE · місячні значення відсутні</td></tr></tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="glovo-drilldown-heading">
          <h2 id="glovo-drilldown-heading">Бренд × заклад · деталізація</h2>
          <p>Після підключення джерела тут можна буде перевірити кожен сирий бренд,
            погоджену групу та фізичну локацію окремо.</p>
          <div className={styles.scroll} role="region" aria-label="Деталізація брендів та закладів" tabIndex={0}>
            <table>
              <caption>Структура деталізації · без даних джерела</caption>
              <thead><tr>{["Місяць", "Бренд у джерелі", "Погоджена група", "Заклад у таблиці",
                "Назва у джерелі", "Адреса у джерелі", "Фізична локація", "Власність / тип",
                "Доставлені замовлення", "Сума покупок, UAH"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody><tr><td colSpan={10}>SOURCE UNAVAILABLE · мапінг UNKNOWN / needs mapping</td></tr></tbody>
            </table>
          </div>
        </section>

        </>}
        <section className="panel" aria-labelledby="glovo-definition-heading">
          <h2 id="glovo-definition-heading">Визначення та обмеження</h2>
          <p>Джерело містить агрегати бренд × заклад × місяць. Сума покупок у локальній валюті
            не визначає чистий прибуток або суму після комісій. Середній чек доступний лише
            за відомих суми та додатної кількості доставлених замовлень.</p>
          <p>Сирі назви зберігаються. Погоджені варіанти Мʼясторія Meat Bar, Meatbar Івано-Франківська,
            Meatbar М&apos;ясторія та Мітбар М&apos;ясторія належать до групи «МітБар».
            Класифікація закладів, типу і власності — лише з погоджених рядків словників цієї таблиці. Непогоджені значення: UNKNOWN / needs mapping.</p>
          <p>UAH підтверджено власником 13.11.2026. Немає ID замовлень, статусів чи комісій: дублікати замовлень між локаціями та скасування перевірити неможливо.
            Рядок Excel — походження запису, а не ID замовлення. Звірка всередині таблиці
            не доводить відповідність оригінальному експорту. Glovo-аналіз брендів відокремлений від Aggregator P&amp;L (комісії, промо, результат); Bolt/Loko не включені. Місяць створення замовлення може відрізнятися від глобального облікового дня.</p>
        </section>
      </section>
    </main>
  );
}
