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
