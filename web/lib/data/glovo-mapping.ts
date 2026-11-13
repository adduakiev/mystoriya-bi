import type { GlovoContract, GlovoRow } from "./glovo-contract";

export const GLOVO_SITE_HEADERS = ["Заклад у джерелі", "Адреси з джерела", "Заклад головного борду", "Погодження", "Коментар"] as const;
export const GLOVO_BRAND_HEADERS = ["Рядок Excel", "Бренд у джерелі", "Заклад у джерелі", "Тип бренду", "Власність", "Погодження", "Коментар"] as const;
const sites: Record<string, string> = {"Ахматова NEW": "Ахматова", "Оболонь NEW": "Оболонь", "Теремки NEW": "Теремки", "Парк Авеню NEW": "Парк Авеню", "София new": "Софія"};
const identities: Record<string, GlovoRow["identity"]> = {"Реальний": "PHYSICAL", "Фізичний": "PHYSICAL", "Віртуальний": "VIRTUAL"};
const ownerships: Record<string, GlovoRow["ownership"]> = {"Власні": "OWNED", "Власний": "OWNED", "Франчазі": "FRANCHISE", "Франшиза": "FRANCHISE", "Партнерський": "PARTNER"};
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const fail = () => { throw new Error("GLOVO_MAPPING_INVALID"); };
function dictionary(values: readonly (readonly unknown[])[], headers: readonly string[], key: (row: readonly unknown[]) => string, approval: number, numericIndex = -1) {
  if (values[0]?.length !== headers.length || headers.some((h, i) => values[0][i] !== h)) fail();
  const map = new Map<string, readonly unknown[]>();
  for (const row of values.slice(1)) {
    if (row.every(v => v === "" || v === null || v === undefined)) continue;
    if (row.length > headers.length || row.some((v, i) => v !== null && v !== undefined && (i === numericIndex ? typeof v !== "number" && v !== "" : typeof v !== "string")) ||
      !["", "Очікує", "Погоджено"].includes((row[approval] ?? "") as string)) fail();
    const id = key(row);
    if (map.has(id)) fail();
    map.set(id, row);
  }
  return map;
}
/** Exact raw brand × source site keys; Excel row never supplies identity. Atomic validation precedes application. */
export function applyGlovoMappings(contract: GlovoContract, siteValues: readonly (readonly unknown[])[], brandValues: readonly (readonly unknown[])[]): GlovoContract {
  if (contract.status !== "valid") fail();
  const siteMap = dictionary(siteValues, GLOVO_SITE_HEADERS, row => {
    if (!text(row[0])) fail();
    return row[0] as string;
  }, 3);
  const brandMap = dictionary(brandValues, GLOVO_BRAND_HEADERS, row => {
    if (!text(row[1]) || !text(row[2]) || !Number.isSafeInteger(row[0]) || (row[0] as number) < 1) fail();
    return JSON.stringify([row[1], row[2]]);
  }, 5, 0);
  for (const row of siteMap.values()) if (row[3] === "Погоджено" && (!text(row[1]) || !text(row[2]))) fail();
  for (const row of brandMap.values()) if (row[5] === "Погоджено" &&
    (!Object.hasOwn(identities, row[3] as string) || !Object.hasOwn(ownerships, row[4] as string))) fail();
  return {...contract, rows: contract.rows.map(row => {
    const site = siteMap.get(row.sourceLocation);
    const brand = brandMap.get(JSON.stringify([row.rawBrand, row.sourceLocation]));
    const siteApproved = site?.[3] === "Погоджено", brandApproved = brand?.[5] === "Погоджено";
    return {...row,
      normalizedGroup: row.normalizedGroup ?? (brandApproved ? row.rawBrand : null),
      physicalLocation: siteApproved ? (Object.hasOwn(sites, site![2] as string) ? sites[site![2] as string] : site![2] as string) : null,
      identity: brandApproved ? identities[brand![3] as string] : "UNKNOWN",
      ownership: brandApproved ? ownerships[brand![4] as string] : "UNKNOWN",
      mappingReason: `${row.normalizedGroup ? "Погоджена група МітБар" : brandApproved ? "Група = точна назва погодженого бренду" : "Група UNKNOWN / needs mapping"}; Заклад: ${siteApproved ? `Погоджено → ${site![2]}; ${site![4] ?? ""}` : "UNKNOWN / needs mapping"}; Бренд × заклад: ${brandApproved ? `Погоджено; Excel ${brand![0]}; ${brand![6] ?? ""}` : "UNKNOWN / needs mapping"}`
    };
  })};
}
