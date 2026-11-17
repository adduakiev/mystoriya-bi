import type { GlovoRow } from "./glovo-contract";

// Pure helpers. Opening dates must come from confirmed mapping metadata;
// row presence / first sale never supplies an opening date.
export type MonthlyRow = Omit<GlovoRow, "physicalLocation" | "ownership" | "identity"> & {
  physicalLocation: string | null;
  physicalId: string | null;
  ownership: string;
  identity: string;
  openingMonth: string | null;
};
export type MonthlyMetric = "purchaseSum" | "deliveredOrders" | "averageTicket";
export type MonthlyAggregate = { value: number | null; known: number; expected: number; missing: number; partial: boolean };
export type MonthlyComparison = { percent: number | null; absolute: number | null; reason: string | null };
export type MonthlyFilters = { brand?: string | null; location?: string | null; ownership?: string | null; identity?: string | null };

const validMonth = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
const storefrontKey = (row: MonthlyRow) => JSON.stringify([row.rawBrand, row.sourceLocation]);
const validMetric = (metric: MonthlyMetric) => metric === "purchaseSum" || metric === "deliveredOrders" || metric === "averageTicket";
const valueOf = (value: unknown, metric: MonthlyMetric): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER &&
  (metric !== "deliveredOrders" || Number.isSafeInteger(value)) ? value : null;
const unavailable = (): MonthlyAggregate => ({ value: null, known: 0, expected: 0, missing: 0, partial: true });

type Storefront = { key: string; rows: MonthlyRow[]; opening: string | null; conflict: boolean };
function storefronts(rows: readonly MonthlyRow[]): Storefront[] {
  const groups = new Map<string, MonthlyRow[]>();
  for (const row of rows) {
    const key = storefrontKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => {
    const openings = [...new Set(group.map(row => row.openingMonth).filter(validMonth))];
    const opening = openings.length === 1 ? openings[0] : null;
    // Positive activity before a claimed opening is contradictory evidence.
    // Explicit zero/blank source placeholders before opening are not observations.
    const conflict = openings.length > 1 || (opening !== null && group.some(row => validMonth(row.month) && row.month < opening &&
      ((valueOf(row.purchaseSum, "purchaseSum") ?? 0) > 0 || (valueOf(row.deliveredOrders, "deliveredOrders") ?? 0) > 0)));
    return { key, rows: group, opening, conflict };
  });
}

function notOpen(storefront: Storefront, month: string): boolean {
  return !storefront.conflict && storefront.opening !== null && month < storefront.opening;
}

export function glovoMonthAxis(rows: readonly MonthlyRow[], year: number): string[] {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return [];
  const last = rows.reduce((latest, row) => validMonth(row.month) && Number(row.month.slice(0, 4)) === year
    ? Math.max(latest, Number(row.month.slice(5))) : latest, 0);
  return Array.from({ length: last }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function datasetAxis(rows: readonly MonthlyRow[]): string[] {
  const years = [...new Set(rows.filter(row => validMonth(row.month)).map(row => Number(row.month.slice(0, 4))))].sort((a, b) => a - b);
  return years.flatMap(year => glovoMonthAxis(rows, year));
}

/** Counts are storefront-month cells. Pass the global selected-year axis for
 * a brand/site subtotal so missing trailing months stay visible as unknown.
 * Multiple rows for one storefront-month are ambiguous, never double-counted.
 * expected=known=0/value=0/partial=false means confirmed not-open, not measured 0.
 */
export function aggregateMonthlyRange(rows: readonly MonthlyRow[], months: readonly string[], metric: MonthlyMetric): MonthlyAggregate {
  if (!rows.length || !months.length || !validMetric(metric) || months.some(month => !validMonth(month)) || new Set(months).size !== months.length) return unavailable();
  if (metric === "averageTicket") {
    const amount = aggregateMonthlyRange(rows, months, "purchaseSum");
    const orders = aggregateMonthlyRange(rows, months, "deliveredOrders");
    const partial = amount.partial || orders.partial;
    const known = Math.min(amount.known, orders.known);
    const expected = Math.max(amount.expected, orders.expected);
    const value = expected === 0 && !partial ? 0 : !partial && amount.value !== null && orders.value !== null && orders.value > 0
      ? amount.value / orders.value : null;
    return { value: value !== null && Number.isFinite(value) ? value : null, known, expected, missing: expected-known, partial };
  }
  let expected = 0, known = 0, total = 0, unsafe = false;
  for (const storefront of storefronts(rows)) {
    for (const month of months) {
      if (notOpen(storefront, month)) continue;
      expected += 1;
      const selected = storefront.rows.filter(row => row.month === month);
      const value = !storefront.conflict && selected.length === 1 ? valueOf(selected[0][metric], metric) : null;
      if (value === null) continue;
      known += 1;
      total += value;
      if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER || (metric === "deliveredOrders" && !Number.isSafeInteger(total))) unsafe = true;
    }
  }
  const missing = expected - known;
  return { value: unsafe || (expected > 0 && known === 0) ? null : total, known, expected, missing, partial: unsafe || missing > 0 };
}

/** null means Jan→latest for each year present; caller year-filters annual data. */
export function aggregateMonthly(rows: readonly MonthlyRow[], month: string | null, metric: MonthlyMetric): MonthlyAggregate {
  return aggregateMonthlyRange(rows, month === null ? datasetAxis(rows) : [month], metric);
}

export function compareMonthly(rows: readonly MonthlyRow[], month: string, metric: MonthlyMetric, incompleteMonths: readonly string[]): MonthlyComparison {
  const blocked = (reason: string): MonthlyComparison => ({ percent: null, absolute: null, reason });
  if (!validMonth(month) || !validMetric(metric)) return blocked("INVALID_MONTH");
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5));
  const previous = number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, "0")}`;
  if (!validMonth(previous)) return blocked("INVALID_MONTH");
  if (incompleteMonths.includes(month) || incompleteMonths.includes(previous)) return blocked("INCOMPLETE_MONTH");
  const stores = storefronts(rows);
  const currentKeys = stores.filter(store => !notOpen(store, month)).map(store => store.key).sort();
  const previousKeys = stores.filter(store => !notOpen(store, previous)).map(store => store.key).sort();
  if (!currentKeys.length && !previousKeys.length) return blocked("NO_COMPARABLE_STOREFRONTS");
  if (currentKeys.length !== previousKeys.length || currentKeys.some((key, index) => key !== previousKeys[index])) return blocked("COHORT_MISMATCH");
  const current = aggregateMonthly(rows, month, metric), prior = aggregateMonthly(rows, previous, metric);
  if (current.missing || prior.missing) return blocked("MISSING_OBSERVATIONS");
  if (current.value === null || prior.value === null || current.partial || prior.partial) return blocked("UNSAFE_TOTAL");
  const absolute = current.value - prior.value;
  if (!Number.isFinite(absolute)) return blocked("UNSAFE_TOTAL");
  if (prior.value === 0) return { percent: null, absolute, reason: "ZERO_BASELINE" };
  const percent = absolute / prior.value * 100;
  return Number.isFinite(percent) ? { percent, absolute, reason: null } : blocked("UNSAFE_TOTAL");
}

/** Select exact source values. A mapped physicalId is the selector value when
 * available; otherwise sourceLocation. Physical display names are never keys.
 * Current runtime has no confirmed IDs and therefore selects sourceLocation.
 */
export function filterMonthlyRows(rows: readonly MonthlyRow[], filters: MonthlyFilters): MonthlyRow[] {
  return rows.filter(row => (!filters.brand || row.rawBrand === filters.brand) &&
    (!filters.location || (row.physicalId ?? row.sourceLocation) === filters.location) &&
    (!filters.ownership || row.ownership === filters.ownership) &&
    (!filters.identity || row.identity === filters.identity));
}

export function monthlyAverageTicket(rows: readonly MonthlyRow[], month: string | null, months?: readonly string[]): number | null {
  const axis = month === null ? months ?? datasetAxis(rows) : [month];
  const amount = aggregateMonthlyRange(rows, axis, "purchaseSum"), orders = aggregateMonthlyRange(rows, axis, "deliveredOrders");
  if (amount.partial || orders.partial || amount.value === null || orders.value === null || orders.value <= 0) return null;
  const average = amount.value / orders.value;
  return Number.isFinite(average) ? average : null;
}

export function monthlyShare(partRows: readonly MonthlyRow[], allRows: readonly MonthlyRow[], month: string | null, metric: MonthlyMetric): number | null {
  if (metric === "averageTicket") return null; // Ratios are not additive shares.
  const axis = month === null ? datasetAxis(allRows) : [month];
  const part = aggregateMonthlyRange(partRows, axis, metric), all = aggregateMonthlyRange(allRows, axis, metric);
  if (part.partial || all.partial || part.value === null || all.value === null || all.value <= 0 || part.value > all.value) return null;
  const allKeys = new Set(allRows.map(storefrontKey));
  if (partRows.some(row => !allKeys.has(storefrontKey(row)))) return null;
  return part.value / all.value * 100;
}

export function monthlyVirtualShare(rows: readonly MonthlyRow[], month: string | null, metric: MonthlyMetric): number | null {
  if (metric === "averageTicket") return null;
  const axis = month === null ? datasetAxis(rows) : [month];
  const all = aggregateMonthlyRange(rows, axis, metric);
  if (all.partial || all.value === null || all.value <= 0) return null;
  const applicable = storefronts(rows).filter(store => axis.some(period => !notOpen(store, period)));
  if (applicable.some(store => {
    const identities = new Set(store.rows.map(row => row.identity));
    return identities.size !== 1 || !["Реальний", "Віртуальний"].includes([...identities][0]);
  })) return null;
  const virtual = rows.filter(row => row.identity === "Віртуальний");
  return virtual.length ? monthlyShare(virtual, rows, month, metric) : 0;
}
