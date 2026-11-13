import { glovoMetrics, type buildGlovoReport, type GlovoFilters } from "@/lib/data/glovo-contract";
import { analyzeGlovo } from "@/lib/data/glovo-analytics";
import { GlovoManagementPanels } from "./GlovoManagementPanels";
import styles from "./report.module.css";

// Accept only the existing pure builder's non-null result. No parsing,
// aggregation, transport, fallback data or refresh belongs in this presenter.
type Report = NonNullable<ReturnType<typeof buildGlovoReport>>;
const number = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });
const value = (metric: number | null) => metric === null ? "— · недоступно" : number.format(metric);

export function GlovoReportPresenter({ report, sourceReport = report, filters }: {
  report: Report; sourceReport?: Report; filters?: GlovoFilters
}) {
  const active = filters ?? {month: report.months.length === 1 ? report.months[0] : "", brand: "", group: "", location: "", mapping: "", sort: "source"};
  const analytics = analyzeGlovo(sourceReport, active);
  const locations = [...new Set(sourceReport.rows.map(row => row.sourceLocation))].sort();
  const groups = [...new Set(sourceReport.rows.flatMap(row => row.normalizedGroup ? [row.normalizedGroup] : []))].sort();
  const drilldown = (changes: Record<string, string>) => {
    const params = new URLSearchParams(Object.entries({...active, ...changes}).filter(([, v]) => !!v));
    return `/aggregators/glovo?${params.toString()}#glovo-drilldown-heading`;
  };
  return <>
    {filters && <section className="panel" aria-labelledby="glovo-filters-heading">
      <h2 id="glovo-filters-heading">Вибір даних</h2>
      <form action="/aggregators/glovo" method="get" className={styles.filters}>
        <label>Рік<select name="year" defaultValue={filters.year ?? ""}>
          <option value="">Типовий період</option>{[...new Set(sourceReport.months.map(m => m.slice(0, 4)))].map(y => <option key={y}>{y}</option>)}
        </select></label>
        <label>Від місяця<input type="month" name="from" defaultValue={filters.from ?? ""} /></label>
        <label>До місяця<input type="month" name="to" defaultValue={filters.to ?? ""} /></label>
        <label>Місяць<select name="month" defaultValue={filters.month}>
          <option value="">Січень–жовтень 2026</option><option value="all">Усі доступні місяці</option>
          {sourceReport.months.map(month => <option key={month} value={month}>{month}</option>)}
        </select></label>
        <label>Бренд у джерелі<select name="brand" defaultValue={filters.brand}>
          <option value="">Усі бренди</option>
          {sourceReport.brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
        </select></label>
        <label>Погоджена група<select name="group" defaultValue={filters.group}>
          <option value="">Усі групи</option><option value="unknown">UNKNOWN / needs mapping</option>
          {groups.map(group => <option key={group} value={group}>{group}</option>)}
        </select></label>
        <label>Заклад у таблиці<select name="location" defaultValue={filters.location}>
          <option value="">Усі заклади</option>
          {locations.map(location => <option key={location} value={location}>{location}</option>)}
        </select></label>
        <label>Фізична локація<select name="physical" defaultValue={filters.physical ?? ""}>
          <option value="">Усі фізичні локації</option>{[...new Set(sourceReport.rows.flatMap(r => r.physicalLocation ? [r.physicalLocation] : []))].sort().map(v => <option key={v}>{v}</option>)}
        </select></label>
        <label>Тип бренду<select name="identity" defaultValue={filters.identity ?? ""}>
          <option value="">Усі типи</option><option value="PHYSICAL">Реальний / фізичний</option><option value="VIRTUAL">Віртуальний</option><option value="UNKNOWN">UNKNOWN</option>
        </select></label>
        <label>Власність<select name="ownership" defaultValue={filters.ownership ?? ""}>
          <option value="">Уся мережа</option><option value="OWNED">Власні</option><option value="FRANCHISE">Франшиза</option><option value="PARTNER">Партнерські</option><option value="UNKNOWN">UNKNOWN</option>
        </select></label>
        <label>Порівняння<select name="compare" defaultValue={filters.compare ?? "portfolio"}>
          <option value="portfolio">Портфель</option><option value="cohort">Співставна когорта</option>
        </select></label>
        <label>Мапінг групи<select name="mapping" defaultValue={filters.mapping}>
          <option value="">Усі стани</option><option value="unknown">Є UNKNOWN</option><option value="approved">Погоджені локація, тип і власність</option>
          <option value="group-only">Група погоджена; фізична локація UNKNOWN</option>
        </select></label>
        <label>Сортування рядків<select name="sort" defaultValue={filters.sort}>
          <option value="source">Рядок Excel</option><option value="month">Місяць</option>
          <option value="brand">Бренд</option><option value="orders-desc">Замовлення ↓</option>
          <option value="amount-desc">Сума покупок ↓</option>
        </select></label>
        <button type="submit">Застосувати</button><a href="/aggregators/glovo">Скинути</a>
      </form>
      <p role="status">Рядків: {report.rows.length} із {sourceReport.rows.length}. KPI і динаміка відповідають вибору.
        Уся мережа включає франчайзі: її сума покупок не є автоматично доходом компанії.
        Пріоритет дат: окремий місяць → від/до → рік → типовий період. Листопад 2026 — PARTIAL.</p>
    </section>}

    <section className="panel" aria-labelledby="glovo-coverage-heading">
      <h2 id="glovo-coverage-heading">Покриття: {report.coverage}</h2>
      <p role="status">{report.coverage === "PARTIAL"
        ? "PARTIAL · показано лише відомі значення; повнота періоду не підтверджена або є пропуски. Це не повний підсумок."
        : "COMPLETE · усі вибрані місяці відповідають digest підтвердження власника та мають строгі підсумки; це не незалежний аудит."}</p>
      <p>Вибрані місяці: {report.months.join(", ")}. Відсутні значення не означають нуль.
        Валюта UAH: підтвердження власника 13.11.2026. Свіжість оригінального експорту: UNKNOWN.
        Підтвердження digest — не незалежний аудит.
        Відомі суми: {analytics.coverage.amount}/{analytics.coverage.rows}; замовлення: {analytics.coverage.orders}/{analytics.coverage.rows};
        парні значення: {analytics.coverage.paired}/{analytics.coverage.rows}; тип бренду: {analytics.coverage.classified}/{analytics.coverage.rows}.</p>
      <p>Бренди у вибраному періоді: {report.brands.join(", ") || "— · недоступно"}.</p>
    </section>

    <section className={styles.kpis} aria-label={`KPI · ${report.coverage}`}>
      {[
        { label: "Сума покупок, UAH", metric: report.metrics.purchaseSum, detail: "Строгий підсумок відомих сум усіх вибраних рядків" },
        { label: "Доставлені замовлення", metric: report.metrics.deliveredOrders, detail: "Місячний агрегат джерела" },
        { label: "Зважений середній чек, UAH", metric: analytics.averageTicket, detail: "Сума / замовлення лише парних рядків; додатний знаменник" },
        { label: "Частка віртуальних брендів, %", metric: analytics.virtualShare, detail: "Частка суми покупок; лише за відомого типу всіх рядків" }
      ].map(({ label, metric, detail }) => <article className="panel" key={label}>
        <h2>{label}</h2><strong className={styles.value}>{value(metric)}</strong>
        <p>{detail}. {report.coverage}{metric === null ? " · недоступно" : ""}.</p>
      </article>)}
    </section>

    <section className="panel" aria-labelledby="glovo-trend-heading">
      <h2 id="glovo-trend-heading">Динаміка за місяцями</h2>
      <p>Order Created Local Month · локальний місяць створення замовлення з джерела.
        PARTIAL — відомі значення, а не повний підсумок місяця.</p>
      <div className={styles.scroll} role="region" aria-label="Таблиця місячної динаміки" tabIndex={0}>
        <table>
          <caption>Місячна динаміка · {report.coverage}</caption>
          <thead><tr>{["Місяць", "Доставлені замовлення", "Сума покупок, UAH", "Середній чек, UAH", "Покриття", "MoM, UAH", "MoM, %"]
            .map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{analytics.trend.map(point => <tr key={point.month}>
            <th scope="row">{point.month}</th><td>{value(point.deliveredOrders)}</td>
            <td>{value(point.purchaseSum)}</td><td>{value(point.ticket)}</td><td>{point.coverage}</td><td>{value(point.absolute)}</td><td>{value(point.percent)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <GlovoManagementPanels analytics={analytics} drilldown={drilldown} />
    <section className="panel" aria-labelledby="glovo-drilldown-heading">
      <h2 id="glovo-drilldown-heading">Бренд × заклад · деталізація</h2>
      <p>Сирий бренд і назви збережені. Заклад у таблиці не підтверджує фізичну локацію.
        Рядок Excel — походження агрегату, а не ID замовлення.</p>
      <div className={styles.scroll} role="region" aria-label="Деталізація брендів та закладів" tabIndex={0}>
        <table>
          <caption>Бренд × заклад × місяць · рядки джерела; покриття періоду {report.coverage}</caption>
          <thead><tr>{["Місяць", "Бренд у джерелі", "Погоджена група", "Заклад у таблиці",
            "Назва у джерелі", "Адреса у джерелі", "Фізична локація", "Власність", "Реальний / віртуальний тип",
            "Доставлені замовлення", "Сума покупок, UAH", "Середній чек, UAH", "Рядок Excel", "Мапінг"]
            .map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.rows.length ? report.rows.map(row => <tr key={row.key}>
            <th scope="row">{row.month}</th><td><a href={drilldown({brand: row.rawBrand, location: row.sourceLocation})}>{row.rawBrand}</a></td><td>{row.normalizedGroup ?? "UNKNOWN / needs mapping"}</td>
            <td>{row.sourceLocation}</td><td>{row.sourceName}</td><td>{row.sourceAddress}</td>
            <td>{row.physicalLocation ?? "UNKNOWN / needs mapping"}</td><td>{row.ownership}</td><td>{row.identity}</td>
            <td>{value(row.deliveredOrders)}</td><td>{value(row.purchaseSum)}</td><td>{value(glovoMetrics([row]).averageTicket)}</td><td>{row.sourceRow}</td><td><details><summary>Походження та мапінг</summary>
              <p>{row.mappingReason}</p><p>Ключ агрегату: <code>{row.key}</code></p>
              <p>Місяць {row.month} · рядок Excel {row.sourceRow}. Ідентифікатор замовлення відсутній.</p>
            </details></td>
          </tr>) : <tr><td colSpan={14}>— · недоступно · немає рядків у вибраному періоді</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
