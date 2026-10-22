/** Missing values and undefined ratios must not become measured zeroes. */
export function metricNumber(value: unknown): number | null {
  if (value == null || typeof value === "boolean" ||
      (typeof value === "string" && value.trim() === "") ||
      !["number", "string"].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function metricRatio(numerator: unknown, denominator: unknown): number | null {
  const n = metricNumber(numerator);
  const d = metricNumber(denominator);
  if (n === null || d === null || d <= 0) return null;
  const ratio = n / d;
  return Number.isFinite(ratio) ? ratio : null;
}

export function snapshotDate(latest: string | undefined, cutoff: string): string | null {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return latest && valid(latest) && valid(cutoff) && latest <= cutoff ? latest : null;
}

/** Row presence, not an all-history count. Legacy nonzero additive fields prove
 * at least one stored row; all-zero coalesced aggregates remain ambiguous. */
export function periodHasRows(rows: unknown, values: Record<string, unknown> | null = {}): boolean {
  const count = metricNumber(rows);
  if (count !== null) return count > 0;
  return Object.values(values ?? {}).some(value => {
    const n = metricNumber(value);
    return n !== null && n !== 0;
  });
}

export function sourceCoverage(value: unknown): "FULL" | "PARTIAL" | "UNKNOWN" {
  return value === "FULL" || value === "PARTIAL" ? value : "UNKNOWN";
}

export function snapshotPeriod(from: unknown, to: unknown, rowLimit: number) {
  const valid = typeof from === "string" && typeof to === "string" &&
    snapshotDate(from, to) !== null &&
    Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) === 29 * 86400000;
  return { from: valid ? from : null, to: valid ? to : null,
    periodDays: 30, periodBasis: "REQUESTED_EXACT_30_DAYS" as const, snapshotId: null, rowLimit, upstreamRowLimit: null, completeness: "UNKNOWN" as const };
}

export function metricSum(...values: unknown[]): number | null {
  const numbers = values.map(metricNumber);
  return numbers.length && numbers.every((v): v is number => v !== null)
    ? metricNumber(numbers.reduce((sum, v) => sum + v, 0)) : null;
}

export function coreWebVitalsCategory(lcp: unknown, inp: unknown, cls: unknown): string {
  const l = metricNumber(lcp), i = metricNumber(inp), c = metricNumber(cls);
  if (l === null || i === null || c === null) return "UNKNOWN";
  if (l <= 2500 && i <= 200 && c <= 0.1) return "GOOD";
  if (l > 4000 || i > 500 || c > 0.25) return "POOR";
  return "NEEDS_IMPROVEMENT";
}

export function formatMetric(value: unknown, digits = 0): string {
  const number = metricNumber(value);
  return number === null ? "—" : number.toLocaleString("uk-UA", {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  });
}

/** A missing month invalidates the cumulative value for that field. Each
 * operand has its own completeness; sessions do not prove purchase coverage. */
export function historyCumulative(
  rows: Array<{month: number; sessions: number|null; purchases: number|null; revenue: number|null; seoClicks: number|null; seoImpressions: number|null}>,
  metric: "sessions"|"purchases"|"revenue"|"conversionRate"|"seoClicks"|"seoCtr"
): Record<number, number|null> {
  const result: Record<number, number|null> = {};
  const fields = ["sessions", "purchases", "revenue", "seoClicks", "seoImpressions"] as const;
  const totals = new Map<string, number|null>(fields.map(field => [field, 0]));
  const byMonth = new Map(rows.map(row => [row.month, row]));
  for (let month = 1; month <= 12; month++) {
    const row = byMonth.get(month);
    for (const field of fields) totals.set(field, metricSum(totals.get(field), row?.[field]));
    result[month] = metric === "conversionRate"
      ? metricRatio(totals.get("purchases"), totals.get("sessions"))
      : metric === "seoCtr" ? metricRatio(totals.get("seoClicks"), totals.get("seoImpressions"))
      : totals.get(metric) ?? null;
  }
  return result;
}

/** Global source maxima are not necessarily dates within the selected period. */
export function periodSourceDate(latest: unknown, from: unknown, to: unknown): string|null {
  return typeof from === "string" && typeof to === "string" && typeof latest === "string" &&
    snapshotDate(from, to) && snapshotDate(latest, to) && latest >= from ? latest : null;
}
