import { formatMetric } from "./digital-quality.ts";
import { sourceMoney, type CurrencyEvidence } from "./source-evidence.ts";

export type AdsTrendMetric = "cost" | "conversionValue" | "clicks" | "conversions";

/** Axis and tooltip share the same currency guard as App campaign money.
 * The current Google Ads RPC has no currency evidence, so callers omit it.
 */
export function formatAdsTrend(value: unknown, metric: AdsTrendMetric, evidence?: CurrencyEvidence): string {
  return metric === "cost" || metric === "conversionValue"
    ? sourceMoney(value, evidence) : formatMetric(value, 1);
}

type Campaign = { cost: number | null; conversions: number | null; conversionValue: number | null; roas: number | null };

/** Count-only observation: no currency-dependent minimum or monetary sum. */
export function hasSpendWithoutConversions(row: Pick<Campaign, "cost" | "conversions">): boolean {
  return row.cost !== null && row.cost > 0 && row.conversions === 0;
}

export function adsCampaignSignal(row: Campaign) {
  if (hasSpendWithoutConversions(row)) return { label: "Витрати · 0 conversions", cls: "" };
  if (row.conversions !== null && row.conversions > 0 && row.conversionValue === 0)
    return { label: "Value = 0", cls: "" };
  if (row.roas === null) return { label: "ROAS не визначено", cls: "" };
  if (row.roas > 0 && row.roas < 1) return { label: "Value нижче spend", cls: "negative" };
  return { label: "Перевірити", cls: "" };
}
