import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

export type DigitalMetrics = {
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  conversionRate: number;
  purchaseRevenue: number;
  averageOrderValue: number;
};

export type SeoMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type DigitalChannel = {
  channel: string;
  sessions: number;
  purchases: number;
  purchaseRevenue: number;
  conversionRate: number;
};

export type DigitalDevice = {
  device: string;
  sessions: number;
  purchases: number;
  purchaseRevenue: number;
  conversionRate: number;
};

export type DigitalLanding = {
  landingPage: string;
  sessions: number;
  purchases: number;
  purchaseRevenue: number;
  conversionRate: number;
};

export type DigitalSeoItem = {
  name: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type DigitalTrendRow = {
  date: string;
  sessions: number;
  purchases: number;
  revenue: number;
  clicks: number;
  impressions: number;
};

export type DigitalData = {
  meta: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    ga4Latest: string;
    searchLatest: string;
    ga4Rows: number;
    searchRows: number;
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
  partial: boolean;
};

export type DigitalSourceQuality = {
  from?: string;
  to?: string;
  rows: number;
  last7Sessions?: number;
  last7Purchases?: number;
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

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metrics(raw: Raw | undefined): DigitalMetrics {
  return {
    sessions: num(raw?.sessions),
    engagedSessions: num(raw?.engagedSessions),
    engagementRate: num(raw?.engagementRate),
    addToCarts: num(raw?.addToCarts),
    checkouts: num(raw?.checkouts),
    purchases: num(raw?.purchases),
    conversionRate: num(raw?.conversionRate),
    purchaseRevenue: num(raw?.purchaseRevenue),
    averageOrderValue: num(raw?.averageOrderValue)
  };
}

function seo(raw: Raw | undefined): SeoMetrics {
  return {
    clicks: num(raw?.clicks),
    impressions: num(raw?.impressions),
    ctr: num(raw?.ctr),
    position: num(raw?.position)
  };
}

function normalize(raw: Raw): DigitalData {
  return {
    meta: {
      from: String(raw?.meta?.from ?? ""),
      to: String(raw?.meta?.to ?? ""),
      previousFrom: String(raw?.meta?.previousFrom ?? ""),
      previousTo: String(raw?.meta?.previousTo ?? ""),
      ga4Latest: String(raw?.meta?.ga4Latest ?? ""),
      searchLatest: String(raw?.meta?.searchLatest ?? ""),
      ga4Rows: num(raw?.meta?.ga4Rows),
      searchRows: num(raw?.meta?.searchRows)
    },
    current: metrics(raw?.current),
    previous: metrics(raw?.previous),
    seo: seo(raw?.seo),
    previousSeo: seo(raw?.previousSeo),
    trend: (raw?.trend ?? []).map((row: Raw) => ({
      date: String(row.date ?? ""),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      revenue: num(row.revenue),
      clicks: num(row.clicks),
      impressions: num(row.impressions)
    })),
    channels: (raw?.channels ?? []).map((row: Raw) => ({
      channel: String(row.channel ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: num(row.conversion_rate)
    })),
    devices: (raw?.devices ?? []).map((row: Raw) => ({
      device: String(row.device ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: num(row.conversion_rate)
    })),
    landingPages: (raw?.landingPages ?? []).map((row: Raw) => ({
      landingPage: String(row.landing_page ?? "—"),
      sessions: num(row.sessions),
      purchases: num(row.purchases),
      purchaseRevenue: num(row.purchase_revenue),
      conversionRate: num(row.conversion_rate)
    })),
    seoQueries: (raw?.seoQueries ?? []).map((row: Raw) => ({
      name: String(row.query ?? "—"),
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      ctr: num(row.ctr),
      position: num(row.position)
    })),
    seoPages: (raw?.seoPages ?? []).map((row: Raw) => ({
      name: String(row.page ?? "—"),
      clicks: num(row.clicks),
      impressions: num(row.impressions),
      ctr: num(row.ctr),
      position: num(row.position)
    }))
  };
}

function sourceQuality(raw: Raw | undefined): DigitalSourceQuality {
  return {
    from: raw?.from ? String(raw.from) : undefined,
    to: raw?.to ? String(raw.to) : undefined,
    rows: num(raw?.rows),
    last7Sessions: raw?.last7Sessions === undefined ? undefined : num(raw.last7Sessions),
    last7Purchases: raw?.last7Purchases === undefined ? undefined : num(raw.last7Purchases)
  };
}

function normalizeHistory(raw: Raw): DigitalHistory {
  return {
    meta: {
      currentYear: num(raw?.meta?.currentYear),
      commonLatest: String(raw?.meta?.commonLatest ?? ""),
      cutoffMonth: num(raw?.meta?.cutoffMonth),
      cutoffDay: num(raw?.meta?.cutoffDay)
    },
    monthly: (raw?.monthly ?? []).map((row: Raw) => ({
      year: num(row.year),
      month: num(row.month),
      sessions: nullableNum(row.sessions),
      purchases: nullableNum(row.purchases),
      revenue: nullableNum(row.revenue),
      conversionRate: nullableNum(row.conversionRate),
      averageOrderValue: nullableNum(row.averageOrderValue),
      seoClicks: nullableNum(row.seoClicks),
      seoImpressions: nullableNum(row.seoImpressions),
      seoCtr: nullableNum(row.seoCtr),
      seoPosition: nullableNum(row.seoPosition),
      partial: Boolean(row.partial)
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

const cachedPeriod = unstable_cache(
  async (from: string, to: string): Promise<DigitalData> => {
    const args: Record<string, unknown> = {};
    if (from) args.p_from = from;
    if (to) args.p_to = to;
    return normalize(await callBiRpc<Raw>("bi_digital_payload", args));
  },
  ["digital-dashboard-v2"],
  { revalidate: 300, tags: ["digital-data"] }
);

const cachedHistory = unstable_cache(
  async (): Promise<DigitalHistory> =>
    normalizeHistory(await callBiRpc<Raw>("bi_digital_history_payload")),
  ["digital-history-v1"],
  { revalidate: 300, tags: ["digital-data"] }
);

export async function loadDigitalData(range?: {from?: string; to?: string}): Promise<DigitalData> {
  return cachedPeriod(range?.from ?? "", range?.to ?? "");
}

export async function loadDigitalHistory(): Promise<DigitalHistory> {
  return cachedHistory();
}
