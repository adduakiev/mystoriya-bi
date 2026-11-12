export type SalesRow = {
  date: string;
  location: string;
  brand: string;
  ownership: string;
  channelGroup: string;
  orderType: string;
  revenue: number;
  checks: number;
  markup: number;
};

export type PeriodMode = "ytd" | "month" | "week";
export type ComparisonMode = "ly" | "previous";

export type MetricSet = {
  revenue: number;
  checks: number;
  averageCheck: number;
  markup: number;
  markupRate: number;
};

export type Kpi = {
  label: string;
  value: string;
  delta: number | null;
  deltaLabel: string;
  direction: "up" | "down" | "flat";
};

export type TrendPoint = {
  label: string;
  current: number;
  previous: number;
};

export type ChannelSummary = {
  name: string;
  share: number;
  revenue: number;
  checks: number;
  averageCheck: number;
  markupRate: number;
};

export type LocationSummary = {
  name: string;
  revenue: number;
  growth: number | null;
  share: number;
};

export type MonthlyManagementRow = {
  month: number;
  label: string;
  revenue: number | null;
  revenueGrowth: number | null;
  checks: number | null;
  checksGrowth: number | null;
  averageCheck: number | null;
  markupRate: number | null;
  venueShare: number | null;
  aggregatorShare: number | null;
  deliveryShare: number | null;
  currentObservationCount?: number | null;
  previousObservationCount?: number | null;
  isPartial: boolean;
};

export type DashboardSnapshot = {
  sourceRows: number;
  cutoffDate: string;
  currentYear: number;
  previousYear: number;
  period: PeriodMode;
  comparison: ComparisonMode;
  periodLabel: string;
  comparisonLabel: string;
  current: MetricSet;
  previous: MetricSet;
  kpis: Kpi[];
  trend: TrendPoint[];
  channels: ChannelSummary[];
  locations: LocationSummary[];
  monthlyTable: MonthlyManagementRow[];
  signal: {
    title: string;
    body: string;
    severity: "info" | "warning";
  };
};
