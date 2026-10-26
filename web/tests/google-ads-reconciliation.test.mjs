import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeAds} from '../lib/data/digital-source-contract.ts';

const dir=new URL('../../docs/audit/2026-10-24/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const receipt=read('REVIEWER-RECEIPT-2026-10-25-6399469440.json');
const days=(from,to)=>(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000+1;

test('shifted coverage and onboarded dates never overwrite the historical window or prove source completeness',()=>{
  const current=receipt.shifted_current30;
  assert.equal(days(current.from,current.to),30);
  assert.deepEqual([current.from,current.to],['2026-09-25','2026-10-24']);
  assert.deepEqual(Object.values(current.sources).map(s=>s.observed_dates),[30,28,13]);
  const gsc=current.sources.gsc;
  assert.equal(gsc.latest_observed_date,'2026-10-22');
  const ads=current.sources.google_ads;
  assert.equal(days(ads.first_observed_date,ads.latest_observed_date),13);
  assert.equal(ads.onboarded_interval_expected_dates,13);
  assert.equal(ads.onboarded_interval_observed_dates,13);
  assert.equal(ads.pre_onboarding_calendar_dates,17);
  const old=read(receipt.historical_window.receipt);
  assert.deepEqual([old.window.from,old.window.to],['2026-09-24','2026-10-23']);
  assert.equal(days(old.window.from,old.window.to),30);
  assert.equal(old.observations.gsc.observed_dates,29);
  assert.equal(receipt.historical_window.expected_calendar_dates,30);
  const [head,...lines]=fs.readFileSync(new URL('coverage-shifted-2026-10-25.csv',dir),'utf8').trim().split('\n');
  const columns=head.split(',');
  assert.equal(lines.length,3);
  for(const line of lines){
    const row=Object.fromEntries(line.split(',').map((v,i)=>[columns[i],v]));
    const source=current.sources[row.source];
    assert.equal(row.from,current.from);
    assert.equal(row.to,current.to);
    assert.equal(Number(row.observed_dates),source.observed_dates);
    assert.equal(Number(row.missing_calendar_dates),30-source.observed_dates);
    assert.equal(row.upstream_completeness,'UNKNOWN');
    assert.equal(row.business_account_timezone,'UNKNOWN');
    assert.equal(row.evidence_reference,receipt.review_url);
  }
});

test('reported bounded parity cannot unlock Google Ads money or ROAS, even for measured zero',()=>{
  const ads=receipt.google_ads_daily;
  assert.deepEqual([ads.raw_rows,ads.raw_observed_dates,ads.curated_rows,ads.curated_observed_dates],[157,13,13,13]);
  assert.equal(days(ads.window.from,ads.window.to),13);
  assert.equal(ads.missing_date_groups,0);
  assert.equal(ads.mismatched_daily_aggregate_groups,0);
  assert.equal(ads.duplicate_raw_key_groups,0);
  assert.equal(ads.raw_unknown_metric_rows,'UNKNOWN');
  for(const value of [400,0,null]){
    const data=normalizeAds({meta:{available:true,rows:13},summary:{cost:50,conversionValue:value,clicks:0},
      campaigns:[{cost:100,conversion_value:value,conversions:0}]});
    assert.equal(data.summary.roas,null);
    assert.equal(data.campaigns[0].roas,null);
    assert.equal(data.summary.clicks,0);
  }
  for(const field of ['currency','account_scope_parity','conversion_action_attribution',
    'business_account_timezone','upstream_completeness','rpc_rendered_ui_parity',
    'shifted_prior30_coverage','shifted_trailing12months_coverage'])assert.ok(receipt.unknown_contracts.includes(field));
});

test('reviewer results and synthetic SQL validation retain distinct provenance and open browser gate',()=>{
  assert.equal(receipt.runner_executed_warehouse_sql,false);
  assert.equal(receipt.review_comment_independently_fetched,false);
  assert.equal(receipt.exact_upstream_or_query_execution_timestamp,'UNKNOWN');
  assert.match(receipt.query_status,/SYNTHETIC_LOCAL_FIXTURES_ONLY; NOT_EXECUTED_ON_WAREHOUSE/);
  const browser=read('browser-qa.json');
  assert.equal(browser.cases.reduce((n,c)=>n+c.viewport_widths.length,0),66);
  assert.ok(browser.cases.every(c=>c.status==='NOT_EXECUTED'));
  assert.equal(receipt.browser_qa.status,'NOT_EXECUTED');
  assert.match(receipt.browser_qa.gate_review_url,/#issuecomment-6398044302$/);
  assert.equal(receipt.release_readiness,'NOT_READY_FOR_GATE; bounded stored parity only');
  assert.match(read('discrepancies.json').find(d=>d.id==='D06').status,/OPEN/);
});
