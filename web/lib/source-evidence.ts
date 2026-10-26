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

export const SOURCE_WINDOW_LIMITATIONS = "Повнота UNKNOWN · свіжість джерела UNKNOWN. Порівняння Ads/Local за вибраним періодом GA4/GSC недоступне.";

function sourceDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Window boundaries alone prove neither observed-date coverage nor freshness. */
export function sourceWindow(source: {from?: unknown; to?: unknown}, selected: {from: string; to: string}) {
  const from = sourceDate(source.from), to = sourceDate(source.to);
  const selectedFrom = sourceDate(selected.from), selectedTo = sourceDate(selected.to);
  const known = from !== null && to !== null && from <= to &&
    selectedFrom !== null && selectedTo !== null && selectedFrom <= selectedTo;
  const matchesSelected = known ? from === selectedFrom && to === selectedTo : null;
  return {
    period: `${from ?? "UNKNOWN"} → ${to ?? "UNKNOWN"}`,
    matchesSelected,
    relationship: matchesSelected === null ? "Збіг меж із вибраним періодом GA4/GSC UNKNOWN." :
      matchesSelected ? "Обидві межі збігаються з вибраним періодом GA4/GSC; upstream покриття не підтверджено." :
        "Межі відрізняються від вибраного періоду GA4/GSC."
  };
}
