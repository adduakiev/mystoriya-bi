import { analyzeGlovo } from "./glovo-analytics";
import type { GlovoReport } from "./glovo-contract";
/** D294 references are assertions only, never substitutes for observed metrics. */
export function glovoReferenceParity(source: GlovoReport) {
  const result = analyzeGlovo(source, {month: "", brand: "", group: "", location: "", mapping: "", sort: "source"});
  const observed = [result.selected.metrics.purchaseSum, result.selected.metrics.deliveredOrders,
    result.averageTicket, result.virtualShare, result.latest?.absolute ?? null, result.latest?.percent ?? null];
  const references = [25887779.33, 25533, 1013.89, 39.94, 263043.95, 7.35];
  return {period: "2026-01..2026-10", completeness: result.selected.coverage,
    assertions: ["Сума покупок, UAH", "Доставлені замовлення", "Зважений чек, UAH", "Віртуальна частка суми, %", "Останній COMPLETE MoM, UAH", "Останній COMPLETE MoM, %"].map((metric, i) => ({
      metric, expected: references[i], observed: observed[i], delta: observed[i] === null ? null : observed[i]! - references[i],
      status: observed[i] === null || result.selected.coverage !== "COMPLETE" ? "UNVERIFIED" as const
        : Math.abs(observed[i]! - references[i]) <= (i === 1 ? 0 : 0.005001) ? "MATCH" as const : "DELTA" as const
    }))};
}
