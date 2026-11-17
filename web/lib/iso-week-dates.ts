export type IsoWeekDateRange = {
  isoYear: number;
  week: number;
  monday: string;
  sunday: string;
  shortLabel: string;
  fullLabel: string;
};

const dayMs = 86_400_000;

function firstMonday(isoYear: number): number {
  const january4 = new Date(0);
  january4.setUTCFullYear(isoYear, 0, 4);
  return january4.getTime() - ((january4.getUTCDay() + 6) % 7) * dayMs;
}

/** Calendar dates for one ISO year, independent of viewer timezone or observed data. */
export function isoWeekDateRange(isoYear: number, week: number | string): IsoWeekDateRange | null {
  if (!Number.isInteger(isoYear) || isoYear < 1 || isoYear > 9998) return null;
  const weekNumber = typeof week === "number" ? week
    : /^W\d{2}$/.test(week) ? Number(week.slice(1)) : NaN;
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) return null;
  const first = firstMonday(isoYear);
  const start = first + (weekNumber - 1) * 7 * dayMs;
  if (start >= firstMonday(isoYear + 1)) return null;
  const monday = new Date(start).toISOString().slice(0, 10);
  const sunday = new Date(start + 6 * dayMs).toISOString().slice(0, 10);
  const short = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
  const full = (date: string) => `${short(date)}.${date.slice(0, 4)}`;
  const label = `W${String(weekNumber).padStart(2, "0")}`;
  return {
    isoYear, week: weekNumber, monday, sunday,
    shortLabel: `${label} ${short(monday)}–${short(sunday)}`,
    fullLabel: `${label} ${full(monday)}–${full(sunday)}`
  };
}
