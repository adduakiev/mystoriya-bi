import { metricNumber } from "../digital-quality.ts";

type Raw = Record<string, any>;
type Metric = number | null;
export type DigitalMerchantData = {
  meta: { status: string; performanceFrom: string; performanceTo: string;
    performanceRows: Metric; catalogRows: Metric; healthRows: Metric };
  performance: { impressions: Metric; clicks: Metric; conversions: Metric; ctr: Metric; products: Metric };
  topProducts: Array<{ productId: string; productTitle: string;
    impressions: Metric; clicks: Metric; conversions: Metric; ctr: Metric }>;
  catalog: { rows: Metric; inStock: Metric; outOfStock: Metric; withPrice: Metric };
  health: Array<{ snapshotDate: string; country: string; reportingContext: string;
    activeCount: Metric; disapprovedCount: Metric; pendingCount: Metric; expiringCount: Metric }>;
};

function rowCount(value: unknown): Metric {
  const count = metricNumber(value);
  return count !== null && Number.isInteger(count) && count >= 0 ? count : null;
}

/** A missing count does not confirm an empty source; rows do not prove completeness. */
export function merchantPresence(meta: DigitalMerchantData["meta"]): "PARTIAL" | "WAITING" | "UNKNOWN" {
  const counts = [meta.performanceRows, meta.catalogRows, meta.healthRows];
  if (counts.some(count => count !== null && count > 0)) return "PARTIAL";
  return counts.every(count => count === 0) ? "WAITING" : "UNKNOWN";
}

/** Field missingness survives even with positive row counts. SQL-erased nulls
 * cannot be recovered here; D04 remains open for the stored/RPC contract. */
export function normalizeMerchant(raw: Raw): DigitalMerchantData {
  const m = raw?.meta ?? {}, p = raw?.performance ?? {}, c = raw?.catalog ?? {};
  return {
    meta: { status: String(m.status ?? ""), performanceFrom: String(m.performanceFrom ?? ""),
      performanceTo: String(m.performanceTo ?? ""), performanceRows: rowCount(m.performanceRows),
      catalogRows: rowCount(m.catalogRows), healthRows: rowCount(m.healthRows) },
    performance: { impressions: metricNumber(p.impressions), clicks: metricNumber(p.clicks),
      conversions: metricNumber(p.conversions), ctr: metricNumber(p.ctr), products: metricNumber(p.products) },
    topProducts: (raw?.topProducts ?? []).map((x: Raw) => ({
      productId: String(x.product_id ?? ""), productTitle: String(x.product_title ?? "—"),
      impressions: metricNumber(x.impressions), clicks: metricNumber(x.clicks),
      conversions: metricNumber(x.conversions), ctr: metricNumber(x.ctr) })),
    catalog: { rows: rowCount(c.rows), inStock: metricNumber(c.inStock),
      outOfStock: metricNumber(c.outOfStock), withPrice: metricNumber(c.withPrice) },
    health: (raw?.health ?? []).map((x: Raw) => ({
      snapshotDate: String(x.snapshot_date ?? ""), country: String(x.country ?? ""),
      reportingContext: String(x.reporting_context ?? ""), activeCount: metricNumber(x.active_count),
      disapprovedCount: metricNumber(x.disapproved_count), pendingCount: metricNumber(x.pending_count),
      expiringCount: metricNumber(x.expiring_count) }))
  };
}
