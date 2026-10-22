import { metricNumber, metricRatio, sourceCoverage, periodHasRows, snapshotPeriod, snapshotDate } from "../digital-quality.ts";

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
    coverage: ReturnType<typeof sourceCoverage>;
    snapshots: {landing: ReturnType<typeof snapshotPeriod>; queries: ReturnType<typeof snapshotPeriod>; pages: ReturnType<typeof snapshotPeriod>};
    limitations: string[];
    searchRows: number | null;
  };
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
  coverage: ReturnType<typeof sourceCoverage>;
  rowScope: "ALL_STORED_ROWS";
  from?: string;
  to?: string;
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

const num = metricNumber;
const nullableNum = metricNumber;
function calendar(value: unknown): number {
  const parsed = metricNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) throw new Error("Digital calendar metadata unavailable");
  return parsed;
}

function metrics(raw: Raw | undefined): DigitalMetrics {
  return {
    sessions: num(raw?.sessions),
    activeUsers: null,
    engagedSessions: num(raw?.engagedSessions),
    engagementRate: metricRatio(raw?.engagedSessions, raw?.sessions),
    addToCarts: num(raw?.addToCarts),
    checkouts: num(raw?.checkouts),
    purchases: num(raw?.purchases),
    conversionRate: metricRatio(raw?.purchases, raw?.sessions),
    purchaseRevenue: num(raw?.purchaseRevenue),
    averageOrderValue: metricRatio(raw?.purchaseRevenue, raw?.purchases)
  };
}

function seo(raw: Raw | undefined): SeoMetrics {
  return {
    clicks: num(raw?.clicks),
    impressions: num(raw?.impressions),
    ctr: metricRatio(raw?.clicks, raw?.impressions),
    position: metricNumber(raw?.impressions) !== null && Number(raw?.impressions) > 0 ? num(raw?.position) : null
  };
}

export function normalizeDigital(raw: Raw): DigitalData {
  return {
    meta: {
      from: String(raw?.meta?.from ?? ""),
      to: String(raw?.meta?.to ?? ""),
      previousFrom: String(raw?.meta?.previousFrom ?? ""),
      previousTo: String(raw?.meta?.previousTo ?? ""),
      ga4Latest: String(raw?.meta?.ga4Latest ?? ""),
      searchLatest: String(raw?.meta?.searchLatest ?? ""),
      coverage: sourceCoverage(raw?.meta?.coverage),
      snapshots: {landing: snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 30), queries: snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 40), pages: snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 30)},
      limitations: ["Legacy totals/rows do not prove period coverage; stored default zeroes cannot be recovered.", "Period-unique active users unavailable; trend all-zero rows need source presence flags.", "Snapshot completeness and upstream row limits unknown; no atomic snapshot across RPC calls."],
      ga4Rows: num(raw?.meta?.ga4Rows),
      searchRows: num(raw?.meta?.searchRows)
    },
    current: metrics(periodHasRows(raw?.meta?.currentGa4Rows, raw?.current) ? raw?.current : undefined),
    previous: metrics(periodHasRows(raw?.meta?.previousGa4Rows, raw?.previous) ? raw?.previous : undefined),
    seo: seo(periodHasRows(raw?.meta?.currentSearchRows, raw?.seo) ? raw?.seo : undefined),
    previousSeo: seo(periodHasRows(raw?.meta?.previousSearchRows, raw?.previousSeo) ? raw?.previousSeo : undefined),
    trend: (raw?.trend ?? []).map((row: Raw) => {
      const ga4 = periodHasRows(row.ga4Present === true ? 1 : row.ga4Present === false ? 0 : undefined,
        {sessions: row.sessions, purchases: row.purchases, revenue: row.revenue});
      const search = periodHasRows(row.searchPresent === true ? 1 : row.searchPresent === false ? 0 : undefined,
        {clicks: row.clicks, impressions: row.impressions});
      return {
        date: String(row.date ?? ""),
        sessions: ga4 ? num(row.sessions) : null,
        purchases: ga4 ? num(row.purchases) : null,
        revenue: ga4 ? num(row.revenue) : null,
        clicks: search ? num(row.clicks) : null,
        impressions: search ? num(row.impressions) : null
      };
    }),
    channels: (raw?.channels ?? []).map((row: Raw) => ({
      channel: String(row.channel ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    devices: (raw?.devices ?? []).map((row: Raw) => ({
      device: String(row.device ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    landingPages: (snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 30).from ? raw?.landingPages ?? [] : []).map((row: Raw) => ({
      landingPage: String(row.landing_page ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: metricRatio(row.purchases, row.sessions)
    })),
    seoQueries: (snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 30).from ? raw?.seoQueries ?? [] : []).map((row: Raw) => ({
      name: String(row.query ?? "—"),
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      ctr: metricRatio(row.clicks, row.impressions),
      position: num(row.position)
    })),
    seoPages: (snapshotPeriod(raw?.meta?.from, raw?.meta?.to, 30).from ? raw?.seoPages ?? [] : []).map((row: Raw) => ({
      name: String(row.page ?? "—"),
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      ctr: metricRatio(row.clicks, row.impressions),
      position: num(row.position)
    }))
  };
}

function sourceQuality(raw: Raw | undefined): DigitalSourceQuality {
  return {
    coverage: sourceCoverage(raw?.coverage),
    rowScope: "ALL_STORED_ROWS",
    from: raw?.from ? String(raw.from) : undefined,
    to: raw?.to ? String(raw.to) : undefined,
    rows: num(raw?.rows),
    last7Sessions: raw?.to && num(raw?.rows) !== 0 ? num(raw?.last7Sessions) : null,
    last7Purchases: raw?.to && num(raw?.rows) !== 0 ? num(raw?.last7Purchases) : null
  };
}

export function normalizeDigitalHistory(raw: Raw): DigitalHistory {
  return {
    meta: {
      currentYear: calendar(raw?.meta?.currentYear),
      commonLatest: String(raw?.meta?.commonLatest ?? ""),
      cutoffMonth: calendar(raw?.meta?.cutoffMonth),
      cutoffDay: calendar(raw?.meta?.cutoffDay)
    },
    monthly: (raw?.monthly ?? []).map((row: Raw) => ({
      year: calendar(row.year),
      month: calendar(row.month),
      sessions: nullableNum(row.sessions),
      purchases: nullableNum(row.purchases),
      revenue: nullableNum(row.revenue),
      conversionRate: metricRatio(row.purchases, row.sessions),
      averageOrderValue: metricRatio(row.revenue, row.purchases),
      seoClicks: nullableNum(row.seoClicks),
      seoImpressions: nullableNum(row.seoImpressions),
      seoCtr: metricRatio(row.seoClicks, row.seoImpressions),
      seoPosition: nullableNum(row.seoPosition),
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


/** A snapshot must be fetched with its own exact 30-day period. History exposes
 * only max(period_end), so no search for older candidates is possible here. */
export async function selectDigitalSnapshots(
  data: DigitalData, history: DigitalHistory,
  read: (range: {from: string; to: string}) => Promise<DigitalData>
) {
  const queryDate = snapshotDate(history.quality.querySnapshot.to, data.meta.to);
  const pageDate = snapshotDate(history.quality.pageSnapshot.to, data.meta.to);
  const landingDate = snapshotDate(history.quality.landingSnapshot.to, data.meta.to);
  const dates = [...new Set([queryDate, pageDate, landingDate].filter((d): d is string => d !== null))];
  const periods = await Promise.all(dates.map(async to => {
    const start = new Date(`${to}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    const from = start.toISOString().slice(0, 10);
    const result = from === data.meta.from && to === data.meta.to ? data : await read({from, to});
    // Refuse a response with mismatched effective dates, including cache/RPC fallback.
    return [to, result.meta.from === from && result.meta.to === to ? result : null] as const;
  }));
  const byDate = new Map(periods);
  return {
    queryDate, pageDate, landingDate,
    queryPeriod: queryDate ? byDate.get(queryDate)?.meta.snapshots.queries ?? null : null,
    pagePeriod: pageDate ? byDate.get(pageDate)?.meta.snapshots.pages ?? null : null,
    landingPeriod: landingDate ? byDate.get(landingDate)?.meta.snapshots.landing ?? null : null,
    queries: queryDate ? byDate.get(queryDate)?.seoQueries ?? [] : [],
    pages: pageDate ? byDate.get(pageDate)?.seoPages ?? [] : [],
    landings: landingDate ? byDate.get(landingDate)?.landingPages ?? [] : [],
    queryPeriodCtr: queryDate ? byDate.get(queryDate)?.seo.ctr ?? null : null,
    limitation: "Only latest stored snapshot dates are discoverable; older eligible snapshots unavailable if latest is after cutoff. No atomic read across RPC calls."
  };
}
