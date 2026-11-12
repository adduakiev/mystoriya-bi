import Link from "next/link";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { loadGlovoSource } from "@/lib/data/glovo-source";
import { GlovoReportPresenter } from "./GlovoReportPresenter";
import styles from "./report.module.css";

export default async function GlovoBrandsPage() {
  const source = await loadGlovoSource();
  return (
    <main className="shell">
      <DashboardSidebar activeHref="/aggregators/glovo" lfl={false}
        statusTitle={source.status} statusDetail="Glovo · read-only preview · свіжість UNKNOWN" />
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
          <p>Останній місяць подій: UNKNOWN · Останнє читання: UNKNOWN · Автооновлення не активне.</p>
          {!source.report && <p>Запланований період: січень–жовтень 2026. Листопад поза типовим періодом;
            його часткові дані потребують окремої перевірки. Покриття в BI не підтверджене.</p>}
        </section>

        {source.report ? <GlovoReportPresenter report={source.report} /> : <>
        <section className={styles.kpis} aria-label="KPI · дані недоступні">
          {[
            ["Доставлені замовлення", "Місячний агрегат джерела"],
            ["Сума покупок, лок. вал.", "Ідентичність валюти не підтверджена"],
            ["Середній чек, лок. вал.", "Сума покупок / доставлені замовлення"],
            ["Зміна до попереднього періоду", "Лише за повного покриття обох періодів"]
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
                <th scope="col">Сума покупок, лок. вал.</th><th scope="col">Покриття</th></tr></thead>
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
                "Доставлені замовлення", "Сума покупок, лок. вал."].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
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
          <p>Сирі назви зберігаються. Погоджені варіанти Мʼясторія Meat Bar,
            Meatbar М&apos;ясторія та Мітбар М&apos;ясторія належать до групи «МітБар».
            Решта груп, фізичні локації, власність і реальний/віртуальний тип: UNKNOWN / needs mapping.</p>
          <p>Немає ID замовлень, статусів, комісій чи підтвердження валюти.
            Рядок Excel — походження запису, а не ID замовлення. Звірка всередині таблиці
            не доводить відповідність оригінальному експорту.</p>
        </section>
      </section>
    </main>
  );
}
