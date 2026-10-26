import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildContracts, extractFunctions, compareMetadata, compareCaller, grainDiagnostics} from '../../scripts/bi-audit-contracts.mjs';
import {overviewRpcArgs, digitalPeriodRpcArgs} from '../lib/data/rpc-parameters.ts';
import {normalizeApp} from '../lib/data/app-contract.ts';
import {normalizeDigital} from '../lib/data/digital-contract.ts';
import {normalizeMetaAds} from '../lib/data/meta-social-contract.ts';
import {currencyEvidence, sourceMoney} from '../lib/source-evidence.ts';
const root = new URL('../../',import.meta.url);
const read = path => fs.readFileSync(new URL(path,root),'utf8');
const contracts = buildContracts();
const byId = id => contracts.contracts.find(c => c.id === id);

test('representative KPI contracts are reproducible, hashed, and never claim deployed definition parity', () => {
  const result = spawnSync(process.execPath,['scripts/bi-audit-contracts.mjs','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(contracts.contracts.map(c => c.id),['sales','ga4','gsc','meta','google_ads_app','merchant']);
  assert.equal(contracts.reviewer_metadata.exact_deployed_signatures,'NOT_SUPPLIED');
  for (const c of contracts.contracts) {
    assert.equal(c.repository.volatility,'VOLATILE');
    assert.equal(c.repository.volatility_basis,'POSTGRESQL_DEFAULT');
    assert.equal(c.repository.security_definer,true);
    assert.equal(c.comparison.deployed_definition_parity,'UNKNOWN');
    assert.equal(c.comparison.metadata_comparison,'MATCH_ON_REPORTED_FIELDS_ONLY');
    assert.equal(c.business_timezone,'UNKNOWN');
    assert.equal(c.upstream_completeness,'UNKNOWN');
    assert.match(c.repository.repository_definition_sha256,/^[a-f0-9]{64}$/);
    for (const file of c.static_evidence) assert.match(file.file_sha256,/^[a-f0-9]{64}$/);
  }
  assert.match(read(byId('sales').ui),/snapshot.kpis.map/);
  assert.match(read(byId('ga4').ui),/c.sessions/);
  assert.match(read(byId('gsc').ui),/s.ctr/);
  assert.match(read(byId('meta').ui),/meta.summary.spend/);
  assert.match(read(byId('google_ads_app').ui),/money\(row.spend,row\)/);
  assert.match(read(byId('merchant').ui),/performanceReady\?n\(p.impressions\)/);
});

test('metadata mismatches and unsupported caller signatures fail independently of body parity', () => {
  const fn = byId('ga4').repository;
  assert.deepEqual(compareCaller(fn,['p_password','p_from','p_to']),{unsupported:[],missing_required:[]});
  assert.deepEqual(compareCaller(byId('google_ads_app').repository,['p_password','p_from','p_to']),
    {unsupported:['p_from','p_to'],missing_required:[]});
  assert.deepEqual(compareCaller(fn,[]).missing_required,['p_password']);
  for (const [field,value] of [['volatility','STABLE'],['security_definer',false],['parameters',[]]]) {
    const compared=compareMetadata(fn,{[field]:value});
    assert.equal(compared.metadata_comparison,'MISMATCH');
    assert.deepEqual(compared.mismatches,[field]);
    assert.equal(compared.deployed_definition_parity,'UNKNOWN');
  }
  const parsed=extractFunctions('CREATE OR REPLACE FUNCTION public.bi_test_payload(p_password text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT null::jsonb $$;')[0];
  assert.equal(parsed.volatility,'STABLE');
  assert.equal(parsed.security_definer,false);
});

test('actual Sales and Digital caller mappings preserve periods and every selected filter', () => {
  const query={channel:'fixture-channel',orderType:'fixture-order',location:'fixture-store',brand:'fixture-brand',
    ownership:'fixture-owner',year:2026,month:9,period:'month',compare:'previous',metric:'checks',grain:'week',lfl:true};
  const args=overviewRpcArgs(query);
  assert.deepEqual(args,{p_channel:query.channel,p_order_type:query.orderType,p_location:query.location,
    p_brand:query.brand,p_ownership:query.ownership,p_focus_year:2026,p_focus_month:9,p_period:'month',
    p_comparison:'previous',p_metric:'checks',p_grain:'week',p_lfl:true});
  assert.deepEqual(compareCaller(byId('sales').repository,['p_password',...Object.keys(args)]),{unsupported:[],missing_required:[]});
  assert.equal(overviewRpcArgs({...query,brand:undefined,lfl:false}).p_brand,null);
  assert.equal(overviewRpcArgs({...query,lfl:false}).p_lfl,false);
  for (const [from,to] of [['2026-09-24','2026-10-23'],['2026-08-25','2026-09-23'],['2025-10-24','2026-10-23']]) {
    assert.deepEqual(digitalPeriodRpcArgs(from,to),{p_from:from,p_to:to});
  }
  assert.deepEqual(digitalPeriodRpcArgs('',''),{});
  assert.deepEqual(digitalPeriodRpcArgs('','2026-10-23'),{p_to:'2026-10-23'});
  assert.match(read('web/lib/data/overview.ts'),/overviewRpcArgs\(query\)/);
  assert.match(read('web/lib/data/digital.ts'),/digitalPeriodRpcArgs\(from, to\)/);
  // Default/latest-only sources must not be described as accepting this selected range.
  const loaders=read('web/lib/data/digital-sources.ts');
  for (const rpc of ['bi_digital_app_payload','bi_digital_merchant_payload','bi_digital_meta_ads_payload']) {
    assert.ok(loaders.includes(`callBiRpc<Raw>("${rpc}")`));
    assert.deepEqual(byId(rpc.includes('merchant')?'merchant':rpc.includes('meta')?'meta':'google_ads_app').repository.parameters.map(p=>p.name),['p_password']);
  }
});

test('App SQL grouping demonstrably loses account/campaign/date/currency grain; never aggregate fixture money', () => {
  const body=extractFunctions(read(byId('google_ads_app').repository.path)).find(f=>f.name==='bi_digital_app_payload').body;
  const ads=body.slice(body.indexOf('into v_ads'),body.indexOf('into v_sources'));
  assert.match(ads,/from public.staging_google_ads_windsor/);
  assert.match(ads,/group by 1,2/);
  assert.doesNotMatch(ads,/\b(account_id|campaign_id|account_currency|currency_code)\b/);
  const base={account_id:'fixture-a',campaign_id:'fixture-c',date:'2026-09-24',account_currency:'USD',platform:'ios',campaign_name:'app_ios_fixture'};
  const rows=[base,{...base,account_id:'fixture-b'},{...base,campaign_id:'fixture-d'},
    {...base,date:'2026-09-25'},{...base,account_currency:'EUR'}];
  const grain=['account_id','campaign_id','date','account_currency'];
  assert.equal(grainDiagnostics(rows,grain).duplicate_key_excess,0);
  assert.equal(grainDiagnostics(rows,['platform','campaign_name']).duplicate_key_excess,4);
  assert.equal(grainDiagnostics([...rows,base],grain).duplicate_key_excess,1);
  assert.equal(grainDiagnostics([{...base,account_currency:null}],grain).unknown_key_rows,1);
  const app=normalizeApp({googleAdsApp:[{campaign_name:base.campaign_name,spend:10,conversions:1}]});
  assert.equal(app.googleAdsApp[0].accountId,null);
  assert.equal(sourceMoney(app.googleAdsApp[0].spend,app.googleAdsApp[0]),'— · currency UNKNOWN');
});

test('unsupported currencies and unverified attribution never produce App money or Meta ROAS', () => {
  for (const currency of ['ZZZ','AAA','XXX','XTS','usd',null]) {
    assert.equal(currencyEvidence({currency}).currencyStatus,'UNKNOWN');
    const row=normalizeApp({googleAdsApp:[{currency,spend:0,conversions:1,conversion_value:0}]}).googleAdsApp[0];
    assert.equal(sourceMoney(row.spend,row),'— · currency UNKNOWN');
    const meta=normalizeMetaAds({meta:{contractVersion:3,from:'2026-09-24',to:'2026-10-23',latest:'2026-10-23',rows:1,currency,attributionVerified:true},
      summary:{spend:10,purchaseValue:20}},'2026-10-24');
    assert.equal(meta.summary.spend,null);
    assert.equal(meta.summary.roas,null);
  }
  const meta=normalizeMetaAds({meta:{contractVersion:3,from:'2026-09-24',to:'2026-10-23',latest:'2026-10-23',rows:1,currency:'USD',attributionVerified:false},
    summary:{spend:10,purchaseValue:20}},'2026-10-24');
  assert.equal(meta.summary.spend,10);
  assert.equal(meta.summary.roas,null);
  assert.equal(currencyEvidence({currency:'USD',account_currency:'EUR'}).currencyStatus,'MULTI');
});

test('GA4/GSC selected empty, null and zero fields remain distinct in the adapter', () => {
  const meta={from:'2026-09-24',to:'2026-10-23',previousFrom:'2026-08-25',previousTo:'2026-09-23',currentGa4Rows:1,currentSearchRows:1};
  const data=normalizeDigital({meta,current:{sessions:0,purchases:0,purchaseRevenue:null},seo:{clicks:0,impressions:10}});
  assert.equal(data.current.sessions,0);
  assert.equal(data.current.purchaseRevenue,null);
  assert.equal(data.current.averageOrderValue,null);
  assert.equal(data.seo.ctr,0);
  const empty=normalizeDigital({meta:{...meta,currentGa4Rows:0,currentSearchRows:0},current:{sessions:0},seo:{clicks:0,impressions:1}});
  assert.equal(empty.current.sessions,null);
  assert.equal(empty.seo.clicks,null);
  assert.equal(data.meta.previousFrom,'2026-08-25');
});

test('audit SQL performs catalog SELECT only and cannot invoke payload or credential functions', () => {
  const sql=read('docs/audit/2026-10-24/rpc-read-only-qa.sql').replace(/--[^\n]*/g,'');
  assert.match(sql,/BEGIN TRANSACTION READ ONLY/);
  assert.match(sql,/pg_catalog.pg_proc/);
  assert.doesNotMatch(sql,/\bpublic\.\w+\s*\(|\bbi_\w+\s*\(|current_setting|set_config|password|\b(insert|update|delete|create|alter|call|do|grant|revoke)\b/i);
  assert.match(sql,/ROLLBACK;\s*$/);
});
