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

  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
