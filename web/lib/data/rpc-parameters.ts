import type { ComparisonMode, PeriodMode } from "./types";
import type { DashboardFilters, GrainMode, MetricMode } from "../filters";

type SalesRpcQuery = DashboardFilters & {
  period: PeriodMode; compare: ComparisonMode; metric: MetricMode; grain: GrainMode; lfl: boolean;
};

/** Exact caller arguments only; this does not establish deployed RPC parity. */
export function overviewRpcArgs(query: SalesRpcQuery): Record<string, unknown> {
  return {
    p_channel: query.channel ?? null,
    p_order_type: query.orderType ?? null,
    p_location: query.location ?? null,
    p_brand: query.brand ?? null,
    p_ownership: query.ownership ?? null,
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
