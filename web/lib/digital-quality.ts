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

/** A derived total is unknown when any component is unknown. */
export function metricSum(...values: (number | null)[]): number | null {
  if (values.some(value => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + (value as number), 0);
  return Number.isFinite(total) ? total : null;
}
