import { metricNumber, metricRatio, periodSourceDate, snapshotDate, sourceCoverage } from "../digital-quality.ts";
import { selectedPeriodMetric } from "./digital-source-contract.ts";
import { currencyEvidence } from "../source-evidence.ts";

type Raw = Record<string, any>;
export type SourceStatus = "LIVE" | "STALE" | "WAITING" | "PARTIAL";
export type PeriodEvidence = {
  from: string; to: string; rows: number | null; observedDates: number | null;
  latest: string | null; sourceLatest: string | null; available: boolean;
  freshness: "FRESH" | "STALE" | "UNKNOWN"; status: SourceStatus;
  coverage: ReturnType<typeof sourceCoverage>; freshnessDays: number;
};

function count(value: unknown): number | null {
  const n = metricNumber(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}
const text = (v: unknown) => typeof v === "string" ? v : "";
const today = () => new Date().toISOString().slice(0, 10);

/** LIVE describes recency, never completeness. Two UTC calendar days is the
 * explicit display freshness policy, not an upstream delivery SLA. */
export function periodEvidence(raw: Raw = {}, asOf = today()): PeriodEvidence {
  const from = text(raw.from), to = text(raw.to);
  const rows = count(raw.rows), observedDates = count(raw.observedDates);
  const latestValue = Object.hasOwn(raw, "latest") ? raw.latest : raw.to;
  const sourceValue = Object.hasOwn(raw, "sourceLatest") ? raw.sourceLatest : latestValue;
  const sourceLatest = snapshotDate(text(sourceValue), asOf);
  const latest = periodSourceDate(latestValue, from, to);
  const available = rows !== 0 && observedDates !== 0 &&
    ((rows !== null && rows > 0) || (observedDates !== null && observedDates > 0));
  const age = latest && snapshotDate(latest, asOf) ?
    (Date.parse(asOf) - Date.parse(latest)) / 86400000 : null;
  const freshness = !available || age === null ? "UNKNOWN" : age > 2 ? "STALE" : "FRESH";
  const days = snapshotDate(from, to) ? (Date.parse(to) - Date.parse(from)) / 86400000 + 1 : null;
  const gaps = observedDates !== null && days !== null && observedDates < days;
  const coverage = gaps ? "PARTIAL" : sourceCoverage(raw.coverage);
  const status = !available ? "WAITING" : freshness === "STALE" ? "STALE" :
    freshness === "UNKNOWN" || coverage === "PARTIAL" ? "PARTIAL" : "LIVE";
  return {from, to, rows, observedDates, latest, sourceLatest, available, freshness, status, coverage, freshnessDays: 2};
}

function measured(evidence: PeriodEvidence, value: unknown) {
  return evidence.available ? selectedPeriodMetric(evidence, value) : null;
}

export type MetaAdsMetrics = {
  spend: number | null; impressions: number | null; clicks: number | null;
  linkClicks: number | null; conversions: number | null; purchases: number | null;
  purchaseValue: number | null; ctr: number | null; cpc: number | null; cpm: number | null; roas: number | null;
};
export type DigitalMetaAdsData = {
  meta: PeriodEvidence & {currency: string | null; attributionVerified: boolean; limitations: string[]}; summary: MetaAdsMetrics;
  campaigns: Array<MetaAdsMetrics & {accountId: string; campaignId: string; campaignName: string; currency: string | null}>;
};
function metaMetrics(raw: Raw, read: (value: unknown) => number | null): MetaAdsMetrics {
  const spend = read(raw.spend), impressions = read(raw.impressions), clicks = read(raw.clicks);
  const purchaseValue = read(raw.purchaseValue ?? raw.purchase_value);
  const cpm = metricRatio(spend, impressions);
  return {spend, impressions, clicks, linkClicks: read(raw.linkClicks ?? raw.link_clicks),
    conversions: read(raw.conversions), purchases: read(raw.purchases), purchaseValue,
    ctr: metricRatio(clicks, impressions), cpc: metricRatio(spend, clicks),
    cpm: cpm === null ? null : cpm * 1000, roas: metricRatio(purchaseValue, spend)};
}
export function normalizeMetaAds(raw: Raw, asOf = today()): DigitalMetaAdsData {
  const m = raw?.meta ?? {};
  // Legacy meta.rows counts ALL history, not the summary period. Only zero is
  // conclusive. Require the reviewed versioned contract before trusting totals.
  const versioned = m.contractVersion === 2 || m.contractVersion === 3;
  const evidence = periodEvidence({...m, rows: versioned || count(m.rows) === 0 ? m.rows : null}, asOf);
  const currency = (value: unknown) => currencyEvidence({currency: value}).currency;
  const v3 = m.contractVersion === 3;
  const summaryCurrency = v3 && evidence.available ? currency(m.currency) : null;
  const attributionVerified = v3 && m.attributionVerified === true;
  function metrics(row: Raw, read: (value: unknown) => number | null, unit: string | null) {
    const result = metaMetrics(row, read);
    if (v3 && !unit) {
      result.spend = result.purchaseValue = result.cpc = result.cpm = result.roas = null;
    }
    if (v3 && !attributionVerified) result.roas = null;
    return result;
  }
  return {
    meta: {...evidence, currency: summaryCurrency, attributionVerified, limitations: [
      "Legacy all-history counts cannot establish selected-period measurements; ingestion SQL requires separate review/application.",
      "Completeness, account/currency reconciliation and attribution settings are unverified. No cross-provider ROAS.",
      "Reach/frequency cannot be summed across ads or dates and are unavailable. Campaign limit 50; upstream completeness unknown."
    ]},
    summary: metrics(raw?.summary ?? {}, value => measured(evidence, value), summaryCurrency),
    campaigns: evidence.available ? (raw?.campaigns ?? []).map((row: Raw) => ({
      accountId: text(row.account_id), campaignId: text(row.campaign_id), campaignName: text(row.campaign_name),
      currency: v3 ? currency(row.account_currency) : null,
      ...metrics(row, metricNumber, v3 ? currency(row.account_currency) : null)
    })) : []
  };
}

export type SocialMetrics = {
  followers: number | null; followersStart: number | null; dailyFollows: number | null;
  dailyUnfollows: number | null; impressions: number | null; organicImpressions: number | null;
  pageViews: number | null; reach: number | null; profileViews: number | null;
  websiteClicks: number | null; accountsEngaged: number | null;
};
export type SocialContent = {
  id: string; publishedAt: string; message: string; permalink: string;
  impressions: number | null; reach: number | null; clicks: number | null;
  engagements: number | null; engagementRate: number | null; likes: number | null;
  comments: number | null; plays: number | null; saves: number | null; shares: number | null;
};
export type DigitalSocialData = {
  meta: {facebookRows: number | null; facebookPostRows: number | null; instagramRows: number | null; instagramMediaRows: number | null; limitations: string[]};
  facebook: SocialMetrics & {evidence: PeriodEvidence}; instagram: SocialMetrics & {evidence: PeriodEvidence};
  facebookPosts: SocialContent[]; instagramMedia: SocialContent[];
};
function socialMetrics(raw: Raw, evidence: PeriodEvidence): SocialMetrics {
  const read = (key: string) => measured(evidence, raw[key]);
  return {followers: read("followers"), followersStart: read("followersStart"), dailyFollows: read("dailyFollows"),
    dailyUnfollows: read("dailyUnfollows"), impressions: read("impressions"), organicImpressions: read("organicImpressions"),
    pageViews: read("pageViews"), reach: read("reach"), profileViews: read("profileViews"),
    websiteClicks: read("websiteClicks"), accountsEngaged: read("accountsEngaged")};
}
function content(row: Raw): SocialContent {
  return {id: text(row.post_id ?? row.media_id), publishedAt: text(row.created_at ?? row.published_at),
    message: text(row.message ?? row.caption), permalink: text(row.permalink),
    impressions: metricNumber(row.impressions), reach: metricNumber(row.reach), clicks: metricNumber(row.clicks),
    engagements: metricNumber(row.engagements), engagementRate: metricRatio(row.engagements, row.reach),
    likes: metricNumber(row.likes ?? row.reactions), comments: metricNumber(row.comments), plays: metricNumber(row.plays),
    saves: metricNumber(row.saves), shares: metricNumber(row.shares)};
}
export function normalizeSocial(raw: Raw, asOf = today()): DigitalSocialData {
  const m = raw?.meta ?? {}, f = raw?.facebook ?? {}, i = raw?.instagram ?? {};
  // Legacy facebook.rows/instagram.rows already describe their daily windows.
  // All-history meta counts and caller-provided live flags never establish that.
  const facebook = periodEvidence(f, asOf);
  const igTo = text(i.to ?? i.latest);
  const igStart = snapshotDate(igTo, igTo) ? new Date(Date.parse(igTo) - 29 * 86400000).toISOString().slice(0, 10) : "";
  const instagram = periodEvidence({...i, from: i.from ?? igStart, to: igTo}, asOf);
  const fbMetrics = socialMetrics(f, facebook), igMetrics = socialMetrics(i, instagram);
  // Legacy SQL coalesces a missing endpoint follower snapshot to zero even with
  // daily rows. Preserve nonzero snapshots, but don't invent a zero endpoint.
  if (m.contractVersion !== 2) {
    if (fbMetrics.followers === 0) fbMetrics.followers = null;
    if (fbMetrics.followersStart === 0) fbMetrics.followersStart = null;
    if (igMetrics.followers === 0) igMetrics.followers = null;
  }
  return {meta: {facebookRows: count(m.facebookRows), facebookPostRows: count(m.facebookPostRows),
    instagramRows: count(m.instagramRows), instagramMediaRows: count(m.instagramMediaRows), limitations: [
      "Coverage UNKNOWN unless explicit evidence shows gaps. Legacy coalesced sums may have lost missingness; v2 SQL is NOT APPLIED.",
      "Content dates are publication dates, not Insights measurement dates. Top lists are limited to 30; completeness and metric observation windows unknown.",
      "Daily reach/accounts engaged can overlap across dates; period-unique totals remain unavailable."
    ]}, facebook: {...fbMetrics, evidence: facebook},
    instagram: {...igMetrics, reach: null, accountsEngaged: null, evidence: instagram},
    facebookPosts: (raw?.facebookPosts ?? []).map(content), instagramMedia: (raw?.instagramMedia ?? []).map(content)};
}
