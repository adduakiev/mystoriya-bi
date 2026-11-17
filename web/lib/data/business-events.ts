/** Owner-confirmed business events. Descriptive context, never causal attribution. */
export const WEBSITE_RELAUNCH = {
  id: "myastoriya-website-2026-11-16",
  label: "Запуск нового сайту М’ясторії",
  at: "2026-11-16T09:00:00+02:00",
  timezone: "Europe/Kyiv",
  localDate: "2026-11-16",
  source: "owner-confirmed",
  precision: "hour",
  affectedDomains: ["sales", "traffic", "conversion", "performance", "redirects", "ads"],
} as const;

export type EventPeriod = "before" | "after" | "mixed" | "unknown";

/** Half-open interval [start, end). Explicit offsets are required. */
export function websiteEventPeriod(start: string, end: string): EventPeriod {
  const timestamp = (value: string) => /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? Date.parse(value) : NaN;
  const from = timestamp(start), to = timestamp(end), event = Date.parse(WEBSITE_RELAUNCH.at);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return "unknown";
  if (to <= event) return "before";
  if (from >= event) return "after";
  return "mixed";
}

/** Input is a validated local reporting day, not a UTC timestamp converted by slicing. */
export function websiteEventDay(day: string): EventPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "unknown";
  const parsed = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return "unknown";
  return day < WEBSITE_RELAUNCH.localDate ? "before" : day > WEBSITE_RELAUNCH.localDate ? "after" : "mixed";
}
