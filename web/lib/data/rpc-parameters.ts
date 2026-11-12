import type { ComparisonMode, PeriodMode } from "./types";
import type { DashboardFilters, GrainMode, MetricMode } from "../filters";

type SalesRpcQuery = DashboardFilters & {
  period: PeriodMode; compare: ComparisonMode; metric: MetricMode; grain: GrainMode; lfl: boolean;
};

// HTML selects submit "" for “all”. SQL treats only NULL as an absent filter.
// Preserve a selected dimension verbatim; whitespace-only values are also absent.
export function optionalSalesDimension(value: string | undefined): string | null {
  return value?.trim() ? value : null;
}

/** Exact caller arguments only; this does not establish deployed RPC parity. */
export function overviewRpcArgs(query: SalesRpcQuery): Record<string, unknown> {
  return {
    p_channel: optionalSalesDimension(query.channel),
    p_order_type: optionalSalesDimension(query.orderType),
    p_location: optionalSalesDimension(query.location),
    p_brand: optionalSalesDimension(query.brand),
    p_ownership: optionalSalesDimension(query.ownership),
    p_focus_year: query.year ?? null,
    p_focus_month: query.month ?? null,
    p_period: query.period,
    p_comparison: query.compare,
    p_metric: query.metric,
    p_grain: query.grain,
    p_lfl: query.lfl
  };
}

/** Absent dates preserve the RPC default; no dates are invented for independent sources. */
export function digitalPeriodRpcArgs(from: string, to: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (from) args.p_from = from;
  if (to) args.p_to = to;
  return args;
}
