import Link from "next/link";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { loadGlovoSource } from "@/lib/data/glovo-source";
import { GlovoMonthlyDashboard } from "./GlovoMonthlyDashboard";
import styles from "./report.module.css";

export const dynamic = "force-dynamic";
export default async function GlovoBrandsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const source = await loadGlovoSource();
  const params = await props?.searchParams ?? {};
  const input = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const rows = "monthlyRows" in source ? source.monthlyRows : undefined;
  return <main className="shell">
    <DashboardSidebar activeHref="/aggregators/glovo" lfl={false}
      statusTitle={source.status} statusDetail={"Glovo · останній місяць " + (source.latestEventMonth ?? "невідомо")} />
    <section className={"workspace " + styles.report}>
      <nav aria-label="Звіти агрегаторів" className={styles.navigation}>
        <Link href="/aggregators" prefetch={false}>← Агрегатори</Link>
        <Link href="/aggregators/glovo" aria-current="page" prefetch={false}>Glovo · Аналітика брендів</Link>
      </nav>
      <h1>Glovo · Аналітика брендів</h1>
      {rows ? <GlovoMonthlyDashboard rows={rows} incompleteMonths={("incompleteMonths" in source ? source.incompleteMonths : []) ?? []}
        initialFilters={{brand: input("brand"), ownership: input("ownership"), location: input("location"),
          identity: input("identity"), selectedBrand: input("selectedBrand"),
          ...(/^[1-9]\d{3}$/.test(input("year")) ? {year: Number(input("year"))} : {}),
          ...(input("month") ? {focusMonth: input("month")} : {}),
          metric: input("metric") === "orders" ? "deliveredOrders" : "purchaseSum",
          secondary: input("secondary") === "share" ? "share" : input("secondary") === "none" ? "none" : "mom"}} />
      : <section className="panel" aria-labelledby="glovo-source-error">
          <h2 id="glovo-source-error">Дані Glovo недоступні</h2>
          <p role="status">{source.reason}</p>
          <p>Значення не підставляються з інших джерел. Пропуски не означають нуль продажів.</p>
          <Link href="/aggregators/glovo" prefetch={false}>Повторити читання</Link>
        </section>}
      <details className="panel"><summary>Джерело, свіжість і визначення</summary>
        <p>Приватне читання Google Sheets. Останній місяць: {source.latestEventMonth ?? "невідомо"}.
          Час читання: {source.lastReadAt ?? "невідомо"}. Час читання не підтверджує дату останнього продажу чи повноту експорту.</p>
        <p>Мапінг береться лише з погоджених рядків таблиці. Перший продаж не визначає дату відкриття.
          Підсумки та порівняння — за завантаженими даними; повнота оригінального експорту незалежно не підтверджена.</p>
        <p>Місячні агрегати бренд × заклад. Сума покупок не дорівнює прибутку чи виплаті після комісій.
          Автоматичного запису та фонового оновлення немає.</p>
        {rows && <Link href="/aggregators/glovo" prefetch={false}>Перечитати джерело</Link>}
      </details>
    </section>
  </main>;
}
