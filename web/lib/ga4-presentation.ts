import { sourceMoney } from "./source-evidence.ts";

/** Current GA4 contracts contain no verified reporting currency/property/account
 * or monetary grain provenance. Keep this closed until a reviewed source
 * contract supplies that evidence; a locale or arbitrary currency label cannot.
 * Numeric source values remain untouched in the data adapters.
 */
export function ga4Money(value: unknown): string {
  return sourceMoney(value);
}

export const GA4_MONEY_NOTICE = "GA4 · currency UNKNOWN. Грошові суми, AOV, їх порівняння та revenue-тренд приховано: валюту звітності, property/account і grain джерела не підтверджено. Сесії, покупки та негрошові показники доступні окремо.";
