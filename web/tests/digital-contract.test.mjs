import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDigital, normalizeHistory, selectSeoSnapshots } from "../lib/digital-contract.ts";
import { normalizeAds, normalizeLocal } from "../lib/digital-source-contract.ts";
import { cumulativeMetric, metricSum, periodQuality } from "../lib/digital-quality.ts";

const meta = { from: "2026-09-13", to: "2026-10-12", ga4Latest: "2026-10-14", searchLatest: "2026-10-13" };
const history = (quality = {}) => normalizeHistory({
  meta: { currentYear: 2026, cutoffMonth: 10, cutoffDay: 13, commonLatest: "2026-10-13" }, quality
});

test("connected payloads preserve missing, invalid and measured zero metrics", () => {
  const missing = normalizeDigital({});
  assert.ok(Object.values(missing.current).every(v => v === null));
  assert.ok(Object.values(missing.seo).every(v => v === null));
  for (const value of [null, undefined, "", " ", false, {}, Infinity, "invalid", 0, "0"]) {
    const expected = value === 0 || value === "0" ? 0 : null;
    const d = normalizeDigital({ meta, current: { sessions: value }, trend: [{ sessions: value }],
      channels: [{ sessions: value }], devices: [{ sessions: value }], landingPages: [{ sessions: value }],
      seo: { clicks: value }, seoQueries: [{ clicks: value }], seoPages: [{ clicks: value }] });
    assert.equal(d.current.sessions, expected);
    assert.equal(d.trend[0].sessions, expected);
    for (const rows of [d.channels, d.devices, d.landingPages]) assert.equal(rows[0].sessions, expected);
    for (const rows of [d.seoQueries, d.seoPages]) assert.equal(rows[0].clicks, expected);
    assert.equal(d.seo.clicks, expected);
    const ads = normalizeAds({ meta: { available: true }, summary: { cost: value }, campaigns: [{ cost: value }], trend: [{ cost: value }] });
    assert.equal(ads.summary.cost, expected);
    assert.equal(ads.campaigns[0].cost, expected);
    assert.equal(ads.trend[0].cost, expected);
    const local = normalizeLocal({ meta, summary: { calls: value }, locations: [{ calls: value }], pageSpeed: { captured_on: "2026-10-15", mobile_cls: value } });
    assert.equal(local.summary.calls, expected);
    assert.equal(local.locations[0].calls, expected);
    assert.equal(local.pageSpeed.mobileCls, expected);
  }
});

test("period active users and dependent ratios are unavailable even when legacy daily sums exist", () => {
  const d = normalizeDigital({ meta, current: { activeUsers: 310, sessions: 400 }, previous: { activeUsers: 280 } });
  assert.equal(d.current.activeUsers, null);
  assert.equal(d.previous.activeUsers, null);
  assert.equal(d.current.sessions, 400);
});

test("derived ratios require known inputs and positive denominators", () => {
  const d = normalizeDigital({ meta, current: { sessions: 10, purchases: 0, engagedSessions: 0, purchaseRevenue: 0, averageOrderValue: 0 },
    seo: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, channels: [{ sessions: 0, purchases: 0, conversion_rate: 0 }] });
  assert.equal(d.current.conversionRate, 0);
  assert.equal(d.current.engagementRate, 0);
  assert.equal(d.current.averageOrderValue, null);
  assert.equal(d.seo.ctr, null);
  assert.equal(d.seo.position, null);
  assert.equal(d.channels[0].conversionRate, null);
  assert.equal(metricSum(0, 0, null), null);
  assert.equal(metricSum(0, 0, 0), 0);
});

test("known empty sources override legacy fabricated summary zeroes", () => {
  const d = normalizeDigital({ meta: { ...meta, ga4Rows: 0, searchRows: 0 }, current: { sessions: 0 }, previous: { sessions: 0 }, seo: { clicks: 0 } });
  assert.equal(d.current.sessions, null);
  assert.equal(d.previous.sessions, null);
  assert.equal(d.seo.clicks, null);
  assert.equal(normalizeAds({ meta: { available: false }, summary: { cost: 0 } }).summary.cost, null);
  assert.equal(normalizeLocal({ summary: { calls: 0 } }).summary.calls, null);
});

test("source dates remain independent; PageSpeed collector date never becomes measurement date", () => {
  const d = normalizeDigital({ meta, fetchedAt: "2026-10-22T12:00:00Z" });
  assert.equal(d.meta.ga4Latest, "2026-10-14");
  assert.equal(d.meta.searchLatest, "2026-10-13");
  const p = normalizeLocal({ meta: { from: "2026-10-01", to: "2026-10-10" }, pageSpeed: { captured_on: "2026-10-22", mobile_category: "NEEDS_IMPROVEMENT", mobile_lcp: null } });
  assert.equal(p.meta.to, "2026-10-10");
  assert.equal(p.meta.rows, null);
  assert.equal(normalizeLocal({ meta: { ...meta, rows: 0, coverage: "PARTIAL", providerRowLimit: 100 } }).meta.rows, 0);
  assert.equal(p.pageSpeed.capturedOn, "2026-10-22");
  assert.equal(p.pageSpeed.sourceDate, null);
  assert.equal(p.pageSpeed.dateSemantics, "COLLECTOR_DATE");
  assert.equal(p.pageSpeed.mobileCategory, "UNKNOWN");
});

test("snapshot metadata exposes exact periods, RPC caps and unknown provider completeness", () => {
  const d = normalizeDigital({ meta, seoQueries: [{ clicks: 0 }] });
  assert.deepEqual(d.snapshots.seoQueries, { from: meta.from, to: meta.to, periodDays: 30, returnedRows: 1,
    rpcRowLimit: 40, providerRowLimit: null, coverage: "UNKNOWN", snapshotIdentity: "UNVERIFIED" });
  assert.equal(d.snapshots.landingPages.rpcRowLimit, 30);
  assert.equal(d.snapshots.seoPages.rpcRowLimit, 30);
  const custom = normalizeDigital({ meta: { ...meta, from: "2026-10-01" }, seoQueries: [{ clicks: 1 }] });
  assert.equal(custom.snapshots.seoQueries.to, null);
  assert.deepEqual(custom.seoQueries, []);
});

test("same end date with a different period fetches exact 30-day snapshots", async () => {
  const calls = [];
  const custom = normalizeDigital({ meta: { ...meta, from: "2026-10-01" } });
  const q = history({ querySnapshot: { to: meta.to }, pageSnapshot: { to: "2026-10-10" } });
  const result = await selectSeoSnapshots(custom, q, async range => {
    calls.push(range);
    return normalizeDigital({ meta: range, seoQueries: [{ query: "synthetic", clicks: 0 }], seoPages: [{ page: "/synthetic", clicks: 0 }], seo: { clicks: 2, impressions: 10 } });
  });
  assert.deepEqual(calls, [{ from: meta.from, to: meta.to }, { from: "2026-09-11", to: "2026-10-10" }]);
  assert.equal(result.queryDate, meta.to);
  assert.equal(result.pageDate, "2026-10-10");
  assert.equal(result.queryPeriodCtr, 0.2);
});

test("mismatched RPC periods and future snapshots cannot leak into selected snapshot tables", async () => {
  const data = normalizeDigital({ meta });
  const q = history({ querySnapshot: { to: "2026-10-10" }, pageSnapshot: { to: "2026-10-15" } });
  let calls = 0;
  const result = await selectSeoSnapshots(data, q, async () => {
    calls++;
    return normalizeDigital({ meta, seoQueries: [{ query: "wrong-period", clicks: 100 }] });
  });
  assert.equal(calls, 1);
  assert.equal(result.queryDate, null);
  assert.equal(result.pageDate, null);
  assert.equal(result.queryPeriodCtr, null);
  assert.deepEqual(result.queries, []);
  assert.deepEqual(result.pages, []);
});

test("unknown completeness never defaults to FULL and all-history row counts are not period counts", () => {
  const d = normalizeDigital({ meta: { ...meta, ga4Rows: 1000, searchRows: 40 } });
  assert.equal(d.quality.coverage, "UNKNOWN");
  assert.equal(d.quality.observedDates, null);
  assert.equal(d.quality.snapshotConsistency, "UNVERIFIED");
  assert.equal(d.quality.zeroProvenance, "UNKNOWN");
  assert.equal(d.sources.ga4.coverage, "UNKNOWN");
  assert.equal(d.sources.devices.to, null);
  const dated = normalizeDigital({ meta: { ...meta, sources: { devices: { from: "2026-10-01", to: "2026-10-10" } } } });
  assert.equal(dated.sources.devices.to, "2026-10-10");
  assert.equal(dated.meta.ga4Latest, "2026-10-14");
  const q = history({ ga4: { rows: 1000, last7Sessions: null, coverage: "PARTIAL", rowLimit: 500 } }).quality;
  assert.equal(q.ga4.last7Sessions, null);
  assert.equal(q.ga4.coverage, "PARTIAL");
  assert.equal(q.ga4.rowLimit, 500);
  assert.equal(q.devices.rows, null);
  assert.equal(q.devices.coverage, "UNKNOWN");
  assert.equal(periodQuality({ contractVersion: 2, observedDates: 30, expectedDates: 30 }).coverage, "UNKNOWN");
  assert.throws(() => normalizeHistory({}), /calendar metadata unavailable/);
});

test("YTD totals propagate missing months and missing metric components independently", () => {
  const rows = [{ month: 1, sessions: 10, purchases: null, revenue: 0, seoClicks: 0, seoImpressions: 100 },
    { month: 2, sessions: null, purchases: 1, revenue: null, seoClicks: 2, seoImpressions: 100 },
    { month: 3, sessions: 20, purchases: 0, revenue: 10, seoClicks: 3, seoImpressions: 100 }];
  assert.deepEqual(cumulativeMetric(rows, "sessions"), { 1: 10, 2: null, 3: null });
  assert.deepEqual(cumulativeMetric(rows, "purchases"), { 1: null, 2: null, 3: null });
  assert.deepEqual(cumulativeMetric(rows, "revenue"), { 1: 0, 2: null, 3: null });
  assert.deepEqual(cumulativeMetric(rows, "conversionRate"), { 1: null, 2: null, 3: null });
  assert.deepEqual(cumulativeMetric(rows, "seoClicks"), { 1: 0, 2: 2, 3: 5 });
  assert.deepEqual(cumulativeMetric(rows, "seoCtr"), { 1: 0, 2: .01, 3: 5 / 300 });
  assert.equal(cumulativeMetric([{ month: 2, sessions: 10 }], "sessions")[2], null);
  assert.equal(cumulativeMetric([{ month: 1, sessions: 10 }, { month: 3, sessions: 10 }], "sessions")[3], null);
});

test("known source windows and period counts keep absent periods and padded days missing", () => {
  const d = normalizeDigital({ meta: { ...meta, ga4From: "2026-10-01", searchFrom: "2026-10-02", currentGa4Rows: 0, previousSearchRows: 0 },
    current: { sessions: 0 }, previousSeo: { clicks: 0 }, trend: [
      { date: "2026-09-30", sessions: 0, clicks: 0, impressions: 0 },
      { date: "2026-10-02", sessions: 0, clicks: 0, impressions: 0 },
      { date: "2026-10-15", sessions: 0, clicks: 0, impressions: 0 }
    ] });
  assert.equal(d.current.sessions, null);
  assert.equal(d.previousSeo.clicks, null);
  assert.equal(d.trend[0].sessions, null);
  assert.equal(d.trend[0].clicks, null);
  assert.equal(d.trend[0].impressions, null);
  assert.equal(d.trend[1].sessions, 0);
  assert.equal(d.trend[1].clicks, 0);
  assert.equal(d.trend[1].impressions, 0);
  assert.equal(d.trend[2].sessions, null);
  assert.equal(d.trend[2].clicks, null);
  assert.equal(d.trend[2].impressions, null);
  const snapshot = normalizeDigital({ meta: { ...meta, searchFrom: "2026-09-01" }, seoQueries: [{ query: "synthetic", impressions: 0 }] });
  assert.equal(snapshot.seoQueries[0].impressions, 0);
  const quality = history({ ga4: { rows: 0, last7Sessions: 0, last7Purchases: 0 } }).quality.ga4;
  assert.equal(quality.rows, 0);
  assert.equal(quality.last7Sessions, null);
});

test("collector shares empty-period semantics without processing unrelated raw dimensions", async () => {
  const { collectInput } = await import("../lib/operating-collector.ts");
  const packet = await collectInput(async () => ({
    meta: { ...meta, ga4Rows: 0, searchRows: 0 }, current: { sessions: 0, purchases: 0 }, seo: { clicks: 0 },
    channels: "malformed unrelated dimensions"
  }), "2026-10-22T12:00:00Z");
  for (const id of ["ga4.sessions", "ga4.purchases", "gsc.clicks"])
    assert.equal(packet.evidence.find(e => e.id === id).value, null);
  assert.equal(packet.evidence[0].source_date, meta.ga4Latest);
  assert.equal(packet.evidence[0].fetched_at, "2026-10-22T12:00:00Z");
  assert.ok(packet.evidence.every(e => e.coverage === "UNKNOWN"));
});

test("prepared SQL keeps source gaps nullable without weakening RPC authorization (static only)", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../../supabase/migrations/20261022_digital_correctness_phase1_design.sql", import.meta.url), "utf8");
  assert.match(sql, /PREPARED DESIGN ONLY — NOT APPLIED/);
  assert.equal((sql.match(/raise exception 'unauthorized'/g) ?? []).length, 4);
  assert.equal((sql.match(/security definer/g) ?? []).length, 4);
  assert.equal((sql.match(/set search_path to 'public','extensions'/g) ?? []).length, 4);
  assert.doesNotMatch(sql, /sum\(active_users\)|coalesce\([gs]\.|coalesce\(sum\(/);
  assert.doesNotMatch(sql, /'FULL'|create table|alter table|cron\./i);
  assert.match(sql, /'currentGa4Rows'/);
  assert.match(sql, /'observedDates'/);
  assert.match(sql, /'source_date',null/);
});
