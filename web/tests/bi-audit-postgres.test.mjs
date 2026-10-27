import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {specs} from '../../scripts/bi-audit-queries.mjs';

const root=new URL('../../',import.meta.url);
// Extract column names/types from repository DDL, without applying any migration.
const catalog=new Map();
const renames=[],additions=[];
for(const file of ['supabase/schema.sql',...fs.readdirSync(new URL('supabase/migrations/',root)).sort().map(n=>`supabase/migrations/${n}`)]){
  const sql=fs.readFileSync(new URL(file,root),'utf8').replace(/--[^\n]*/g,'');
  for(const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi)){
    if(catalog.has(m[1]))continue;
    const columns=new Map();let depth=0,part='';
    for(const c of m[2]+','){
      if(c==='(')depth++;if(c===')')depth--;
      if(c===','&&depth===0){
        const col=part.trim().match(/^(\w+)\s+(date|text|numeric|bigint|integer|int|uuid|timestamptz|timestamp|boolean)\b/i);
        if(col)columns.set(col[1],col[2]);part='';
      }else part+=c;
    }
    catalog.set(m[1],columns);
  }
  for(const block of sql.matchAll(/alter\s+table\s+public\.(\w+)\s+([\s\S]*?);/gi)){
    for(const m of block[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+(text|numeric|boolean|timestamptz|date|integer|bigint)/gi))additions.push([block[1],m[1],m[2]]);
  }

  for(const m of sql.matchAll(/alter\s+table\s+public\.(\w+)\s+rename\s+column\s+(\w+)\s+to\s+(\w+)/gi)){
    renames.push(m);
  }
}

for(const m of renames){const cols=catalog.get(m[1]);if(cols?.has(m[2])){cols.set(m[3],cols.get(m[2]));cols.delete(m[2]);}}

for(const [table,name,type] of additions)catalog.get(table)?.set(name,type);

test('audit field/key/date names exist in repository table contracts',()=>{
  for(const [table,date,keys,fields] of specs){
    assert.ok(catalog.has(table),table);
    for(const field of [date,...keys.split(' '),...fields.split(' ').filter(Boolean)])
      assert.ok(catalog.get(table).has(field),`${table}.${field} missing; JSON extraction must not hide a typo`);
  }
});

const adsQuery=fs.readFileSync(new URL('docs/audit/2026-10-24/google-ads-daily-reconciliation.sql',root),'utf8');
test('dated Ads SELECT uses aligned schema and NULL-aware daily joins, never a payload RPC',()=>{
  const raw=catalog.get('staging_google_ads_windsor');
  const curated=catalog.get('digital_google_ads_daily');
  for(const field of ['date','account_id','campaign_id','cost','clicks','impressions','conversions','conversions_value'])
    assert.ok(raw.has(field),`raw ${field}`);
  for(const field of ['date_id','cost','clicks','impressions','conversions','conversion_value'])
    assert.ok(curated.has(field),`curated ${field}`);
  assert.equal(raw.has('date_id'),false);
  assert.equal([...raw.keys()].some(c=>c.includes('currency')),false);
  const sql=adsQuery.replace(/--[^\n]*/g,'');
  assert.match(sql,/DATE '2026-10-12'[\s\S]*DATE '2026-10-24'/);
  assert.match(sql,/public\.staging_google_ads_windsor r/);
  assert.match(sql,/public\.digital_google_ads_daily c/);
  assert.match(sql,/sum\(conversions_value\) AS conversion_value/);
  assert.match(sql,/FULL OUTER JOIN curated_daily c ON r\.date = c\.date_id/);
  assert.match(sql,/GROUP BY date, account_id, campaign_id HAVING count\(\*\) > 1/);
  assert.equal((sql.match(/IS DISTINCT FROM/g)??[]).length,5);
  assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|create|alter|drop|grant|revoke|call|do|set|copy)\b|public\.\w+\s*\(|\bbi_\w+\s*\(/i);
  assert.equal((sql.match(/;/g)??[]).length,1,'single SELECT, no session changes');
});

const pgBin=['/usr/lib/postgresql/16/bin','/usr/local/pgsql/bin'].find(p=>fs.existsSync(path.join(p,'initdb')));
test('SELECT diagnostics execute on disposable PostgreSQL: gaps, duplicates, nulls, freshness and currency',
  {skip:!pgBin||process.getuid?.()===0?'requires local PostgreSQL and non-root user':false},()=>{
  const dir=fs.mkdtempSync(path.join(tmpdir(),'bi-audit-pg-'));
  const run=(binary,args,input)=>{
    let fd;
    if(input){const file=path.join(dir,'input.sql');fs.writeFileSync(file,input);fd=fs.openSync(file,'r');}
    const r=spawnSync(path.join(pgBin,binary),args,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,stdio:[fd??'ignore','pipe','pipe']});
    if(fd!==undefined)fs.closeSync(fd);
    assert.equal(r.status,0,`${binary}: ${r.error??''}\n${r.stderr}`);
    assert.deepEqual((r.stdout+r.stderr).split('\n').filter(l=>/(?:ERROR|FATAL|PANIC):/.test(l)),[]);
    return r.stdout;
  };
  try{
    run('initdb',['-D',path.join(dir,'data'),'-A','trust','--no-locale','-U','audit_fixture']);
    // Synthetic tables deliberately omit constraints so defects can be injected.
    // No schema migration, network, existing server, auth changes or real business data.
    let setup=specs.map(([table])=>`CREATE TABLE public.${table} (${[...catalog.get(table)].map(([n,t])=>`${n} ${t}`).join(',')});`).join('\n');
    setup+=`
      INSERT INTO digital_ga4_daily(date_id,sessions,purchases,purchase_revenue) VALUES
        ('2026-09-24',0,NULL,NULL),('2026-09-24',10,1,10),('2026-10-23',20,2,20),
        ('2026-08-25',7,1,10),('2025-10-23',999,999,999),('2026-10-24',999,999,999),(NULL,8,1,10);
      INSERT INTO staging_meta_ads_windsor(date,account_id,campaign_id,spend,account_currency)
        VALUES ('2026-09-24','fixture-a','fixture-c',10,'USD'),('2026-09-25','fixture-a','fixture-d',20,'EUR');
      INSERT INTO staging_ga4_daily_windsor(date,sessions,ecommerce_purchases,purchase_revenue)
        VALUES ('2026-09-24',10,1,10);
      INSERT INTO staging_app_acquisition_daily(date,platform,source,campaign,spend)
        VALUES ('2026-09-24','ios','fixture',NULL,0);
    `;
    const input=setup.replace(/\n/g,' ')+'\n\n';
    run('postgres',['--single','-D',path.join(dir,'data'),'-j','postgres'],input);
    const qa=fs.readFileSync(new URL('docs/audit/2026-10-24/read-only-qa.sql',root),'utf8');
    const output=run('postgres',['--single','-D',path.join(dir,'data'),'-j','postgres'],qa.replace(/--[^\n]*/g,'').replace(/\n/g,' ')+'\n\n');
    const results=output.split('\n').filter(l=>l.includes('"relation":')).map(line=>{
      const start=line.indexOf('{'),end=line.lastIndexOf('}');return JSON.parse(line.slice(start,end+1));
    });
    assert.equal(results.length,specs.length);
    assert.doesNotMatch(output,/column_name =/, 'schema preflight must return no missing columns');
    const mappings=output.split('\n').filter(l=>l.includes('"check_name":')).map(line=>JSON.parse(line.slice(line.indexOf('{'),line.lastIndexOf('}')+1)));
    assert.equal(mappings.length,4);
    const mappedGa4=mappings.find(m=>m.check_name==='ga4_raw_curated_current30');
    assert.equal(mappedGa4.joined_rows,3);
    assert.equal(mappedGa4.mismatch_rows,2);
    assert.equal(mappedGa4.unknown_field_rows,1);
    assert.ok(mappings.every(m=>m.upstream_completeness==='UNKNOWN'));
    const ga4=results.find(r=>r.relation==='digital_ga4_daily');
    assert.equal(ga4.bounded_12month_range.rows,4,'out-of-window and undated rows excluded');
    assert.equal(ga4.null_date_probe_rows_capped_1001,1);
    const current=ga4.coverage.find(c=>c.period==='current30');
    assert.equal(current.rows,3);assert.equal(current.observed_dates,2);
    assert.equal(current.duplicate_key_excess,1);assert.equal(current.missing_dates.length,28);
    assert.equal(current.event_age_days_at_cutoff,1);
    const purchases=ga4.metrics.find(m=>m.period==='current30'&&m.metric==='purchases');
    assert.equal(purchases.unknown_rows,1);assert.equal(purchases.known_value_sum,3);
    assert.equal(purchases.complete_stored_total,null);
    const sessions=ga4.metrics.find(m=>m.period==='current30'&&m.metric==='sessions');
    assert.equal(sessions.complete_stored_total,30,'measured zero is retained');
    const meta=results.find(r=>r.relation==='staging_meta_ads_windsor');
    assert.deepEqual(meta.metrics.filter(m=>m.period==='current30'&&m.metric==='spend').map(m=>m.currency).sort(),['EUR','USD']);
    const app=results.find(r=>r.relation==='staging_app_acquisition_daily');
    assert.equal(app.coverage.find(c=>c.period==='current30').unknown_key_rows,1);
    const empty=results.find(r=>r.relation==='staging_app_orders');
    assert.equal(empty.coverage.find(c=>c.period==='current30').rows,0);
    assert.ok(empty.metrics.every(m=>m.complete_stored_total===null));
    assert.match(output,/transaction_read_only.*on/);
    // Current audit forbids invoking VOLATILE/SECURITY DEFINER payloads even
    // inside READ ONLY. Only catalog inspection is retained here.
    const metadata=fs.readFileSync(new URL('docs/audit/2026-10-24/rpc-read-only-qa.sql',root),'utf8');
    const catalogResult=run('postgres',['--single','-D',path.join(dir,'data'),'-j','postgres'],
      metadata.replace(/--[^\n]*/g,'').replace(/\n/g,' ')+'\n\n');
    assert.doesNotMatch(catalogResult,/(?:ERROR|FATAL|PANIC):/);

    // New bounded query is executed ONLY against the disposable synthetic tables.
    // Matching the reported counts here does not reproduce production business data.
    const fixture=sql=>run('postgres',['--single','-D',path.join(dir,'data'),'-j','postgres'],
      sql.replace(/--[^\n]*/g,'').replace(/\n/g,' ')+'\n\n');
    const reconcile=()=>{
      const out=fixture('BEGIN TRANSACTION READ ONLY; '+adsQuery+' ROLLBACK;');
      const line=out.split('\n').find(l=>l.includes('"check_name":'));
      assert.ok(line,out);
      const result=JSON.parse(line.slice(line.indexOf('{'),line.lastIndexOf('}')+1));
      for(const field of ['currency','account_scope_parity','conversion_action_attribution',
        'business_account_timezone','upstream_completeness','rpc_rendered_ui_parity'])assert.equal(result[field],'UNKNOWN');
      return result;
    };
    fixture(`
      INSERT INTO staging_google_ads_windsor(date,account_id,campaign_id,cost,clicks,impressions,conversions,conversions_value)
      SELECT DATE '2026-10-12'+d,'synthetic-account','synthetic-campaign-'||c,1.0001,2,3,0.5,4.0001
      FROM generate_series(0,12) d CROSS JOIN generate_series(1,12) c;
      INSERT INTO staging_google_ads_windsor(date,account_id,campaign_id,cost,clicks,impressions,conversions,conversions_value)
      VALUES ('2026-10-24','synthetic-account','extra',0,0,0,0,0),
      ('2026-10-11','synthetic-account','outside',999,999,999,999,999),
      ('2026-10-25','synthetic-account','outside',999,999,999,999,999);
      INSERT INTO digital_google_ads_daily(date_id,cost,clicks,impressions,conversions,conversion_value)
      SELECT date,sum(cost),sum(clicks),sum(impressions),sum(conversions),sum(conversions_value)
      FROM staging_google_ads_windsor GROUP BY date;
    `);
    let result=reconcile();
    assert.deepEqual([result.raw_rows,result.raw_observed_dates,result.curated_rows,result.curated_observed_dates],[157,13,13,13]);
    assert.equal(result.expected_calendar_dates,13);
    for(const key of ['missing_date_groups','mismatched_daily_aggregate_groups','duplicate_raw_key_groups',
      'duplicate_curated_date_groups','raw_unknown_metric_rows','curated_unknown_metric_rows'])assert.equal(result[key],0,key);
    // Equal whole-window totals must not hide offsetting daily defects, for ANY metric.
    for(const metric of ['cost','clicks','impressions','conversions','conversion_value']){
      fixture(`UPDATE digital_google_ads_daily SET ${metric}=${metric}+1 WHERE date_id='2026-10-12';
        UPDATE digital_google_ads_daily SET ${metric}=${metric}-1 WHERE date_id='2026-10-13';`);
      result=reconcile();
      assert.equal(result.metric_mismatch_groups[metric],2,metric);
      assert.equal(result.mismatched_daily_aggregate_groups,2);
      fixture(`UPDATE digital_google_ads_daily SET ${metric}=${metric}-1 WHERE date_id='2026-10-12';
        UPDATE digital_google_ads_daily SET ${metric}=${metric}+1 WHERE date_id='2026-10-13';`);
    }
    fixture(`DELETE FROM digital_google_ads_daily WHERE date_id='2026-10-12';
      DELETE FROM staging_google_ads_windsor WHERE date='2026-10-13';`);
    result=reconcile();
    assert.equal(result.missing_raw_date_groups,1);
    assert.equal(result.missing_curated_date_groups,1);
    assert.equal(result.missing_date_groups,2,'both missing sides detected');
    fixture(`DELETE FROM staging_google_ads_windsor; DELETE FROM digital_google_ads_daily;
      INSERT INTO staging_google_ads_windsor(date,account_id,campaign_id,cost,clicks,impressions,conversions,conversions_value)
      VALUES ('2026-10-12','synthetic','c',NULL,0,0,0,NULL);
      INSERT INTO digital_google_ads_daily(date_id,cost,clicks,impressions,conversions,conversion_value)
      VALUES ('2026-10-12',0,0,0,0,0);`);
    result=reconcile();
    assert.equal(result.metric_mismatch_groups.cost,1,'null differs from measured zero');
    assert.equal(result.metric_mismatch_groups.conversion_value,1);
    assert.equal(result.raw_unknown_metric_rows,1);
    fixture(`UPDATE digital_google_ads_daily SET cost=NULL,conversion_value=NULL;`);
    result=reconcile();
    assert.equal(result.mismatched_daily_aggregate_groups,0,'both null compare equal, still unknown');
    assert.equal(result.curated_unknown_metric_rows,1);
    fixture(`INSERT INTO staging_google_ads_windsor SELECT * FROM staging_google_ads_windsor;
      INSERT INTO staging_google_ads_windsor SELECT * FROM staging_google_ads_windsor LIMIT 1;
      INSERT INTO digital_google_ads_daily SELECT * FROM digital_google_ads_daily;`);
    result=reconcile();
    assert.equal(result.duplicate_raw_key_groups,1);
    assert.equal(result.duplicate_raw_key_excess,2,'groups are distinct from excess rows');
    assert.equal(result.duplicate_curated_date_groups,1);
    assert.equal(result.mismatched_daily_aggregate_groups,0,'matching zero/null totals cannot prove uniqueness');
    fixture(`INSERT INTO staging_google_ads_windsor(date,account_id,campaign_id,cost,clicks,impressions,conversions,conversions_value)
      VALUES ('2026-10-12',NULL,' ',0,0,0,0,0);`);
    result=reconcile();
    assert.equal(result.raw_unknown_identity_rows,1);
    assert.equal(result.raw_unknown_metric_rows,3,'SUM ignoring nulls must not imply field completeness');
    fixture('DELETE FROM staging_google_ads_windsor; DELETE FROM digital_google_ads_daily;');
    result=reconcile();
    assert.equal(result.raw_rows,0);
    assert.equal(result.curated_observed_dates,0);
    assert.equal(result.missing_date_groups,0,'empty join is not 13-date coverage');

  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
