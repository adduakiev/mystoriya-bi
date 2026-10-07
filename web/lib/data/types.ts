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
  month: string;
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

export type DashboardSnapshot = {
  sourceRows: number;
  cutoffDate: string;
  currentYear: number;
  previousYear: number;
  current: MetricSet;
  previous: MetricSet;
  kpis: Kpi[];
  trend: TrendPoint[];
  channels: ChannelSummary[];
  locations: LocationSummary[];
  signal: {
    title: string;
    body: string;
    severity: "info" | "warning";
  };
};
