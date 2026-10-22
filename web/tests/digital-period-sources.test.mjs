import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAds, normalizeLocal } from "../lib/digital-period-sources.ts";
import { metricSum } from "../lib/digital-quality.ts";
import { collectInput } from "../lib/operating-collector.ts";

const period = { from: "2026-10-01", to: "2026-10-20" };
const adsZero = { cost: 0, clicks: 0, impressions: 0, conversions: 0, conversionValue: 0 };
const gbpZero = { impressions: 0, clicks: 0, calls: 0, websiteClicks: 0, directions: 0, menuClicks: 0 };
const emptyCounts = [{ rows: 0 }, { observedDates: 0 }, { rows: 0, observedDates: 0 },
  { rows: 0, observedDates: 3 }, { rows: 3, observedDates: 0 }];
const measuredCounts = [{ rows: 3 }, { observedDates: 3 }, { rows: 3, observedDates: 3 }];
const assertUnknown = summary => {
  assert.ok(Object.values(summary).length > 0);
  for (const [key, value] of Object.entries(summary)) assert.equal(value, null, key);
};

test("Ads explicit empty period overrides available=true and legacy zero summaries", () => {
  for (const counts of emptyCounts) {
    const raw = { meta: { ...period, available: true, ...counts }, summary: adsZero };
    assertUnknown(normalizeAds(raw).summary);
    // An explicit empty period also overrides contradictory nonzero legacy totals.
    assertUnknown(normalizeAds({ ...raw, summary: { ...adsZero, cost: 100 } }).summary);
  }
});

test("GBP explicit empty period overrides dates and populated location arrays", () => {
  for (const counts of emptyCounts) {
    const raw = { meta: { ...period, ...counts }, summary: gbpZero,
      locations: [{ location_id: "synthetic-profile", impressions: 0 }] };
    assertUnknown(normalizeLocal(raw).summary);
    assertUnknown(normalizeLocal({ ...raw, summary: { ...gbpZero, calls: 5 } }).summary);
  }
});

test("positive selected-period counts preserve measured zeroes for Ads and GBP", () => {
  for (const counts of measuredCounts) {
    const ads = normalizeAds({ meta: { ...period, available: true, ...counts }, summary: adsZero });
    for (const key of Object.keys(adsZero)) assert.equal(ads.summary[key], 0, key);
    for (const key of ["ctr", "cpc", "cpa", "roas"]) assert.equal(ads.summary[key], null, key);
    assert.deepEqual(normalizeLocal({ meta: { ...period, ...counts }, summary: gbpZero }).summary, gbpZero);
    assert.equal(normalizeAds({ meta: { available: true, ...counts },
      summary: { cost: 0, clicks: 5, impressions: 10, conversions: 0 } }).summary.cpc, 0);
  }
});

test("availability, dates and profiles alone cannot establish a measured zero", () => {
  assertUnknown(normalizeAds({ meta: { ...period, available: true }, summary: adsZero }).summary);
  assertUnknown(normalizeLocal({ meta: period, summary: gbpZero,
    locations: [{ location_id: "synthetic-profile" }] }).summary);
  assertUnknown(normalizeAds({ meta: { available: false, rows: 3 }, summary: adsZero }).summary);
  for (const counts of [{}, ...measuredCounts]) {
    assertUnknown(normalizeAds({ meta: { available: true, ...counts } }).summary);
    assertUnknown(normalizeLocal({ meta: counts }).summary);
  }
  assert.equal(normalizeAds({ meta: { available: true }, summary: { cost: 100 } }).summary.cost, 100);
});

test("PageSpeed snapshot is preserved independently of empty GBP period", () => {
  const pageSpeed = { captured_on: "2026-10-21", mobile_score: 81, desktop_score: 95,
    mobile_lcp: 2100, mobile_inp: 100, mobile_cls: 0, desktop_lcp: 900,
    desktop_inp: 50, desktop_cls: 0, desktop_category: "GOOD", mobile_category: "GOOD" };
  const expected = normalizeLocal({ pageSpeed }).pageSpeed;
  assert.ok(expected);
  for (const counts of emptyCounts) {
    const actual = normalizeLocal({ meta: { ...period, ...counts }, summary: gbpZero, pageSpeed });
    assertUnknown(actual.summary);
    assert.deepEqual(actual.pageSpeed, expected);
    assert.equal(actual.pageSpeed.capturedOn, pageSpeed.captured_on);
  }
});

test("derived local actions preserve unknown components and measured zero", () => {
  assert.equal(metricSum(null, 0, 0, 0), null);
  assert.equal(metricSum(0, 0, 0, 0), 0);
  assert.equal(metricSum(2, 3, 4, 5), 14);
});

test("aggregate collector applies the same empty-period Ads spend rule", async () => {
  for (const counts of [...emptyCounts, ...measuredCounts, {}]) {
    const packet = await collectInput(async name => name === "bi_digital_ads_payload"
      ? { meta: { ...period, available: true, ...counts }, summary: adsZero } : {}, "2026-10-22T00:00:00Z");
    const spend = packet.evidence.find(row => row.id === "ads.spend");
    assert.equal(spend.value, measuredCounts.includes(counts) ? 0 : null);
    assert.equal(spend.coverage, "UNKNOWN");
  }
});
