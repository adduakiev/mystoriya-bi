import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeMetaAds, normalizeSocial, periodEvidence} from "../lib/data/meta-social-contract.ts";
import {normalizeAds} from "../lib/data/digital-source-contract.ts";
import {formatMetric} from "../lib/digital-quality.ts";

const asOf = "2026-10-23";
const window = {from: "2026-09-19", to: "2026-10-18"};
const metrics = {spend: 0, impressions: 0, clicks: 0, linkClicks: 0, conversions: 0, purchases: 0, purchaseValue: 0};
const social = {followers: 0, followersStart: 0, dailyFollows: 0, dailyUnfollows: 0,
  reach: 0, impressions: 0, organicImpressions: 0, pageViews: 0, profileViews: 0, websiteClicks: 0, accountsEngaged: 0};

test("Meta zero rows suppress every aggregate, legacy status, dates and campaign claims", () => {
  for (const contractVersion of [undefined, 2]) {
    const data = normalizeMetaAds({meta: {...window, contractVersion, rows: 0, status: "LIVE", available: true},
      summary: {...metrics, spend: 50}, campaigns: [{campaign_id: "x", spend: 50}]}, asOf);
    assert.equal(data.meta.status, "WAITING");
    assert.equal(data.meta.available, false);
    assert.ok(Object.values(data.summary).every(value => value === null));
    assert.equal(formatMetric(data.summary.spend), "—");
    assert.deepEqual(data.campaigns, []);
  }
});

test("legacy Meta all-history rows never prove selected-period zeroes or live readiness", () => {
  const data = normalizeMetaAds({meta: {...window, rows: 90, status: "contract-ready"}, summary: metrics}, asOf);
  assert.equal(data.meta.rows, null);
  assert.equal(data.meta.status, "WAITING");
  assert.equal(data.summary.spend, null);
});

test("IG zero rows and absent daily period evidence stay WAITING with dashes", () => {
  for (const instagram of [{rows: 0, ...social}, {...social}, {rows: 0, ...window, ...social, impressions: 42}]) {
    const data = normalizeSocial({meta: {instagramStatus: "live", instagramRows: 100, instagramMediaRows: 10}, instagram}, asOf);
    assert.equal(data.instagram.evidence.status, "WAITING");
    assert.equal(data.instagram.evidence.available, false);
    for (const [key, value] of Object.entries(data.instagram)) if (key !== "evidence") {
      assert.equal(value, null, key);
      assert.equal(formatMetric(value), "—");
    }
  }
});

test("Facebook Oct 18 relative to Oct 23 is STALE while real data remains visible", () => {
  const data = normalizeSocial({meta: {facebookStatus: "live", facebookRows: 90, facebookPostRows: 26},
    facebook: {...window, rows: 30, followers: 2300, followersStart: 2400, impressions: 12000, organicImpressions: 4000}}, asOf);
  assert.equal(data.facebook.evidence.status, "STALE");
  assert.equal(data.facebook.evidence.freshness, "STALE");
  assert.equal(data.facebook.evidence.latest, "2026-10-18");
  assert.equal(data.facebook.evidence.observedDates, null);
  assert.equal(data.facebook.evidence.coverage, "UNKNOWN");
  assert.equal(data.facebook.followers, 2300);
  assert.equal(data.facebook.impressions, 12000);
  assert.equal(data.facebook.followers - data.facebook.followersStart, -100);
  assert.equal(data.meta.facebookRows, 90);
});

test("measured zeroes survive positive selected-period evidence; undefined ratios stay null", () => {
  const data = normalizeMetaAds({meta: {...window, contractVersion: 2, rows: 30, observedDates: 30}, summary: metrics,
    campaigns: [{account_id: "a", campaign_id: "c", ...metrics}, {account_id: "b", campaign_id: "c", ...metrics}]}, asOf);
  assert.equal(data.summary.spend, 0);
  assert.equal(data.summary.purchases, 0);
  assert.equal(data.summary.roas, null);
  assert.equal(data.summary.ctr, null);
  assert.equal(data.campaigns[0].spend, 0);
  assert.deepEqual(data.campaigns.map(r => `${r.accountId}:${r.campaignId}`), ["a:c", "b:c"]);
  const s = normalizeSocial({meta: {contractVersion: 2}, facebook: {...window, rows: 30, ...social},
    instagram: {...window, rows: 30, ...social}}, asOf);
  assert.equal(s.facebook.followers, 0);
  assert.equal(s.facebook.impressions, 0);
  assert.equal(s.instagram.followers, 0);
  assert.equal(s.instagram.websiteClicks, 0);
  // Cross-date unique audience cannot be recovered from daily sums.
  assert.equal(s.instagram.reach, null);
  assert.equal(s.instagram.accountsEngaged, null);
  assert.equal(s.facebook.evidence.status, "STALE");
});

test("explicit observedDates=0 overrides positive rows and nonzero aggregates", () => {
  const data = normalizeMetaAds({meta: {...window, contractVersion: 2, rows: 30, observedDates: 0}, summary: {...metrics, spend: 50}}, asOf);
  assert.equal(data.meta.status, "WAITING");
  assert.equal(data.summary.spend, null);
  const s = normalizeSocial({facebook: {...window, rows: 30, observedDates: 0, impressions: 90}}, asOf);
  assert.equal(s.facebook.impressions, null);
});

test("freshness boundary, partial coverage and unknown dates never invent completeness", () => {
  const fresh = {from: "2026-09-22", to: "2026-10-21", rows: 30, observedDates: 30};
  assert.equal(periodEvidence(fresh, asOf).status, "LIVE");
  assert.equal(periodEvidence(fresh, asOf).coverage, "UNKNOWN");
  assert.equal(periodEvidence({...fresh, observedDates: 28}, asOf).status, "PARTIAL");
  assert.equal(periodEvidence({...fresh, observedDates: 28}, asOf).coverage, "PARTIAL");
  assert.equal(periodEvidence({...fresh, latest: "2026-10-20"}, asOf).status, "STALE");
  assert.equal(periodEvidence({rows: 3}, asOf).status, "PARTIAL");
  assert.equal(periodEvidence({...fresh, latest: null}, asOf).status, "PARTIAL");
  assert.equal(periodEvidence({...fresh, sourceLatest: null}, asOf).sourceLatest, null);
  assert.equal(periodEvidence({...fresh, latest: "2026-10-25"}, asOf).freshness, "UNKNOWN");
  assert.equal(periodEvidence({...fresh, latest: "2026-02-30"}, asOf).status, "PARTIAL");
  assert.equal(periodEvidence({rows: -1}, asOf).status, "WAITING");
  assert.equal(periodEvidence({rows: ""}, asOf).rows, null);
});

test("top content preserves nulls, measured zeroes and recomputes ratios without false claims", () => {
  const data = normalizeSocial({facebookPosts: [{post_id: "p", reach: 10, engagements: null, engagement_rate: 0,
    impressions: null, clicks: 0, reactions: null}], instagramMedia: [{media_id: "i", reach: null, plays: 0}]}, asOf);
  assert.equal(data.facebookPosts[0].impressions, null);
  assert.equal(data.facebookPosts[0].clicks, 0);
  assert.equal(data.facebookPosts[0].engagements, null);
  assert.equal(data.facebookPosts[0].engagementRate, null);
  assert.equal(data.instagramMedia[0].reach, null);
  assert.equal(data.instagramMedia[0].plays, 0);
  const legacy = normalizeSocial({facebook: {...window, rows: 30, followers: 0, followersStart: 0}}, asOf);
  assert.equal(legacy.facebook.followersStart, null);
});

test("Meta attribution ratios stay separate from unchanged Google normalization", () => {
  const meta = normalizeMetaAds({meta: {...window, contractVersion: 2, rows: 1}, summary: {spend: 100, purchaseValue: 200}}, asOf);
  const google = normalizeAds({meta: {available: true, rows: 1, observedDates: 1}, summary: {cost: 50, conversionValue: 400, conversions: 0}});
  assert.equal(meta.summary.roas, 2);
  assert.equal(google.summary.roas, 8);
  assert.equal(google.summary.conversions, 0);
  assert.equal(normalizeAds({meta: {available: true, rows: 0}, summary: {cost: 0}}).summary.cost, null);
  assert.equal(normalizeMetaAds({meta: {...window, contractVersion: 2, rows: 1}, summary: {spend: 10, purchaseValue: null}}, asOf).summary.roas, null);
});

test("NOT-APPLIED SQL preserves auth gates and selected-window evidence (static review only)", () => {
  const sql = readFileSync(new URL("../../docs/sql/issue-26-meta-social-correctness-NOT-APPLIED.sql", import.meta.url), "utf8");
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /rollback;\s*$/);
  assert.equal((sql.match(/raise exception 'unauthorized'/g) ?? []).length, 2);
  assert.equal((sql.match(/security definer\nset search_path to 'public','extensions'/g) ?? []).length, 2);
  for (const rpc of ["bi_digital_meta_ads_payload", "bi_digital_social_payload"]) {
    assert.ok(sql.includes(`revoke all on function public.${rpc}(text) from public,authenticated;`));
    assert.ok(sql.includes(`grant execute on function public.${rpc}(text) to anon,service_role;`));
  }
  assert.doesNotMatch(sql, /coalesce\(sum\(|then 0 else|sum\(reach\)|sum\(accounts_engaged\)/);
  assert.match(sql, /count\(\*\),count\(distinct date\),jsonb_build_object\([\s\S]*into v_rows,v_observed_dates,v_summary\s+from public.staging_meta_ads_daily\s+where v_latest is not null and date between v_from and v_latest/);
  for (const prefix of ["fb", "ig"]) {
    assert.match(sql, new RegExp(`'observedDates',count\\(distinct date\\)`));
    assert.ok(sql.includes(`where v_${prefix}_latest is not null and date between v_${prefix}_from and v_${prefix}_latest`));
    assert.ok(sql.includes(`when v_${prefix}_latest<(now() at time zone 'UTC')::date-2 then 'STALE'`));
  }
  assert.match(sql, /group by account_id,campaign_id/);
  assert.match(sql, /engagements\/nullif\(reach,0\)/);
  assert.match(sql, /\(created_at at time zone 'UTC'\)::date between v_fb_from and v_fb_latest/);
  assert.match(sql, /\(published_at at time zone 'UTC'\)::date between v_ig_from and v_ig_latest/);
});
