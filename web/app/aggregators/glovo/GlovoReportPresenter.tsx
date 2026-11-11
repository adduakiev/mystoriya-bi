import type { buildGlovoReport } from "@/lib/data/glovo-contract";
import styles from "./report.module.css";

// Accept only the existing pure builder's non-null result. No parsing,
// aggregation, transport, fallback data or refresh belongs in this presenter.
type Report = NonNullable<ReturnType<typeof buildGlovoReport>>;
const number = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });
const value = (metric: number | null) => metric === null ? "— · недоступно" : number.format(metric);

export function GlovoReportPresenter({ report }: { report: Report }) {
  return <>
    <section className="panel" aria-labelledby="glovo-coverage-heading">
      <h2 id="glovo-coverage-heading">Покриття: {report.coverage}</h2>
      <p role="status">{report.coverage === "PARTIAL"
        ? "PARTIAL · показано лише відомі значення; повнота періоду не підтверджена або є пропуски. Це не повний підсумок."
        : "COMPLETE · покриття вибраних місяців підтверджене постачальником; це не доказ звірки з оригінальним експортом."}</p>
      <p>Вибрані місяці: {report.months.join(", ")}. Відсутні значення не означають нуль.
        Валюта та свіжість джерела: UNKNOWN.</p>
      <p>Бренди у вибраному періоді: {report.brands.join(", ") || "— · недоступно"}.</p>
    </section>

    <section className={styles.kpis} aria-label={`KPI · ${report.coverage}`}>
      {[
        { label: "Доставлені замовлення", metric: report.metrics.deliveredOrders, detail: "Місячний агрегат джерела" },
        { label: "Сума покупок, лок. вал.", metric: report.metrics.purchaseSum, detail: "Ідентичність валюти не підтверджена" },
        { label: "Середній чек, лок. вал.", metric: report.metrics.averageTicket, detail: "Сума покупок / доставлені замовлення; лише за додатної кількості" }
      ].map(({ label, metric, detail }) => <article className="panel" key={label}>
        <h2>{label}</h2><strong className={styles.value}>{value(metric)}</strong>
        <p>{detail}. {report.coverage}{metric === null ? " · недоступно" : ""}.</p>
      </article>)}
      <article className="panel">
        <h2>Зміна до попереднього періоду</h2><strong className={styles.value}>— · недоступно</strong>
        <p>Немає перевіреного попереднього періоду.</p>
      </article>
    </section>

    <section className="panel" aria-labelledby="glovo-trend-heading">
      <h2 id="glovo-trend-heading">Динаміка за місяцями</h2>
      <p>Order Created Local Month · локальний місяць створення замовлення з джерела.
        PARTIAL — відомі значення, а не повний підсумок місяця.</p>
      <div className={styles.scroll} role="region" aria-label="Таблиця місячної динаміки" tabIndex={0}>
        <table>
          <caption>Місячна динаміка · {report.coverage}</caption>
          <thead><tr>{["Місяць", "Доставлені замовлення", "Сума покупок, лок. вал.", "Середній чек, лок. вал.", "Покриття"]
            .map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.trend.map(point => <tr key={point.month}>
            <th scope="row">{point.month}</th><td>{value(point.deliveredOrders)}</td>
            <td>{value(point.purchaseSum)}</td><td>{value(point.averageTicket)}</td><td>{point.coverage}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="panel" aria-labelledby="glovo-drilldown-heading">
      <h2 id="glovo-drilldown-heading">Бренд × заклад · деталізація</h2>
      <p>Сирий бренд і назви збережені. Заклад у таблиці не підтверджує фізичну локацію.
        Рядок Excel — походження агрегату, а не ID замовлення.</p>
      <div className={styles.scroll} role="region" aria-label="Деталізація брендів та закладів" tabIndex={0}>
        <table>
          <caption>Бренд × заклад × місяць · рядки джерела; покриття періоду {report.coverage}</caption>
          <thead><tr>{["Місяць", "Бренд у джерелі", "Погоджена група", "Заклад у таблиці",
            "Назва у джерелі", "Адреса у джерелі", "Фізична локація", "Власність", "Реальний / віртуальний тип",
            "Доставлені замовлення", "Сума покупок, лок. вал.", "Рядок Excel", "Мапінг"]
            .map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.rows.length ? report.rows.map(row => <tr key={row.key}>
            <th scope="row">{row.month}</th><td>{row.rawBrand}</td><td>{row.normalizedGroup ?? "UNKNOWN / needs mapping"}</td>
            <td>{row.sourceLocation}</td><td>{row.sourceName}</td><td>{row.sourceAddress}</td>
            <td>{row.physicalLocation ?? "UNKNOWN / needs mapping"}</td><td>{row.ownership}</td><td>{row.identity}</td>
            <td>{value(row.deliveredOrders)}</td><td>{value(row.purchaseSum)}</td><td>{row.sourceRow}</td><td>{row.mappingReason}</td>
          </tr>) : <tr><td colSpan={13}>— · недоступно · немає рядків у вибраному періоді</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
