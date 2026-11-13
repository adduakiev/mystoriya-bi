import type { analyzeGlovo } from "@/lib/data/glovo-analytics";
import styles from "./report.module.css";
const number = new Intl.NumberFormat("uk-UA", {maximumFractionDigits: 2});
export const glovoValue = (v: number | null | undefined) => v === null || v === undefined ? "— · недоступно" : number.format(v);
type Analytics = ReturnType<typeof analyzeGlovo>;
export function GlovoManagementPanels({analytics, drilldown}: {analytics: Analytics; drilldown: (params: Record<string, string>) => string}) {
  const {comparison, latest} = analytics;
  return <>
    <section className="panel" aria-labelledby="glovo-comparison-heading">
      <h2 id="glovo-comparison-heading">Порівняння · {comparison.mode === "cohort" ? "Співставна когорта" : "Портфель"}</h2>
      <p>Попередній рівний період: {comparison.previousMonths.join(", ") || "—"}. Сума: {glovoValue(comparison.current)} / {glovoValue(comparison.previous)} UAH.
        Зміна: {glovoValue(comparison.absolute)} UAH · {glovoValue(comparison.percent)}%.</p>
      <p>Спільних ідентичностей: {comparison.common}; поточний портфель: {comparison.currentCohorts}; попередній: {comparison.priorCohorts}.
        Когорта = нормалізований бренд × фізична локація (за відсутності — заклад джерела).
        Зміна доступна лише за COMPLETE обох повних періодів.</p>
    </section>
    {([ ["locations", "Фізичні локації"], ["brands", "Нормалізовані бренди"] ] as const).map(([kind, title]) =>
      <section className="panel" key={kind} aria-labelledby={`glovo-${kind}-heading`}>
        <h2 id={`glovo-${kind}-heading`}>{title} · рейтинг</h2>
        <p>MoM і внесок до зміни суми покупок: {latest?.month ?? "— · немає COMPLETE місяця"}.
          UNKNOWN показано за окремими назвами джерела; це не підтверджені фізичні заклади.
          Для появи/зникнення бренду без рядка у сусідньому місяці MoM і внесок недоступні; внески можуть не складати 100%.</p>
        <div className={styles.scroll} role="region" aria-label={title} tabIndex={0}>
          <table><caption>{title} · сума за вибраний період, UAH</caption>
            <thead><tr>{["Назва", "Сума, UAH", "Замовлення", "Зважений чек, UAH", "Частка суми, %", "MoM, UAH", "MoM, %", "Внесок у MoM, %"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
            <tbody>{analytics[kind].map(row => <tr key={row.label}><th scope="row">
              {row.label.startsWith("UNKNOWN · ") ? row.label : <a href={drilldown({[kind === "brands" ? "group" : "physical"]: row.label})}>{row.label}</a>}
            </th><td>{glovoValue(row.purchaseSum)}</td><td>{glovoValue(row.deliveredOrders)}</td><td>{glovoValue(row.ticket)}</td>
              <td>{glovoValue(row.share)}</td><td>{glovoValue(row.absolute)}</td><td>{glovoValue(row.percent)}</td><td>{glovoValue(row.contribution)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>)}
    <section className="panel" aria-labelledby="glovo-matrix-heading">
      <h2 id="glovo-matrix-heading">Бренд × локація · місячна матриця</h2>
      <div className={styles.scroll} role="region" aria-label="Місячна матриця брендів і локацій" tabIndex={0}>
        <table><caption>Нормалізований бренд × фізична локація або заклад джерела × місяць</caption>
          <thead><tr>{["Місяць", "Бренд", "Локація", "Сирі бренди / заклади", "Сума, UAH", "Замовлення", "Зважений чек, UAH"].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
          <tbody>{analytics.matrix.map(row => <tr key={row.key}><th scope="row">{row.month}</th><td>{row.brand}</td><td>{row.location}</td>
            <td>{row.pairs.map(([brand, location]) => <a key={JSON.stringify([brand, location])} href={drilldown({brand, location, month: row.month})}>{brand} · {location}<br /></a>)}</td>
            <td>{glovoValue(row.purchaseSum)}</td><td>{glovoValue(row.deliveredOrders)}</td><td>{glovoValue(row.ticket)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
