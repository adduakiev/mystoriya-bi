import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeApp } from '../lib/data/app-contract.ts';
import { metricRatio, formatMetric } from '../lib/digital-quality.ts';
import { currencyEvidence, sourceMoney, presenceStatus } from '../lib/source-evidence.ts';

test('App money follows source currency; missing/conflicting currencies never become UAH', () => {
  for (const currency of ['USD','EUR','UAH']) {
    const row=normalizeApp({googleAdsApp:[{currency,spend:100,conversions:4,conversion_value:0}]}).googleAdsApp[0];
    assert.equal(row.currency,currency);
    assert.equal(sourceMoney(row.spend,row),`${currency} 100`);
    assert.equal(sourceMoney(row.costPerConversion,row),`${currency} 25`);
    assert.equal(sourceMoney(row.conversionValue,row),`${currency} 0`);
  }
  for(const raw of [{},{currency:null},{currency:'usd'},{currency:'XXX'},{currencies:['USD',null]}]) {
    const e=currencyEvidence(raw);
    assert.equal(e.currencyStatus,'UNKNOWN');
    assert.equal(sourceMoney(0,e),'— · currency UNKNOWN');
  }
  for(const raw of [{currencies:['USD','UAH']},{currency:'USD',account_currency:'EUR'}]){
    assert.equal(currencyEvidence(raw).currencyStatus,'MULTI');
    assert.equal(sourceMoney(100,currencyEvidence(raw)),'— · currencies MULTI');
  }
  const data=normalizeApp({meta:{currency:'UAH'},googleAdsApp:[{spend:100},{currency:'USD',spend:20}]});
  assert.equal(data.googleAdsApp[0].currency,null,'another payload section cannot prove campaign currency');
  assert.equal(data.googleAdsApp[1].currency,'USD');
  assert.equal(sourceMoney(null,currencyEvidence({currency:'USD'})),'—');
});

test('source presence never implies LIVE or completeness; all App campaigns are rendered',()=>{
  assert.equal(presenceStatus(1),'PARTIAL');
  assert.equal(presenceStatus(0),'WAITING');
  for(const value of [null,undefined,-1,'bad'])assert.equal(presenceStatus(value),'UNKNOWN');
  for(const route of ['','app/','tracking/','local/','commerce/','channels/','site/']){
    const page=fs.readFileSync(new URL(`../app/digital/${route}page.tsx`,import.meta.url),'utf8');
    assert.doesNotMatch(page,/\bLIVE\b|· live/);
  }
  const page=fs.readFileSync(new URL('../app/digital/app/page.tsx',import.meta.url),'utf8');
  assert.match(page,/data.googleAdsApp.map/);
  assert.doesNotMatch(page,/googleAdsApp.find|₴/);
  const merchant=fs.readFileSync(new URL('../app/digital/commerce/page.tsx',import.meta.url),'utf8');
  assert.match(merchant,/const performanceReady=\(data.meta.performanceRows\?\?0\)>0/);
  assert.doesNotMatch(merchant,/hasRows\?n\(p\./);
});

test('App preserves missing metrics even when a source has rows; measured zero survives', () => {
  const data = normalizeApp({sources:{store:{rows:2}}, overview:{downloads:null,firstOpens:0},
    economics:{spend:0,installs:10}, googleAdsApp:[{spend:null,conversions:0,cost_per_conversion:0}]});
  assert.equal(data.sources.store.rows,2);
  assert.equal(data.sources.orders.rows,null);
  assert.equal(data.overview.downloads,null);
  assert.equal(data.overview.firstOpens,0);
  assert.equal(formatMetric(data.overview.downloads),'—');
  assert.equal(formatMetric(data.overview.firstOpens),'0');
  assert.equal(metricRatio(data.economics.spend,data.economics.installs),0);
  assert.equal(data.googleAdsApp[0].spend,null);
  assert.equal(data.googleAdsApp[0].costPerConversion,null);
  for (const value of [null, undefined, '', false, 'bad', Infinity]) {
    const invalid=normalizeApp({economics:{spend:value},overview:{downloads:value}});
    assert.equal(invalid.economics.spend,null);
    assert.equal(invalid.overview.downloads,null);
  }
});

test('App CPA and acquisition ratios are undefined without a positive denominator', () => {
  for (const conversions of [0,null,undefined]) {
    const data=normalizeApp({googleAdsApp:[{spend:100,conversions,cost_per_conversion:0}]});
    assert.equal(data.googleAdsApp[0].costPerConversion,null);
    assert.equal(metricRatio(100,conversions),null);
  }
  assert.equal(normalizeApp({googleAdsApp:[{spend:100,conversions:4}]}).googleAdsApp[0].costPerConversion,25);
  assert.equal(normalizeApp({googleAdsApp:[{spend:0,conversions:4}]}).googleAdsApp[0].costPerConversion,0);
  const page=fs.readFileSync(new URL('../app/digital/app/page.tsx',import.meta.url),'utf8');
  assert.ok(page.includes('metricRatio(e.spend,e.installs)'));
  assert.ok(page.includes('roas!==null'));
  assert.ok(!page.includes('function ratio('));
});

test('Tracking does not present a historical hard-coded App count or scheduler assertion as current evidence', () => {
  const page=fs.readFileSync(new URL('../app/digital/tracking/page.tsx',import.meta.url),'utf8');
  assert.ok(!page.includes('0 рядків за 01.01.2025–14.10.2026'));
  assert.ok(!page.includes('Google daily sync уже автоматизований'));
  assert.ok(!page.includes('app telemetry зараз не надходить'));
  assert.ok(page.includes('UNKNOWN · актуальну кількість рядків'));
});

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('audit inventories are reproducible and cover every current page/API route', () => {
  for(const script of ['bi-audit-inventory.mjs','bi-audit-queries.mjs']){
    const result=spawnSync(process.execPath,[`scripts/${script}`,'--check'],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  }
  const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/2026-10-24/inventory.json'),'utf8'));
  const pages=fs.readdirSync(path.join(root,'web/app'),{recursive:true}).filter(f=>f.endsWith('page.tsx'));
  const api=fs.readdirSync(path.join(root,'web/app'),{recursive:true}).filter(f=>f.endsWith('route.ts'));
  assert.equal(audit.routes.length,pages.length);
  assert.equal(audit.api.length,api.length);
  assert.equal(new Set(audit.items.map(i=>i.id)).size,audit.items.length);
  for(const route of audit.routes){
    assert.ok(audit.items.some(i=>i.paths.includes(route.path)&&i.component===route.page));
    assert.equal(route.runtime_parity,'UNKNOWN');
    for(const name of route.rpc)assert.ok(audit.sql_definitions[name],`Missing SQL definition ${name}`);
  }
  assert.ok(audit.items.some(i=>i.component==='web/components/DataSyncControl.tsx'));
  assert.ok(audit.items.some(i=>i.component==='web/components/NavigationFeedback.tsx'));
  for(const i of audit.items){assert.ok(i.paths.length);assert.ok(i.evidence);}
  assert.equal(audit.schema_version,2);
  assert.ok(fs.statSync(path.join(root,'docs/audit/2026-10-24/inventory.json')).size<600000);
  const shared=audit.items.filter(i=>i.component==='web/components/DataSyncControl.tsx');
  assert.ok(shared.some(i=>i.paths.length>1));
  const download=audit.items.find(i=>i.component==='web/app/digital/app/page.tsx'&&i.displayed_kpi_definition.includes('Downloads'));
  assert.ok(download,'enclosing KPI blocks retain child text labels');
  assert.ok(download.bindings.some(b=>b.includes('o.downloads')),'KPI values retain actual UI bindings');
});

test('prepared data QA runs in a read-only transaction and does not invoke business functions', () => {
  const sql=fs.readFileSync(path.join(root,'docs/audit/2026-10-24/read-only-qa.sql'),'utf8');
  const statements=sql.replace(/^--.*$/gm,'');
  assert.ok(statements.includes('BEGIN TRANSACTION READ ONLY;'));
  assert.ok(statements.trimEnd().endsWith('ROLLBACK;'));
  assert.ok(!/\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|call|do)\b/i.test(statements));
  assert.ok(sql.includes("ingestion_source='windsor_facebook' AND adset_id='' AND ad_id=''"));
  assert.ok(sql.includes("DATE '2026-09-24'"));
  assert.ok(sql.includes("DATE '2025-10-24'"));
});

test('independent production evidence retains observer, bounded Meta scope and unknown parity across artifacts', () => {
  const dir=path.join(root,'docs/audit/2026-10-24');
  const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  const receipt=read('barbara-production-evidence.json');
  assert.equal(receipt.provenance.observer,'Barbara');
  assert.equal(receipt.provenance.runner_executed,false);
  assert.equal(receipt.runner_production_sql_execution,'NOT_EXECUTED');
  const meta=receipt.observations.find(o=>o.id==='B01');
  assert.deepEqual([meta.window.from,meta.window.to,meta.row_count,meta.observed_dates],['2026-09-24','2026-10-23',138,25]);
  assert.match(meta.raw_curated_parity,/^UNKNOWN/);
  assert.deepEqual(meta.relation_specific_counts,{staging_meta_ads_windsor:138,staging_meta_ads_daily:138});
  assert.deepEqual(meta.metric_totals,{raw_spend:1311.75,curated_spend:1311.75,currency:'UNKNOWN'});
  assert.equal(meta.upstream_parity,'UNKNOWN');
  assert.equal(meta.rpc_ui_parity,'UNKNOWN');
  const rolling=receipt.separate_gate_d_scope;
  assert.deepEqual([rolling.from,rolling.to,rolling.raw_row_count,rolling.curated_row_count,rolling.observed_dates],['2026-09-25','2026-10-24',145,145,26]);
  const register=read('source-register.json');
  const stored=register.sources.find(s=>s.id==='meta_ads');
  assert.equal(stored.warehouse_observations[0].row_count,meta.row_count);
  assert.equal(stored.warehouse_observations[0].observed_dates,meta.observed_dates);
  assert.equal(stored.baseline_scope.raw_row_count,rolling.raw_row_count);
  // Bounded counts must not overwrite all-history/source-event fields.
  assert.equal(stored.actual_row_count,null);
  assert.equal(stored.actual_latest_event_time,null);
  assert.equal(stored.upstream_warehouse_rpc_ui_reconciliation,'UNKNOWN');
  const csv=fs.readFileSync(path.join(dir,'coverage.csv'),'utf8').trim().split(/\r?\n/);
  const headers=csv.shift().split(',');
  const rows=csv.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[headers[i],v])));
  const current=rows.find(r=>r.source==='meta_ads'&&r.window==='current30');
  assert.equal(current.row_count,String(meta.row_count));
  assert.equal(current.observed_dates,String(meta.observed_dates));
  assert.equal(current.evidence_observer,'Barbara independent SELECT-only');
  for(const row of rows){
    for(const key of ['upstream_total','warehouse_total','rpc_total','rendered_ui_total'])assert.equal(row[key],'UNKNOWN');
    if(row.window!=='current30'||!['ga4','gsc','meta_ads'].includes(row.source))assert.equal(row.row_count,'UNKNOWN','unsupplied production counts cannot be inferred');
  }
  for(const [source,count,dates] of [['ga4',30,30],['gsc',28,28]]){
    const observation=receipt.observations.find(o=>o.source===source);
    const coverage=rows.find(r=>r.source===source&&r.window==='current30');
    assert.equal(observation.row_count,count);
    assert.equal(observation.observed_dates,dates);
    assert.equal(observation.date_column,'date_id');
    assert.equal(observation.null_key_metric_rows,0);
    assert.equal(coverage.row_count,String(count));
    assert.equal(coverage.observed_dates,String(dates));
    assert.equal(coverage.null_key_metric_rows,'0');
    const sourceRecord=register.sources.find(s=>s.id===source);
    assert.equal(sourceRecord.warehouse_observations[0].row_count,count);
    assert.equal(sourceRecord.actual_latest_event_time,null);
  }
  assert.equal(current.raw_spend,'1311.75');
  assert.equal(current.curated_spend,'1311.75');
  assert.equal(current.source_currency,'UNKNOWN');
  const summary=read('reviewer-evidence.json');
  assert.equal(summary.observer,'Barbara');
  assert.equal(summary.stored_checks.exact_results.meta_ads.raw_rows,138);
  assert.equal(summary.stored_checks.exact_results.ga4.null_key_metric_rows,0);
  assert.equal(summary.parity.upstream,'UNKNOWN');
  const currency=receipt.observations.find(o=>o.id==='B02');
  assert.deepEqual(currency.present_columns,['account_id','campaign_id','date']);
  assert.deepEqual(currency.absent_columns,['currency','account_currency','currency_code']);
  assert.equal(currency.currency_column_present,false);
  assert.equal(currency.rpc_currency_exposed,false);
  assert.equal(currency.app_ads_money_status,'UNKNOWN');
  assert.equal(currency.currency,'UNKNOWN');
  const campaign=normalizeApp({googleAdsApp:[{spend:100,conversions:5}]}).googleAdsApp[0];
  assert.equal(sourceMoney(campaign.spend,campaign),'— · currency UNKNOWN');
  assert.equal(sourceMoney(campaign.costPerConversion,campaign),'— · currency UNKNOWN');
  for(const id of ['google_ads','app_acquisition']){
    assert.equal(register.sources.find(s=>s.id===id).app_ads_currency_contract.money_status,'UNKNOWN');
  }
});

test('READY Preview build does not imply browser PASS; every D04-D11 has an actionable gated follow-up',()=>{
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,'docs/audit/2026-10-24',name),'utf8'));
  const browser=read('browser-qa.json');
  assert.equal(browser.status,'NOT_VERIFIED');
  assert.equal(browser.preview_evidence.deployment_state,'READY');
  assert.equal(browser.preview_evidence.protected_preview_http_status,403);
  assert.equal(browser.preview_evidence.protection_or_credentials_changed,false);
  assert.equal(browser.observed_browser_navigations,0);
  assert.deepEqual(browser.screenshots,[]);
  assert.ok(browser.cases.every(c=>c.status==='NOT_EXECUTED'));
  const plan=read('follow-up-plan.json');
  const findings=read('discrepancies.json').filter(f=>['D04','D05','D06','D07','D08','D09','D10','D11'].includes(f.id));
  assert.equal(plan.tasks.length,findings.length);
  for(const finding of findings){
    const task=plan.tasks.find(t=>t.finding===finding.id);
    assert.ok(task,finding.id);
    assert.equal(task.status,'OPEN');
    assert.equal(task.severity,finding.severity);
    assert.equal(task.db_source_changes_in_this_revision,false);
    assert.ok(task.proposed_owner.length>10);
    assert.ok(plan.gates[task.gate_classification]);
    assert.ok(task.minimal_acceptance_criteria.length>=3);
    assert.ok(task.subsequent_gates.includes('RELEASE'));
    assert.ok(task.subsequent_gates.every(g=>plan.gates[g]));
    assert.equal(finding.follow_up_task,`follow-up-plan.json#${task.id}`);
  }
});
