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

export type Coverage = "FULL" | "PARTIAL" | "UNKNOWN";
export function coverage(value: unknown): Coverage {
  return value === "FULL" || value === "PARTIAL" ? value : "UNKNOWN";
}

export function metricSum(...values: unknown[]): number | null {
  const numbers = values.map(metricNumber);
  if (!numbers.length || numbers.some(n => n === null)) return null;
  const sum = (numbers as number[]).reduce((a, b) => a + b, 0);
  return Number.isFinite(sum) ? sum : null;
}

export function periodMatches(meta: { from?: unknown; to?: unknown }, from: string, to: string): boolean {
  return meta.from === from && meta.to === to && snapshotDate(from, to) !== null;
}

export function snapshotPeriodFrom(to: string): string {
  const date = new Date(`${to}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 29);
  return date.toISOString().slice(0, 10);
}

/** Limits are RPC output caps, not confirmation of provider completeness. */
export type SnapshotMetadata = {
  from: string | null; to: string | null; periodDays: 30;
  returnedRows: number; rpcRowLimit: number; providerRowLimit: null;
  coverage: "UNKNOWN"; snapshotIdentity: "UNVERIFIED";
};
export function snapshotMetadata(meta: Record<string, unknown> | undefined, rpcRowLimit: number, returnedRows: number): SnapshotMetadata {
  const to = typeof meta?.to === "string" ? snapshotDate(meta.to, meta.to) : null;
  const from = to ? snapshotPeriodFrom(to) : null;
  const matched = !!from && !!to && periodMatches(meta ?? {}, from, to);
  return { from: matched ? from : null, to: matched ? to : null, periodDays: 30,
    returnedRows: matched ? returnedRows : 0, rpcRowLimit, providerRowLimit: null, coverage: "UNKNOWN", snapshotIdentity: "UNVERIFIED" };
}

export function periodQuality(meta: Record<string, unknown> | undefined) {
  return {
    coverage: coverage(meta?.coverage),
    from: typeof meta?.from === "string" ? snapshotDate(meta.from, meta.from) : null,
    to: typeof meta?.to === "string" ? snapshotDate(meta.to, meta.to) : null,
    observedDates: metricNumber(meta?.observedDates),
    expectedDates: metricNumber(meta?.expectedDates),
    providerRowLimit: metricNumber(meta?.providerRowLimit),
    snapshotConsistency: "UNVERIFIED" as const,
    zeroProvenance: meta?.contractVersion === 2 ? "WAREHOUSE_ROWS" as const : "UNKNOWN" as const
  };
}
export type PeriodQuality = ReturnType<typeof periodQuality>;

/** The legacy RPC infers a category even with absent CrUX inputs. */
export function speedCategory(lcp: unknown, inp: unknown, cls: unknown, reported: unknown): string {
  if ([lcp, inp, cls].some(value => metricNumber(value) === null)) return "UNKNOWN";
  return ["GOOD", "POOR", "NEEDS_IMPROVEMENT"].includes(String(reported)) ? String(reported) : "UNKNOWN";
}

/** Any missing month/component makes a YTD total unknown from that point. */
export function cumulativeMetric(rows: Array<Record<string, unknown>>, metric: string): Record<number, number | null> {
  let total: number | null = 0;
  let denominator: number | null = 0;
  let expectedMonth = 1;
  const values: Record<number, number | null> = {};
  for (const row of rows) {
    const month = Number(row.month);
    if (month !== expectedMonth) total = null;
    expectedMonth = month + 1;
    const numeratorKey = metric === "conversionRate" ? "purchases" : metric === "seoCtr" ? "seoClicks" : metric;
    total = metricSum(total, row[numeratorKey]);
    if (metric === "conversionRate" || metric === "seoCtr") {
      denominator = metricSum(denominator, row[metric === "conversionRate" ? "sessions" : "seoImpressions"]);
      values[month] = metricRatio(total, denominator);
    } else values[month] = total;
  }
  return values;
}
