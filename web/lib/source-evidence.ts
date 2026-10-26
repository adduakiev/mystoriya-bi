import { formatMetric, metricNumber } from "./digital-quality.ts";

type Raw = Record<string, unknown>;
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));
export type CurrencyEvidence = { currency: string | null; currencyStatus: "SINGLE" | "MULTI" | "UNKNOWN" };

/** Never infer a currency from locale, campaign name or another source. */
export function currencyEvidence(raw: Raw): CurrencyEvidence {
  const values = [...[raw.currency, raw.account_currency, raw.currency_code].filter(v => v != null),
    ...(Array.isArray(raw.currencies) ? raw.currencies : [])];
  const valid = values.filter((v): v is string => typeof v === "string" && supportedCurrencies.has(v) && !["XXX", "XTS"].includes(v));
  const currencies = new Set(valid);
  if (currencies.size > 1) return { currency: null, currencyStatus: "MULTI" };
  if (!values.length || valid.length !== values.length) return { currency: null, currencyStatus: "UNKNOWN" };
  return { currency: valid[0], currencyStatus: "SINGLE" };
}

export function sourceMoney(value: unknown, evidence?: CurrencyEvidence): string {
  if (metricNumber(value) === null) return "—";
  if (evidence?.currencyStatus !== "SINGLE" || !evidence.currency)
    return evidence?.currencyStatus === "MULTI" ? "— · currencies MULTI" : "— · currency UNKNOWN";
  return `${evidence.currency} ${formatMetric(value)}`;
}

/** Presence proves neither freshness, field completeness nor upstream parity. */
export function presenceStatus(rows: unknown): "PARTIAL" | "WAITING" | "UNKNOWN" {
  const count = metricNumber(rows);
  return count === null || count < 0 ? "UNKNOWN" : count > 0 ? "PARTIAL" : "WAITING";
}
