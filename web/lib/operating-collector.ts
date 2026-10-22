import { validateInput, type Evidence, type InputPacket } from "./operating-core.ts";
import { normalizeDigital } from "./digital-contract.ts";
import { normalizeAds } from "./digital-source-contract.ts";
import { metricNumber } from "./digital-quality.ts";

type Raw = Record<string, any>;
export type RpcReader = (name: string) => Promise<unknown>;
const ALLOWED = ["bi_digital_payload", "bi_digital_history_payload", "bi_digital_ads_payload"] as const;
/** Only this allowlist is fetched. Only fixed aggregate fields below leave the collector. */
export async function collectInput(read: RpcReader, now = new Date().toISOString()): Promise<InputPacket> {
  const values = await Promise.all(ALLOWED.map(async name => {
    try {
      const value = await read(name);
      return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : null;
    } catch { return null; } // Failure becomes explicit missing evidence, never fabricated zero.
  }));
  const [digital, history, ads] = values;
  const normalized = normalizeDigital({ meta: digital?.meta, current: digital?.current, previous: digital?.previous, seo: digital?.seo, previousSeo: digital?.previousSeo });
  const normalizedAds = normalizeAds({ meta: ads?.meta, summary: ads?.summary });
  const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const make = (partial: Partial<Evidence> & Pick<Evidence,"id"|"source"|"domain"|"label"|"unit">): Evidence => ({
    source_date: null, observed_at: null, fetched_at: now, period_from: null, period_to: null,
    value: null, previous: null, target: null, forecast: null, direction: "higher",
    source_status: "UNKNOWN", coverage: "UNKNOWN", confidence: 0, freshness_sla_days: 2,
    expected_dates: null, observed_dates: null, duplicate_rows: null, attribution: "none", ...partial
  });
  const packet: InputPacket = { version: 2, as_of: now, evidence: [
    make({ id: "ga4.sessions", source: "GA4", domain: "seo", label: "Сесії GA4", unit: "sessions",
      source_date: date(digital?.meta?.ga4Latest), period_from: date(digital?.meta?.from), period_to: date(digital?.meta?.to),
      value: normalized.current.sessions, previous: normalized.previous.sessions,
      source_status: digital ? "AVAILABLE" : "BROKEN", coverage: "UNKNOWN", confidence: 0.6, attribution: "analytics" }),
    make({ id: "ga4.purchases", source: "GA4", domain: "sales", label: "Події purchase GA4", unit: "events",
      source_date: date(digital?.meta?.ga4Latest), period_from: date(digital?.meta?.from), period_to: date(digital?.meta?.to),
      value: normalized.current.purchases, previous: normalized.previous.purchases,
      source_status: digital ? "AVAILABLE" : "BROKEN", confidence: 0.6, attribution: "analytics" }),
    make({ id: "gsc.clicks", source: "GSC", domain: "seo", label: "Кліки органічного пошуку", unit: "clicks",
      source_date: date(digital?.meta?.searchLatest), period_from: date(digital?.meta?.from), period_to: date(digital?.meta?.to),
      value: normalized.seo.clicks, previous: normalized.previousSeo.clicks,
      source_status: digital ? "AVAILABLE" : "BROKEN", confidence: 0.6, freshness_sla_days: 3 }),
    make({ id: "ads.spend", source: "Google Ads", domain: "ads", label: "Витрати Google Ads", unit: "currency-unconfirmed",
      source_date: date(ads?.meta?.to), period_from: date(ads?.meta?.from), period_to: date(ads?.meta?.to),
      value: ads?.meta?.available === true ? normalizedAds.summary.cost : null,
      direction: "neutral", source_status: ads?.meta?.available === true ? "AVAILABLE" : "UNKNOWN",
      confidence: 0.5, attribution: "platform" }),
    make({ id: "ux.device_rows", source: "GA4 devices", domain: "ux", label: "Рядки історії пристроїв", unit: "rows",
      source_date: date(history?.quality?.devices?.to), period_from: date(history?.quality?.devices?.from),
      period_to: date(history?.quality?.devices?.to), value: metricNumber(history?.quality?.devices?.rows),
      direction: "neutral", source_status: history ? "AVAILABLE" : "BROKEN", confidence: 0.5 }),
    make({ id: "backend.net_revenue", source: "SYRVE/backend", domain: "sales",
      label: "Фактична net revenue", unit: "currency-unconfirmed", direction: "neutral" })
  ] };
  validateInput(packet);
  return packet;
}
