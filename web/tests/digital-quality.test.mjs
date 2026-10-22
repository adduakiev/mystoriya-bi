import test from "node:test";
import assert from "node:assert/strict";
import { metricNumber, metricRatio, snapshotDate } from "../lib/digital-quality.ts";

test("undefined acquisition costs stay missing while a measured zero stays zero", () => {
  assert.equal(metricRatio(500, 0), null);
  assert.equal(metricRatio(null, 10), null);
  assert.equal(metricRatio(0, 10), 0);
  assert.equal(metricRatio("500", "10"), 50);
  for (const value of [undefined, "", " ", false, {}, Infinity, "NaN"])
    assert.equal(metricNumber(value), null);
});

test("snapshot selection accepts an older snapshot without leaking future data", () => {
  assert.equal(snapshotDate("2026-10-12", "2026-10-17"), "2026-10-12");
  assert.equal(snapshotDate("2026-10-17", "2026-10-17"), "2026-10-17");
  assert.equal(snapshotDate("2026-10-18", "2026-10-17"), null);
  assert.equal(snapshotDate(undefined, "2026-10-17"), null);
  assert.equal(snapshotDate("2026-02-30", "2026-10-17"), null);
});

import { normalizeDigital, normalizeDigitalHistory, selectDigitalSnapshots } from "../lib/data/digital-contract.ts";
import { normalizeAds, normalizeLocal } from "../lib/data/digital-source-contract.ts";
import { formatMetric, metricSum, historyCumulative, periodSourceDate, sourceCoverage } from "../lib/digital-quality.ts";
import { collectInput } from "../lib/operating-collector.ts";
import { readFileSync } from "node:fs";

const meta = {from:"2026-09-18", to:"2026-10-17", previousFrom:"2026-08-19", previousTo:"2026-09-17"};
const history = (quality = {}) => normalizeDigitalHistory({
  meta:{currentYear:2026,commonLatest:"2026-10-17",cutoffMonth:10,cutoffDay:17}, quality
});

test("Digital normalizers preserve missing, invalid and measured zero for aggregates and dimensions", () => {
  const data = normalizeDigital({
    meta:{...meta,currentGa4Rows:1,currentSearchRows:1},
    current:{sessions:0, purchases:0, purchaseRevenue:null, engagedSessions:"", activeUsers:12},
    seo:{clicks:0, impressions:0, position:0, ctr:0},
    channels:[{sessions:0,purchases:0,purchase_revenue:null,conversion_rate:0}],
    devices:[{sessions:null,purchases:0}],
    landingPages:[{sessions:0,purchases:0}],
    seoQueries:[{clicks:0,impressions:0}],seoPages:[{clicks:null,impressions:10}]
  });
  assert.equal(data.current.sessions,0);
  assert.equal(data.current.purchases,0);
  assert.equal(data.current.purchaseRevenue,null);
  assert.equal(data.current.engagedSessions,null);
  assert.equal(data.current.conversionRate,null);
  assert.equal(data.seo.clicks,0);
  assert.equal(data.seo.ctr,null);
  assert.equal(data.seo.position,null);
  assert.equal(data.channels[0].sessions,0);
  assert.equal(data.channels[0].conversionRate,null);
  assert.equal(data.devices[0].sessions,null);
  assert.equal(data.landingPages[0].sessions,0);
  assert.equal(data.seoQueries[0].clicks,0);
  assert.equal(data.seoPages[0].clicks,null);
  assert.equal(data.seoPages[0].ctr,null);
  assert.ok(Object.values(data.previous).every(v=>v===null));
  assert.equal(formatMetric(null),"—");
  assert.equal(formatMetric(0),"0");
  assert.equal(metricSum(10,null,2),null);
  assert.equal(metricSum(0,0),0);
});

test("daily active users never become unique users for any period or previous period", () => {
  for (const activeUsers of [0,10,150,"150",null,undefined]) {
    const data=normalizeDigital({meta:{...meta,currentGa4Rows:2,previousGa4Rows:2},
      current:{sessions:100,activeUsers},previous:{sessions:90,activeUsers}});
    assert.equal(data.current.activeUsers,null);
    assert.equal(data.previous.activeUsers,null);
    assert.equal(metricRatio(data.current.sessions,data.current.activeUsers),null);
  }
});

test("legacy coalesced empty periods and synthetic trend days remain unknown; presence flags retain true zero", () => {
  const data=normalizeDigital({meta:{...meta,ga4Rows:999,searchRows:999,currentGa4Rows:0},
    current:{sessions:0,purchases:0},previous:{sessions:0,purchases:0},seo:{clicks:0,impressions:0},
    trend:[
      {date:"2026-10-15",sessions:0,purchases:0,revenue:0,clicks:0,impressions:0},
      {date:"2026-10-16",sessions:0,purchases:0,revenue:0,clicks:0,impressions:0,ga4Present:true,searchPresent:true},
      {date:"2026-10-17",sessions:5,purchases:0,revenue:0,clicks:0,impressions:10},
      {date:"2026-10-18",sessions:99,purchases:10,ga4Present:false}
    ]});
  assert.equal(data.current.sessions,null);
  assert.equal(data.previous.purchases,null);
  assert.equal(data.seo.clicks,null);
  assert.equal(data.trend[0].sessions,null);
  assert.equal(data.trend[0].clicks,null);
  assert.equal(data.trend[1].sessions,0);
  assert.equal(data.trend[1].clicks,0);
  assert.equal(data.trend[2].purchases,0);
  assert.equal(data.trend[2].clicks,0);
  assert.equal(data.trend[3].sessions,null);
});

test("Ads/GBP/PageSpeed missing operands are not zero or a fabricated CWV category", () => {
  const ads=normalizeAds({meta:{available:true},summary:{cost:0,clicks:10,conversions:null},
    campaigns:[{cost:null,clicks:0,conversions:1}],trend:[{cost:0,conversions:null}]});
  assert.equal(ads.summary.cost,0);
  assert.equal(ads.summary.cpc,0);
  assert.equal(ads.summary.cpa,null);
  assert.equal(ads.campaigns[0].cost,null);
  assert.equal(ads.campaigns[0].cpc,null);
  assert.equal(ads.trend[0].cost,0);
  assert.equal(ads.trend[0].conversions,null);
  assert.equal(normalizeAds({summary:{cost:0}}).summary.cost,null);
  const local=normalizeLocal({meta:{from:meta.from,to:meta.to},locations:[{impressions:0,calls:0}],summary:{calls:0},
    pageSpeed:{captured_on:"2026-10-22",imported_at:"2026-10-22T10:00:00Z",mobile_score:0,mobile_lcp:100,mobile_cls:0,mobile_category:"GOOD"}});
  assert.equal(local.summary.calls,0);
  assert.equal(local.summary.directions,null);
  assert.equal(local.locations[0].calls,0);
  assert.equal(local.pageSpeed.mobileScore,0);
  assert.equal(local.pageSpeed.mobileInp,null);
  assert.equal(local.pageSpeed.mobileCategory,"UNKNOWN");
  assert.equal(local.pageSpeed.capturedOn,"2026-10-22");
  assert.equal(local.pageSpeed.measurementDate,null);
  assert.equal(local.pageSpeed.fetchedAt,null);
  assert.equal(local.pageSpeed.processedAt,"2026-10-22T10:00:00Z");
  assert.equal(normalizeLocal({summary:{calls:0}}).summary.calls,null);
});

test("coverage/row counts never infer FULL; calendar span and counts have explicit scopes", () => {
  const h=history({ga4:{rows:100,to:"2026-10-17"},querySnapshot:{to:"2026-10-12",rows:200}});
  assert.equal(h.quality.ga4.coverage,"UNKNOWN");
  assert.equal(h.quality.querySnapshot.coverage,"UNKNOWN");
  assert.equal(h.quality.querySnapshot.rowScope,"ALL_STORED_ROWS");
  assert.equal(h.quality.devices.rows,null);
  assert.equal(normalizeAds({meta:{available:true,days:30}}).meta.coverage,"UNKNOWN");
  assert.equal(normalizeLocal({meta:{days:30,locationCount:4}}).meta.coverage,"UNKNOWN");
  assert.equal(sourceCoverage("PARTIAL"),"PARTIAL");
  assert.equal(sourceCoverage("unknown"),"UNKNOWN");
  const d=normalizeDigital({meta});
  assert.deepEqual([d.meta.snapshots.landing.rowLimit,d.meta.snapshots.queries.rowLimit,d.meta.snapshots.pages.rowLimit],[30,40,30]);
  assert.equal(d.meta.snapshots.queries.completeness,"UNKNOWN");
  assert.equal(d.meta.snapshots.queries.upstreamRowLimit,null);
});

test("snapshots use separate exact periods including landing, without reusing a seven-day payload", async () => {
  const calls=[];
  const data=normalizeDigital({meta:{...meta,from:"2026-10-11"},seoQueries:[{query:"wrong"}]});
  assert.equal(data.seoQueries.length,0);
  const h=history({querySnapshot:{to:meta.to},pageSnapshot:{to:"2026-10-12"},landingSnapshot:{to:"2026-10-12"}});
  const snapshots=await selectDigitalSnapshots(data,h,async range=>{
    calls.push(range);
    return normalizeDigital({meta:range,seo:{clicks:10,impressions:100},seoQueries:[{query:range.to,clicks:1}],
      seoPages:[{page:range.to}],landingPages:[{landing_page:range.to}]});
  });
  assert.deepEqual(calls,[{from:"2026-09-18",to:"2026-10-17"},{from:"2026-09-13",to:"2026-10-12"}]);
  assert.equal(snapshots.queries[0].name,"2026-10-17");
  assert.equal(snapshots.pages[0].name,"2026-10-12");
  assert.equal(snapshots.landings[0].landingPage,"2026-10-12");
  assert.equal(snapshots.queryPeriodCtr,0.1);
  assert.equal(snapshots.pagePeriod.from,"2026-09-13");
});

test("future/missing snapshot dates and mismatched RPC responses fail closed", async () => {
  const d=normalizeDigital({meta});
  const unavailable=await selectDigitalSnapshots(d,history({querySnapshot:{to:"2026-10-18"}}),async()=>assert.fail("future fetch"));
  assert.equal(unavailable.queryDate,null);
  assert.deepEqual(unavailable.queries,[]);
  assert.match(unavailable.limitation,/older eligible snapshots unavailable/);
  const mismatch=await selectDigitalSnapshots(d,history({querySnapshot:{to:"2026-10-12"}}),async()=>normalizeDigital({meta,seoQueries:[{query:"wrong"}]}));
  assert.deepEqual(mismatch.queries,[]);
  assert.equal(mismatch.queryPeriod,null);
  assert.equal(mismatch.queryPeriodCtr,null);
});

test("YTD does not use sessions to fabricate purchases or skip missing months", () => {
  const rows=[{month:1,sessions:10,purchases:null,revenue:0,seoClicks:0,seoImpressions:10},
    {month:2,sessions:20,purchases:1,revenue:50,seoClicks:2,seoImpressions:null},
    {month:4,sessions:30,purchases:2,revenue:100,seoClicks:3,seoImpressions:100}];
  assert.equal(historyCumulative(rows,"sessions")[2],30);
  assert.equal(historyCumulative(rows,"purchases")[1],null);
  assert.equal(historyCumulative(rows,"purchases")[2],null);
  assert.equal(historyCumulative(rows,"revenue")[1],0);
  assert.equal(historyCumulative(rows,"conversionRate")[2],null);
  assert.equal(historyCumulative(rows,"seoCtr")[1],0);
  assert.equal(historyCumulative(rows,"seoCtr")[2],null);
  assert.equal(historyCumulative(rows,"sessions")[4],null);
});

test("source dates in collector never borrow fetch time or global latest outside the period", async () => {
  assert.equal(periodSourceDate("2026-10-22",meta.from,meta.to),null);
  assert.equal(periodSourceDate("2026-10-16",meta.from,meta.to),"2026-10-16");
  const input=await collectInput(async name=> name==="bi_digital_payload" ? {
    meta:{...meta,ga4Latest:"2026-10-22",searchLatest:"2026-10-16",currentGa4Rows:0},
    current:{sessions:0,purchases:0},seo:{clicks:1,impressions:10}
  } : {},"2026-10-22T12:00:00Z");
  assert.equal(input.evidence.find(e=>e.id==="ga4.sessions").source_date,null);
  assert.equal(input.evidence.find(e=>e.id==="ga4.sessions").value,null);
  assert.equal(input.evidence.find(e=>e.id==="gsc.clicks").source_date,"2026-10-16");
  assert.ok(input.evidence.every(e=>e.observed_at===null&&e.fetched_at==="2026-10-22T12:00:00Z"));
});

test("history preserves missing metrics/quality and requires actual calendar identifiers", () => {
  const h=normalizeDigitalHistory({meta:{currentYear:2026,cutoffMonth:10,cutoffDay:17},
    monthly:[{year:2026,month:1,sessions:10,purchases:null,revenue:0,seoClicks:0,seoImpressions:10}],
    quality:{ga4:{rows:0,last7Sessions:0,last7Purchases:0}}});
  assert.equal(h.monthly[0].partial,null);
  assert.equal(h.monthly[0].purchases,null);
  assert.equal(h.monthly[0].revenue,0);
  assert.equal(h.monthly[0].conversionRate,null);
  assert.equal(h.monthly[0].seoCtr,0);
  assert.equal(h.quality.ga4.last7Sessions,null);
  assert.throws(()=>normalizeDigitalHistory({}),/calendar metadata unavailable/);
});

test("prepared SQL stays outside migrations and retains auth gates and rollback; static only", () => {
  const sql=readFileSync(new URL("../../docs/sql/issue-12-digital-correctness-NOT-APPLIED.sql",import.meta.url),"utf8");
  assert.match(sql,/NOT APPLIED/);
  assert.match(sql,/rollback;\s*$/);
  assert.doesNotMatch(sql,/sum\(active_users\)|coalesce\(sum\(|then 0 else/);
  assert.match(sql,/'ga4Present',g.date_id is not null/);
  assert.match(sql,/'currentGa4Rows',\(select count\(\*\).*between v_from and v_to/);
  assert.equal((sql.match(/raise exception 'unauthorized'/g)||[]).length,3);
  assert.match(sql,/revoke all on function public.bi_digital_payload/);
});
