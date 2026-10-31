import { metricRatio } from "./digital-quality.ts";
import { currencyEvidence, type CurrencyEvidence } from "./source-evidence.ts";

type MoneyIdentity = CurrencyEvidence & { accountId: string | null };
export type AdsRoasEvidence = { spend: MoneyIdentity; value: MoneyIdentity };

/** Evidence must describe both operands at the same grain. A source label or
 * locale is insufficient. The current Google Ads RPC supplies no such contract;
 * production callers deliberately omit evidence and receive null.
 */
export function verifiedAdsRoas(value: unknown, spend: unknown, evidence?: AdsRoasEvidence): number | null {
  if (!evidence) return null;
  const a = evidence.spend, b = evidence.value;
  if (typeof a.accountId !== "string" || !a.accountId.trim() || a.accountId !== b.accountId
    || a.currencyStatus !== "SINGLE" || b.currencyStatus !== "SINGLE"
    || currencyEvidence({currency: a.currency}).currencyStatus !== "SINGLE"
    || a.currency !== b.currency) return null;
  return metricRatio(value, spend);
}
