import type { GlovoRow } from "./glovo-contract";
import type { MonthlyRow } from "./glovo-monthly";
export const GLOVO_LOCATION_HEADERS = ["Заклад у джерелі", "Адреси з джерела", "Заклад головного борду", "Погодження", "Коментар"] as const;
export const GLOVO_BRAND_HEADERS = ["Рядок Excel", "Бренд у джерелі", "Заклад у джерелі", "Тип бренду", "Власність", "Погодження", "Коментар"] as const;
const failure = () => new Error("GLOVO_MAPPING_INVALID");
const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
function records(values: readonly (readonly unknown[])[], headers: readonly string[]) {
  if (values[0]?.length !== headers.length || headers.some((h, i) => values[0][i] !== h)) throw failure();
  return values.slice(1).filter(row => row.some(v => v !== null && v !== undefined && v !== "")).map(row => {
    if (row.length > headers.length || row.some(v => v !== null && typeof v !== "string" &&
      (typeof v !== "number" || !Number.isFinite(v)))) throw failure();
    return row;
  });
}
/** Approved exact brand+location joins; Excel row validates lineage, never identity.
 * Unknown mappings remain unknown; dates are never inferred from first sales. */
export function mapGlovoMonthlyRows(rows: readonly GlovoRow[], locations: readonly (readonly unknown[])[],
  brands: readonly (readonly unknown[])[]): MonthlyRow[] {
  const places = new Map<string, string>();
  for (const row of records(locations, GLOVO_LOCATION_HEADERS)) {
    if (row[3] !== "Погоджено") continue;
    if (![row[0], row[2]].every(nonempty) || places.has(row[0] as string)) throw failure();
    places.set(row[0] as string, row[2] as string);
  }
  const storefronts = new Map<string, { sourceRow: number; identity: string; ownership: string }>();
  const owners = new Map<string, string>();
  for (const row of records(brands, GLOVO_BRAND_HEADERS)) {
    if (row[5] !== "Погоджено") continue;
    if (!Number.isSafeInteger(row[0]) || (row[0] as number) < 1 || !nonempty(row[1]) || !nonempty(row[2]) ||
      !["Реальний", "Віртуальний"].includes(row[3] as string) ||
      !["Власні", "Франчазі", "Франчайзі"].includes(row[4] as string)) throw failure();
    const key = JSON.stringify([row[1], row[2]]);
    const ownership = row[4] === "Власні" ? "Власні" : "Франчайзі";
    if (storefronts.has(key) || (owners.has(row[2]) && owners.get(row[2]) !== ownership)) throw failure();
    owners.set(row[2], ownership);
    storefronts.set(key, { sourceRow: row[0] as number, identity: row[3] as string, ownership });
  }
  return rows.map(row => {
    const candidate = storefronts.get(JSON.stringify([row.rawBrand, row.sourceLocation]));
    const mapping = candidate?.sourceRow === row.sourceRow ? candidate : undefined;
    const physicalLocation = places.get(row.sourceLocation) ?? null;
    return { ...row, physicalLocation, physicalId: null, openingMonth: null,
      identity: mapping?.identity ?? "UNKNOWN", ownership: mapping?.ownership ?? "UNKNOWN",
      mappingReason: physicalLocation && mapping ? "Погоджений мапінг із таблиці; дата відкриття не підтверджена."
        : "Відсутній погоджений точний мапінг або змінився рядок джерела; потрібна перевірка." };
  });
}
