import { snapshotDate, periodMatches, snapshotPeriodFrom, metricNumber, metricRatio, periodQuality, snapshotMetadata, coverage, type Coverage, type SnapshotMetadata } from "./digital-quality.ts";

function calendarNumber(value: unknown): number {
  const number = metricNumber(value);
  if (number === null || !Number.isInteger(number)) throw new Error("Digital calendar metadata unavailable");
  return number;
}

export type DigitalMetrics = {
  sessions: number | null;
  activeUsers: number | null;
  engagedSessions: number | null;
  engagementRate: number | null;
  addToCarts: number | null;
  checkouts: number | null;
  purchases: number | null;
  conversionRate: number | null;
  purchaseRevenue: number | null;
  averageOrderValue: number | null;
};

export type SeoMetrics = {
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type DigitalChannel = {
  channel: string;
  sessions: number | null;
  purchases: number | null;
  purchaseRevenue: number | null;
  conversionRate: number | null;
};

export type DigitalDevice = {
  device: string;
  sessions: number | null;
  purchases: number | null;
  purchaseRevenue: number | null;
  conversionRate: number | null;
};

export type DigitalLanding = {
  landingPage: string;
  sessions: number | null;
  purchases: number | null;
  purchaseRevenue: number | null;
  conversionRate: number | null;
};

export type DigitalSeoItem = {
  name: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

export type DigitalTrendRow = {
  date: string;
  sessions: number | null;
  purchases: number | null;
  revenue: number | null;
  clicks: number | null;
  impressions: number | null;
};

export type DigitalData = {
  meta: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    ga4Latest: string;
    searchLatest: string;
    ga4Rows: number | null;
    searchRows: number | null;
  };
  quality: ReturnType<typeof periodQuality>;
  sources: { ga4: ReturnType<typeof periodQuality>; searchConsole: ReturnType<typeof periodQuality>; channels: ReturnType<typeof periodQuality>; devices: ReturnType<typeof periodQuality> };
  snapshots: { landingPages: SnapshotMetadata; seoQueries: SnapshotMetadata; seoPages: SnapshotMetadata };
  current: DigitalMetrics;
  previous: DigitalMetrics;
  seo: SeoMetrics;
  previousSeo: SeoMetrics;
  trend: DigitalTrendRow[];
  channels: DigitalChannel[];
  devices: DigitalDevice[];
  landingPages: DigitalLanding[];
  seoQueries: DigitalSeoItem[];
  seoPages: DigitalSeoItem[];
};

export type DigitalMonthlyRow = {
  year: number;
  month: number;
  sessions: number | null;
  purchases: number | null;
  revenue: number | null;
  conversionRate: number | null;
  averageOrderValue: number | null;
  seoClicks: number | null;
  seoImpressions: number | null;
  seoCtr: number | null;
  seoPosition: number | null;
  partial: boolean | null;
};

export type DigitalSourceQuality = {
  from?: string;
  to?: string;
  coverage: Coverage;
  rowLimit: number | null;
  rows: number | null;
  last7Sessions?: number | null;
  last7Purchases?: number | null;
};

export type DigitalHistory = {
  meta: {
    currentYear: number;
    commonLatest: string;
    cutoffMonth: number;
    cutoffDay: number;
  };
  monthly: DigitalMonthlyRow[];
  quality: {
    commonLatest: string;
    ga4: DigitalSourceQuality;
    searchConsole: DigitalSourceQuality;
    channels: DigitalSourceQuality;
    devices: DigitalSourceQuality;
    landingSnapshot: DigitalSourceQuality;
    querySnapshot: DigitalSourceQuality;
    pageSnapshot: DigitalSourceQuality;
  };
};

type Raw = Record<string, any>;

function metrics(raw: Raw | undefined): DigitalMetrics {
  return {
    sessions: metricNumber(raw?.sessions),
    activeUsers: null,
    engagedSessions: metricNumber(raw?.engagedSessions),
    engagementRate: metricRatio(raw?.engagedSessions, raw?.sessions),
    addToCarts: metricNumber(raw?.addToCarts),
    checkouts: metricNumber(raw?.checkouts),
    purchases: metricNumber(raw?.purchases),
    conversionRate: metricRatio(raw?.purchases, raw?.sessions),
    purchaseRevenue: metricNumber(raw?.purchaseRevenue),
    averageOrderValue: metricRatio(raw?.purchaseRevenue, raw?.purchases)
  };
}

function seo(raw: Raw | undefined): SeoMetrics {
  return {
    clicks: metricNumber(raw?.clicks),
    impressions: metricNumber(raw?.impressions),
    ctr: metricRatio(raw?.clicks, raw?.impressions),
    position: metricNumber(raw?.impressions) === 0 ? null : metricNumber(raw?.position)
  };
}

export function normalizeDigital(raw: Raw): DigitalData {
  const ga4Empty = metricNumber(raw?.meta?.ga4Rows) === 0;
  const searchEmpty = metricNumber(raw?.meta?.searchRows) === 0;
  const inSource = (date: string, source: "ga4" | "search") => {
    const from = raw?.meta?.[`${source}From`];
    const to = raw?.meta?.[`${source}Latest`];
    return !(from && date < from) && !(to && date > to);
  };
  const snapshotPeriod = snapshotMetadata(raw?.meta, 0, 0).to !== null;
  const emptyPeriod = (source: "ga4" | "search", period: "current" | "previous") => {
    const from = raw?.meta?.[period === "current" ? "from" : "previousFrom"];
    const to = raw?.meta?.[period === "current" ? "to" : "previousTo"];
    const first = raw?.meta?.[`${source}From`];
    const latest = raw?.meta?.[`${source}Latest`];
    const rows = raw?.meta?.[`${period}${source === "ga4" ? "Ga4" : "Search"}Rows`];
    return (source === "ga4" ? ga4Empty : searchEmpty) || rows === 0 ||
      Boolean(latest && from && from > latest) || Boolean(first && to && to < first);
  };
  return {
    meta: {
      from: String(raw?.meta?.from ?? ""),
      to: String(raw?.meta?.to ?? ""),
      previousFrom: String(raw?.meta?.previousFrom ?? ""),
      previousTo: String(raw?.meta?.previousTo ?? ""),
      ga4Latest: String(raw?.meta?.ga4Latest ?? ""),
      searchLatest: String(raw?.meta?.searchLatest ?? ""),
      ga4Rows: metricNumber(raw?.meta?.ga4Rows),
      searchRows: metricNumber(raw?.meta?.searchRows)
    },
    quality: periodQuality(raw?.meta),
    sources: {
      ga4: periodQuality(raw?.meta?.sources?.ga4),
      searchConsole: periodQuality(raw?.meta?.sources?.searchConsole),
      channels: periodQuality(raw?.meta?.sources?.channels),
      devices: periodQuality(raw?.meta?.sources?.devices)
    },
    snapshots: {
      landingPages: snapshotMetadata(raw?.meta, 30, raw?.landingPages?.length ?? 0),
      seoQueries: snapshotMetadata(raw?.meta, 40, raw?.seoQueries?.length ?? 0),
      seoPages: snapshotMetadata(raw?.meta, 30, raw?.seoPages?.length ?? 0)
    },
    current: metrics(emptyPeriod("ga4", "current") ? undefined : raw?.current),
    previous: metrics(emptyPeriod("ga4", "previous") ? undefined : raw?.previous),
    seo: seo(emptyPeriod("search", "current") ? undefined : raw?.seo),
    previousSeo: seo(emptyPeriod("search", "previous") ? undefined : raw?.previousSeo),
    trend: (raw?.trend ?? []).map((row: Raw) => ({
      date: String(row.date ?? ""),
      sessions: ga4Empty || !inSource(String(row.date ?? ""), "ga4") ? null : metricNumber(row.sessions),
      purchases: ga4Empty || !inSource(String(row.date ?? ""), "ga4") ? null : metricNumber(row.purchases),
      revenue: ga4Empty || !inSource(String(row.date ?? ""), "ga4") ? null : metricNumber(row.revenue),
      clicks: searchEmpty || !inSource(String(row.date ?? ""), "search") ? null : metricNumber(row.clicks),
      impressions: searchEmpty || !inSource(String(row.date ?? ""), "search") ? null : metricNumber(row.impressions)
    })),
    channels: (raw?.channels ?? []).map((row: Raw) => ({
      channel: String(row.channel ?? "—"),
      sessions: metricNumber(row.sessions),
      purchases: metricNumber(row.purchases),
      purchaseRevenue: metricNumber(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    devices: (raw?.devices ?? []).map((row: Raw) => ({
      device: String(row.device ?? "—"),
      sessions: metricNumber(row.sessions),
      purchases: metricNumber(row.purchases),
      purchaseRevenue: metricNumber(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    landingPages: (snapshotPeriod ? raw?.landingPages ?? [] : []).map((row: Raw) => ({
      landingPage: String(row.landing_page ?? "—"),
      sessions: metricNumber(row.sessions),
      purchases: metricNumber(row.purchases),
      purchaseRevenue: metricNumber(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    seoQueries: (snapshotPeriod ? raw?.seoQueries ?? [] : []).map((row: Raw) => ({
      name: String(row.query ?? "—"),
      clicks: metricNumber(row.clicks),
      impressions: metricNumber(row.impressions),
      ctr: metricRatio(row.clicks, row.impressions),
      position: metricNumber(row.impressions) === 0 ? null : metricNumber(row.position)
    })),
    seoPages: (snapshotPeriod ? raw?.seoPages ?? [] : []).map((row: Raw) => ({
      name: String(row.page ?? "—"),
      clicks: metricNumber(row.clicks),
      impressions: metricNumber(row.impressions),
      ctr: metricRatio(row.clicks, row.impressions),
      position: metricNumber(row.impressions) === 0 ? null : metricNumber(row.position)
    }))
  };
}

function sourceQuality(raw: Raw | undefined): DigitalSourceQuality {
  return {
    from: raw?.from ? String(raw.from) : undefined,
    to: raw?.to ? String(raw.to) : undefined,
    coverage: coverage(raw?.coverage),
    rowLimit: metricNumber(raw?.rowLimit),
    rows: metricNumber(raw?.rows),
    last7Sessions: metricNumber(raw?.rows) === 0 ? null : metricNumber(raw?.last7Sessions),
    last7Purchases: metricNumber(raw?.rows) === 0 ? null : metricNumber(raw?.last7Purchases)
  };
}

export function normalizeHistory(raw: Raw): DigitalHistory {
  return {
    meta: {
      currentYear: calendarNumber(raw?.meta?.currentYear),
      commonLatest: String(raw?.meta?.commonLatest ?? ""),
      cutoffMonth: calendarNumber(raw?.meta?.cutoffMonth),
      cutoffDay: calendarNumber(raw?.meta?.cutoffDay)
    },
    monthly: (raw?.monthly ?? []).map((row: Raw) => ({
      year: calendarNumber(row.year),
      month: calendarNumber(row.month),
      sessions: metricNumber(row.sessions),
      purchases: metricNumber(row.purchases),
      revenue: metricNumber(row.revenue),
      conversionRate: metricRatio(row.purchases,row.sessions),
      averageOrderValue: metricRatio(row.revenue,row.purchases),
      seoClicks: metricNumber(row.seoClicks),
      seoImpressions: metricNumber(row.seoImpressions),
      seoCtr: metricRatio(row.seoClicks,row.seoImpressions),
      seoPosition: metricNumber(row.seoPosition),
      partial: typeof row.partial === "boolean" ? row.partial : null
    })),
    quality: {
      commonLatest: String(raw?.quality?.commonLatest ?? ""),
      ga4: sourceQuality(raw?.quality?.ga4),
      searchConsole: sourceQuality(raw?.quality?.searchConsole),
      channels: sourceQuality(raw?.quality?.channels),
      devices: sourceQuality(raw?.quality?.devices),
      landingSnapshot: sourceQuality(raw?.quality?.landingSnapshot),
      querySnapshot: sourceQuality(raw?.quality?.querySnapshot),
      pageSnapshot: sourceQuality(raw?.quality?.pageSnapshot)
    }
  };
}


/** The legacy RPC selects snapshots by exact period_end. Query each known
 * eligible snapshot date explicitly, without relabeling it as current daily data. */
export async function selectSeoSnapshots(data: DigitalData, history: DigitalHistory, read: (range: { from: string; to: string }) => Promise<DigitalData>) {
  const queryDate = snapshotDate(history.quality.querySnapshot.to, data.meta.to);
  const pageDate = snapshotDate(history.quality.pageSnapshot.to, data.meta.to);
  const dates = [...new Set([queryDate, pageDate].filter((d): d is string => d !== null))];
  const periods = await Promise.all(dates.map(async to => {
    const expectedFrom = snapshotPeriodFrom(to);
    if (periodMatches(data.meta, expectedFrom, to)) return [to, data] as const;
    const loaded = await read({ from: expectedFrom, to });
    return [to, periodMatches(loaded.meta, expectedFrom, to) ? loaded : null] as const;
  }));
  const byDate = new Map(periods);
  return {
    queryDate: queryDate && byDate.get(queryDate)?.seoQueries.length ? queryDate : null,
    pageDate: pageDate && byDate.get(pageDate)?.seoPages.length ? pageDate : null,
    queries: queryDate ? byDate.get(queryDate)?.seoQueries ?? [] : [],
    pages: pageDate ? byDate.get(pageDate)?.seoPages ?? [] : [],
    queryPeriodCtr: queryDate ? byDate.get(queryDate)?.seo.ctr ?? null : null
  };
}
