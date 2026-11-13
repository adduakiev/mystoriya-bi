// Pure source contract. No network, credentials, storage or business fixtures.
export const GLOVO_HEADERS = [
  "Місяць", "Бренд", "Заклад: група та головний бренд", "Назва у джерелі",
  "Адреса у джерелі", "Доставлені замовлення", "Сума покупок, лок. вал.",
  "Рядок Excel", "Є числові дані"
] as const;

export const GLOVO_DEFAULT_MONTHS = Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

export type GlovoRow = {
  key: string;
  month: string;
  rawBrand: string;
  normalizedGroup: string | null;
  sourceLocation: string;
  sourceName: string;
  sourceAddress: string;
  physicalLocation: string | null;
  ownership: "UNKNOWN" | "OWNED" | "FRANCHISE" | "PARTNER";
  identity: "UNKNOWN" | "PHYSICAL" | "VIRTUAL";
  mappingReason: string;
  deliveredOrders: number | null;
  purchaseSum: number | null;
  sourceHasNumeric: boolean;
  sourceRow: number;
};

export type GlovoContract = {
  status: "valid" | "invalid";
  rows: GlovoRow[];
  brands: string[];
  issues: Array<{ row: number; code: string }>;
};

// Match only explicitly approved aliases, never substring/fuzzy brand matching.
const aliasKey = (value: string) => value.trim().replace(/[ʼ’`]/g, "'").replace(/\s+/g, " ").toLocaleLowerCase("uk");
const meatbarAliases = new Set([
  "Мʼясторія Meat Bar", "Meatbar Івано-Франківська", "Meatbar М'ясторія", "Мітбар М'ясторія",
  "Meatbar М'ясторія / Мітбар М'ясторія"
].map(aliasKey));

function measure(value: unknown, count = false): number | null {
  // Typed numeric cells only. Blanks, booleans and locale-formatted strings
  // must never be silently coerced into measured zero.
  return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
    (!count || Number.isSafeInteger(value)) ? value : null;
}

function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Input starts at Sheet row 5 (header), then row 6 onward. A future authorized
 * provider must supply canonical YYYY-MM local months and typed numeric cells.
 * No date/timezone inference from formatted month text or workbook title.
 */
export function normalizeGlovoSheet(values: readonly (readonly unknown[])[]): GlovoContract {
  const issues: GlovoContract["issues"] = [];
  const rows: GlovoRow[] = [];
  if (values[0]?.length !== GLOVO_HEADERS.length ||
      GLOVO_HEADERS.some((header, index) => values[0][index] !== header)) {
    return { status: "invalid", rows: [], brands: [], issues: [{ row: 5, code: "HEADER_MISMATCH" }] };
  }
  const keys = new Set<string>();
  for (const [index, cells] of values.slice(1).entries()) {
    const row = index + 6;
    if (cells.every(cell => cell === null || cell === undefined || cell === "")) continue;
    const [month, rawBrand, sourceLocation, sourceName, sourceAddress, orders, sum, sourceRow, hasNumeric] = cells;
    // UNFORMATTED_VALUE exposes column I as native 1/0; accept only these
    // exact numeric flags or booleans, never strings or other coercible values.
    const sourceHasNumeric = typeof hasNumeric === "boolean" ? hasNumeric
      : hasNumeric === 1 ? true : hasNumeric === 0 ? false : undefined;
    if (!isMonth(month) || [rawBrand, sourceLocation, sourceName, sourceAddress].some(v => typeof v !== "string" || !v.trim()) ||
        !Number.isSafeInteger(sourceRow) || (sourceRow as number) < 1 || sourceHasNumeric === undefined || cells.length > 9) {
      issues.push({ row, code: "ROW_CONTRACT_INVALID" });
      continue;
    }
    const brand = rawBrand as string;
    const location = sourceLocation as string;
    const name = sourceName as string;
    const address = sourceAddress as string;
    // Source Excel row is lineage, not a unique order ID. Keep aliases distinct.
    const key = JSON.stringify([month, brand, location, name, address]);
    if (keys.has(key)) {
      issues.push({ row, code: "DUPLICATE_COMPOSITE_KEY" });
      continue;
    }
    keys.add(key);
    const deliveredOrders = measure(orders, true);
    const purchaseSum = measure(sum);
    // Column I's formula semantics are unverified. Retain it as source metadata;
    // readiness always uses the actual F/G cells, never this flag.
    const normalizedGroup = meatbarAliases.has(aliasKey(brand)) ? "МітБар" : null;
    rows.push({ key, month, rawBrand: brand, normalizedGroup, sourceLocation: location,
      sourceName: name, sourceAddress: address, sourceRow: sourceRow as number,
      deliveredOrders, purchaseSum, sourceHasNumeric, physicalLocation: null, ownership: "UNKNOWN", identity: "UNKNOWN",
      mappingReason: normalizedGroup === null
        ? "UNKNOWN / needs mapping: група, фізична локація, власність та тип закладу не підтверджені"
        : "UNKNOWN / needs mapping: фізична локація, власність та тип закладу не підтверджені" });
  }
  // Never expose a partial accepted dataset after a structural failure.
  if (issues.length) return { status: "invalid", rows: [], brands: [], issues };
  return { status: "valid", rows, brands: [...new Set(rows.map(row => row.rawBrand))].sort(), issues };
}

export type GlovoMetrics = {
  deliveredOrders: number | null;
  purchaseSum: number | null;
  averageTicket: number | null;
};

export function glovoMetrics(rows: readonly GlovoRow[]): GlovoMetrics {
  const total = (field: "deliveredOrders" | "purchaseSum") => {
    if (!rows.length || rows.some(row => row[field] === null)) return null;
    const sum = rows.reduce((value, row) => value + (row[field] as number), 0);
    return Number.isFinite(sum) && (field !== "deliveredOrders" || Number.isSafeInteger(sum)) ? sum : null;
  };
  const deliveredOrders = total("deliveredOrders");
  const purchaseSum = total("purchaseSum");
  const averageTicket = deliveredOrders !== null && deliveredOrders > 0 && purchaseSum !== null
    ? purchaseSum / deliveredOrders : null;
  return { deliveredOrders, purchaseSum, averageTicket: averageTicket !== null && Number.isFinite(averageTicket) ? averageTicket : null };
}

/** verifiedMonths is independent coverage evidence from the authorized provider,
 * never inferred from row presence or same-sheet subtotal reconciliation. */
export function buildGlovoReport(contract: GlovoContract, verifiedMonths: readonly string[] = [], months: readonly string[] = GLOVO_DEFAULT_MONTHS) {
  if (contract.status !== "valid" || months.length === 0 || months.some(month => !isMonth(month)) || new Set(months).size !== months.length) return null;
  const rows = contract.rows.filter(row => months.includes(row.month));
  const trend = [...months].sort().map(month => {
    const selected = rows.filter(row => row.month === month);
    const metrics = glovoMetrics(selected);
    return { month, ...metrics, coverage: selected.length > 0 && verifiedMonths.includes(month) &&
      metrics.deliveredOrders !== null && metrics.purchaseSum !== null ? "COMPLETE" as const : "PARTIAL" as const };
  });
  return { months: [...months], rows, brands: [...new Set(rows.map(row => row.rawBrand))].sort(),
    metrics: glovoMetrics(rows), trend, coverage: trend.every(point => point.coverage === "COMPLETE") ? "COMPLETE" as const : "PARTIAL" as const };
}

export function glovoPeriodChange(current: { coverage: string; metrics: GlovoMetrics }, previous: { coverage: string; metrics: GlovoMetrics }): number | null {
  const a = current.metrics.purchaseSum, b = previous.metrics.purchaseSum;
  if (current.coverage !== "COMPLETE" || previous.coverage !== "COMPLETE" || a === null || b === null || b <= 0) return null;
  const change = (a / b - 1) * 100;
  return Number.isFinite(change) ? change : null;
}


export type GlovoReport = NonNullable<ReturnType<typeof buildGlovoReport>>;
export type GlovoFilters = {
  month: string; brand: string; group: string; location: string; mapping: string; sort: string;
  year?: string; from?: string; to?: string; physical?: string; identity?: string; ownership?: string; compare?: string;
};
export const GLOVO_SORTS = ["source", "month", "brand", "orders-desc", "amount-desc"] as const;

/** URL input selects exact source values only; no matching/identity inference.
 * Coverage can only remain as trusted by the input report, never be upgraded.
 */
export function selectGlovoReport(report: GlovoReport, filters: GlovoFilters): GlovoReport {
  const months = glovoSelectedMonths(report, filters);
  const rows = report.rows.filter(row => months.includes(row.month) &&
    (!filters.brand || row.rawBrand === filters.brand) &&
    (!filters.group || (filters.group === "unknown" ? row.normalizedGroup === null : row.normalizedGroup === filters.group)) &&
    (!filters.location || row.sourceLocation === filters.location) &&
    (!filters.physical || row.physicalLocation === filters.physical) &&
    (!filters.identity || row.identity === filters.identity) &&
    (!filters.ownership || row.ownership === filters.ownership) &&
    (!filters.mapping || (filters.mapping === "approved" ? row.physicalLocation !== null && row.identity !== "UNKNOWN" && row.ownership !== "UNKNOWN" :
      filters.mapping === "unknown" ? row.normalizedGroup === null || row.physicalLocation === null || row.identity === "UNKNOWN" || row.ownership === "UNKNOWN" :
      filters.mapping === "group-only" && row.normalizedGroup !== null && row.physicalLocation === null)));
  const compareText = (a: string, b: string) => a.localeCompare(b, "uk");
  rows.sort((a, b) => {
    if (filters.sort === "orders-desc" || filters.sort === "amount-desc") {
      const field = filters.sort === "orders-desc" ? "deliveredOrders" : "purchaseSum";
      const x = a[field], y = b[field];
      if (x === null || y === null) return x === y ? compareText(a.key, b.key) : x === null ? 1 : -1;
      return y - x || compareText(a.key, b.key);
    }
    if (filters.sort === "brand") return compareText(a.rawBrand, b.rawBrand) || compareText(a.key, b.key);
    if (filters.sort === "month") return compareText(a.month, b.month) || compareText(a.key, b.key);
    return a.sourceRow - b.sourceRow || compareText(a.key, b.key);
  });
  const trend = [...months].sort().map(month => {
    const selected = rows.filter(row => row.month === month);
    const metrics = glovoMetrics(selected);
    return {month, ...metrics, coverage: selected.length > 0 &&
      report.trend.find(point => point.month === month)?.coverage === "COMPLETE" &&
      metrics.deliveredOrders !== null && metrics.purchaseSum !== null ? "COMPLETE" as const : "PARTIAL" as const};
  });
  return {months: [...months], rows, brands: [...new Set(rows.map(row => row.rawBrand))].sort(),
    metrics: glovoMetrics(rows), trend,
    coverage: trend.length > 0 && trend.every(point => point.coverage === "COMPLETE") ? "COMPLETE" : "PARTIAL"};
}

/** Enumerate the entire contiguous requested window, including absent months. */
export function glovoSelectedMonths(report: GlovoReport, filters: GlovoFilters): string[] {
  if (filters.month && filters.month !== "all") return isMonth(filters.month) ? [filters.month] : [];
  if (filters.from || filters.to) {
    if (!isMonth(filters.from) || !isMonth(filters.to) || filters.from > filters.to) return [];
    const start = Number(filters.from.slice(0, 4)) * 12 + Number(filters.from.slice(5)) - 1;
    const end = Number(filters.to.slice(0, 4)) * 12 + Number(filters.to.slice(5)) - 1;
    if (end - start > 119) return [];
    return Array.from({length: end - start + 1}, (_, i) => glovoMonth(start + i));
  }
  if (filters.year) return /^\d{4}$/.test(filters.year)
    ? Array.from({length: 12}, (_, i) => `${filters.year}-${String(i + 1).padStart(2, "0")}`) : [];
  if (filters.month === "all") {
    const available = [...report.months].sort();
    return available.length ? glovoSelectedMonths(report, {...filters, month: "", year: "", from: available[0], to: available.at(-1)}) : [];
  }
  return GLOVO_DEFAULT_MONTHS;
}
export function glovoMonth(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}
