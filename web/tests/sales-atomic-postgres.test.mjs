import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';

const root=new URL('../../',import.meta.url);
const design=fs.readFileSync(new URL('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql',root),'utf8');
const ext=process.platform==='win32'?'.exe':'';
const pgBin=[process.env.SALES_TEST_PG_BIN,'/usr/lib/postgresql/17/bin','/usr/lib/postgresql/16/bin']
  .find(p=>p&&fs.existsSync(path.join(p,`initdb${ext}`)));

test('atomic candidate is prepared only; production entrypoint remains disconnected',()=>{
  assert.match(design,/NOT APPLIED/);
  const entry=fs.readFileSync(new URL('supabase/functions/sync-google-sheet/index.ts',root),'utf8');
  assert.doesNotMatch(entry,/sales_snapshot_v2|stage_sales_batch_v2/);
});

// Never uses DATABASE_URL, an existing PG service, or a remote database.
test('atomic sales snapshot on disposable PostgreSQL',{
  skip:!pgBin?'requires SALES_TEST_PG_BIN pointing to local PostgreSQL binaries':false,
  timeout:600000
},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sales-atomic-pg-'));
  const data=path.join(dir,'data');
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
  env.PGCLIENTENCODING='UTF8';
  const run=(name,args,input)=>{
    const r=spawnSync(path.join(pgBin,name+ext),args,{input,encoding:'utf8',env,windowsHide:true,
      timeout:name==='initdb'?180000:60000,maxBuffer:8*1024*1024});
    if(r.status!==0)throw Error(`${name}: ${r.error??''}\n${r.stderr}\n${r.stdout}`);
    return r.stdout.trim();
  };
  const port=await new Promise((resolve,reject)=>{
    const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{
      const p=server.address().port;server.close(()=>resolve(p));
    });
  });
  const args=['-X','-h','127.0.0.1','-p',String(port),'-U','atomic_fixture','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'];
  const sql=s=>run('psql',args,s);
  const asyncSql=s=>new Promise(resolve=>{
    const child=spawn(path.join(pgBin,'psql'+ext),args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);
    child.on('error',e=>resolve({code:-1,error:String(e)}));child.on('close',code=>resolve({code,output,error}));child.stdin.end(s);
  });
  const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
  const row=(name='Fixture',amount=10)=>({accounting_date:'2026-10-30',location_raw:name,brand:'Fixture',ownership:'Owned',channel_group:'Заклад',order_type:'Sale',revenue:amount,checks:1,markup:5});
  const manifest=rows=>({rows:rows.length,raw_rows:rows.length,batches:Math.ceil(rows.length/2000),revenue:rows.reduce((n,r)=>n+r.revenue,0),checks:rows.reduce((n,r)=>n+r.checks,0),markup:rows.reduce((n,r)=>n+r.markup,0),min_date:rows.map(r=>r.accounting_date).sort()[0],max_date:rows.map(r=>r.accounting_date).sort().at(-1)});
  const begin=rows=>sql(`set role service_role; select public.begin_sales_snapshot_v2(${literal(manifest(rows))});`);
  const stage=(id,rows,n=0)=>sql(`set role service_role; select public.stage_sales_batch_v2('${id}',${n},${literal(rows)});`);
  const commit=id=>sql(`set role service_role; select public.commit_sales_snapshot_v2('${id}');`);
  const snapshot=()=>sql(`select jsonb_build_object(
    'facts',(select jsonb_agg(to_jsonb(f) order by id) from public.fact_sales_daily f),
    'locations',(select jsonb_agg(to_jsonb(l) order by id) from public.dim_location l),
    'brands',(select jsonb_agg(to_jsonb(l) order by id) from public.dim_brand l),
    'ownership',(select jsonb_agg(to_jsonb(l) order by id) from public.dim_ownership l),
    'channels',(select jsonb_agg(to_jsonb(l) order by id) from public.dim_channel l),
    'order_types',(select jsonb_agg(to_jsonb(l) order by id) from public.dim_order_type l),
    'dates',(select jsonb_agg(to_jsonb(l) order by date_id) from public.dim_date l),
    'flat',(select jsonb_agg(to_jsonb(m) order by date,location) from public.bi_sales_flat_mv m),
    'monthly',(select jsonb_agg(to_jsonb(m) order by location_id) from public.agg_sales_monthly m),
    'weekly',(select jsonb_agg(to_jsonb(m) order by location_id) from public.agg_sales_weekly m),
    'generation',(select version from bi_import_private.generation));`);
  let started=false;
  try {
    run('initdb',['-D',data,'-A','trust','--no-locale','--encoding=UTF8','--no-sync','-U','atomic_fixture']);
    run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
    assert.equal(path.resolve(sql('show data_directory;')),path.resolve(data));
    const schema=fs.readFileSync(new URL('supabase/schema.sql',root),'utf8');
    const runtime=fs.readFileSync(new URL('supabase/migrations/20261008_warehouse_runtime.sql',root),'utf8');
    sql('create role anon; create role authenticated; create role service_role; create schema extensions;');
    sql(schema.split('insert into map_location_source')[0]);
    sql(schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(runtime.split('create or replace function public.bi_sales_snapshot')[0]);
    // Production refresh definition inspected SELECT-only; include all three real MV shapes.
    sql(`create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;
      create or replace function public.refresh_bi_aggregates() returns void language plpgsql security definer set search_path=public as $$begin
      refresh materialized view public.bi_sales_flat_mv; refresh materialized view public.agg_sales_monthly;
      refresh materialized view public.agg_sales_weekly; end $$;`);
    const old=sql("insert into public.import_runs(source_name,status) values('google_sheets:Данние короткі','running') returning id;");
    sql(`select public.sync_sales_batch(${literal([row('Old',20),row('Stale',30)])},'${old}'); select public.finalize_sales_snapshot('${old}');
      update public.import_runs set status='success',finished_at=now(),source_cutoff_date='2026-10-30',rows_read=2 where id='${old}';`);
    sql(design.replace('rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.', 'commit;'));
    console.log(`PostgreSQL ${sql('show server_version;')}; isolated fixture ${dir}`);
    let persistedRows=[row('Old',20),row('Stale',30)];

    await t.test('private staging and legacy mutators deny anon/authenticated/service bypass',()=>{
      for(const role of ['anon','authenticated'])assert.throws(()=>sql(`set role ${role};select public.begin_sales_snapshot_v2('{}');`),/permission denied/);
      assert.throws(()=>sql('set role service_role; select * from bi_import_private.sales_runs;'),/permission denied/);
      assert.throws(()=>sql(`set role service_role; select public.finalize_sales_snapshot('${old}');`),/permission denied/);
      assert.throws(()=>sql(`set role service_role; select public.sync_sales_batch('[]','${old}');`),/permission denied/);
    });
    await t.test('missing batch leaves live snapshot unchanged; identical replay succeeds; conflict fails',()=>{
      const rows=Array.from({length:2001},(_,i)=>row(`Batch-${i}`));const id=begin(rows);const before=snapshot();
      stage(id,rows.slice(0,2000));stage(id,rows.slice(0,2000));
      assert.equal(snapshot(),before);
      assert.throws(()=>commit(id),/INCOMPLETE_BATCHES/);
      assert.throws(()=>stage(id,[...rows.slice(0,1999),row('Different')]),/BATCH_REPLAY_CONFLICT/);
      assert.equal(snapshot(),before);
    });
    await t.test('invalid and missing metrics, sub-cent values and null dimensions never stage',()=>{
      for(const invalid of [{revenue:null},{revenue:0.004},{checks:1.5},{checks:-1},{location_raw:null},{accounting_date:'2026-02-30'}]){
        const id=begin([row()]);assert.throws(()=>stage(id,[{...row(),...invalid}]),/INVALID_|out of range/);
        assert.equal(sql(`select count(*) from bi_import_private.sales_batches where run_id='${id}'`),'0');
      }
    });
    await t.test('manifest mismatch and canonical duplicates cannot delete facts',()=>{
      const before=snapshot();const id=begin([row()]);stage(id,[row('Wrong total',11)]);
      assert.throws(()=>commit(id),/MANIFEST_MISMATCH/);
      sql("insert into public.map_location_source(source_name,canonical_name) values('Alias','Canonical');");
      const rows=[row('Alias'),row('Canonical')];const duplicate=begin(rows);stage(duplicate,rows);
      assert.throws(()=>commit(duplicate),/DUPLICATE_CANONICAL_KEY/);assert.equal(snapshot(),before);
    });
    await t.test('equal count/date/totals with historical key replacement fails closed',()=>{
      const before=snapshot();const rows=[row('Old',20),row('Replacement',30)];
      const id=begin(rows);stage(id,rows);
      assert.equal(manifest(rows).revenue,50);
      assert.equal(manifest(rows).checks,2);
      assert.equal(manifest(rows).markup,10);
      assert.throws(()=>commit(id),/HISTORICAL_KEY_REGRESSION/);
      assert.equal(snapshot(),before);
      assert.equal(sql(`select state from bi_import_private.sales_runs where id='${id}'`),'staging');
      assert.equal(sql(`select status from public.import_runs where id='${id}'`),'running');
    });
    await t.test('failure after fact update rolls back facts, dimensions, MVs and status',()=>{
      const rows=[...persistedRows,row('New location')];
      const id=begin(rows);stage(id,rows);const before=snapshot();
      sql(`create function public.fixture_refresh_failure() returns trigger language plpgsql as $$begin raise exception 'INJECTED_STATUS_FAILURE';end$$;
        create trigger fixture_fail before update on public.import_runs for each row when(new.status='success') execute function public.fixture_refresh_failure();`);
      assert.throws(()=>commit(id),/INJECTED_STATUS_FAILURE/);
      assert.equal(snapshot(),before);
      assert.equal(sql(`select state from bi_import_private.sales_runs where id='${id}'`),'staging');
      assert.equal(sql(`select status from public.import_runs where id='${id}'`),'running');
      sql('drop trigger fixture_fail on public.import_runs; drop function public.fixture_refresh_failure();');
    });
    await t.test('successful additive promotion preserves historical keys and retry is idempotent',()=>{
      const rows=[...persistedRows,row('Accepted',15)];const id=begin(rows);stage(id,rows);
      const result=commit(id);const after=snapshot();assert.equal(commit(id),result);assert.equal(snapshot(),after);
      assert.equal(sql('select count(*) from public.fact_sales_daily'),'3');
      assert.equal(sql('select sum(revenue) from public.bi_sales_flat_mv'),'65.00');
      assert.equal(sql(`select status from public.import_runs where id='${id}'`),'success');
      assert.equal(sql(`select count(*) from bi_import_private.sales_batches where run_id='${id}'`),'0');
      assert.throws(()=>stage(id,rows),/RUN_NOT_STAGING/);
      persistedRows=rows;
    });
    await t.test('concurrent promotions serialize; readers see old complete snapshot; stale run rejected',async()=>{
      const winner=[...persistedRows,row('Winner',40)],loser=[...persistedRows,row('Loser',50)];
      const a=begin(winner),b=begin(loser);stage(a,winner);stage(b,loser);
      const first=asyncSql(`set application_name='atomic_fixture_hold';set role service_role;begin;select public.commit_sales_snapshot_v2('${a}');select pg_sleep(3);commit;`);
      let sleeping=false;
      for(let i=0;i<40;i++){
        if(sql("select count(*) from pg_stat_activity where application_name='atomic_fixture_hold' and wait_event='PgSleep'")==='1'){sleeping=true;break;}
        await new Promise(r=>setTimeout(r,50));
      }
      assert.ok(sleeping,'first promotion reached uncommitted hold');
      assert.equal(sql('select sum(revenue) from public.fact_sales_daily'),'65.00');
      const second=asyncSql(`set role service_role;select public.commit_sales_snapshot_v2('${b}');`);
      const [ra,rb]=await Promise.all([first,second]);assert.equal(ra.code,0,ra.error);assert.notEqual(rb.code,0);assert.match(rb.error,/STALE_GENERATION/);
      assert.equal(sql('select sum(revenue) from public.fact_sales_daily'),'105.00');
      assert.equal(sql(`select status from public.import_runs where id='${b}'`),'running');
      persistedRows=winner;
    });
    await t.test('expired and source-cutoff regression are rejected without changing accepted data',()=>{
      const before=snapshot();const expired=begin([row()]);stage(expired,[row()]);
      sql(`update bi_import_private.sales_runs set expires_at=now()-interval '1 second' where id='${expired}'`);
      assert.throws(()=>commit(expired),/RUN_EXPIRED/);
      const regressed={...row(),accounting_date:'2026-10-29'};
      const m={...manifest([regressed]),min_date:'2026-10-29',max_date:'2026-10-29'};
      const id=sql(`set role service_role; select public.begin_sales_snapshot_v2(${literal(m)});`);stage(id,[regressed]);
      assert.throws(()=>commit(id),/SOURCE_REGRESSION/);assert.equal(snapshot(),before);
    });
    await t.test('cancelling promotion after replacement rolls back every visible table and view',async()=>{
      const changed={...row('Cancelled location',99),brand:'Cancelled brand',ownership:'Cancelled owner'};
      const rows=[...persistedRows,changed];const id=begin(rows);stage(id,rows);const before=snapshot();
      sql(`create function public.fixture_pause() returns trigger language plpgsql as $$begin perform pg_sleep(20);return new;end$$;
        create trigger fixture_pause before update on public.import_runs for each row when(new.status='success') execute function public.fixture_pause();`);
      const pending=asyncSql(`set application_name='atomic_fixture_cancel';set role service_role;select public.commit_sales_snapshot_v2('${id}');`);
      let pid='';
      for(let i=0;i<50;i++){
        pid=sql("select pid from pg_stat_activity where application_name='atomic_fixture_cancel' and wait_event='PgSleep'");
        if(pid)break;await new Promise(r=>setTimeout(r,50));
      }
      assert.match(pid,/^\d+$/);assert.equal(sql(`select pg_cancel_backend(${pid})`),'t');
      const result=await pending;assert.notEqual(result.code,0);assert.match(result.error,/canceling statement/);
      assert.equal(snapshot(),before);
      assert.equal(sql(`select status from public.import_runs where id='${id}'`),'running');
      sql('drop trigger fixture_pause on public.import_runs;drop function public.fixture_pause();');
    });
    await t.test('all 2001 rows across two batches publish once with exact totals; shrink fails closed',()=>{
      const rows=[...persistedRows,...Array.from({length:2001-persistedRows.length},(_,i)=>row(`Complete-${i}`,10))];
      const id=begin(rows);
      stage(id,rows.slice(2000),1);stage(id,rows.slice(0,2000),0); // out-of-order arrival
      commit(id);
      assert.equal(sql('select count(*) from public.fact_sales_daily'),'2001');
      assert.equal(sql('select sum(revenue) from public.bi_sales_flat_mv'),rows.reduce((n,r)=>n+r.revenue,0).toFixed(2));
      const before=snapshot();const short=begin([row('Truncated')]);stage(short,[row('Truncated')]);
      assert.throws(()=>commit(short),/SOURCE_REGRESSION/);assert.equal(snapshot(),before);
      persistedRows=rows;
    });
    await t.test('47000 synthetic rows in 24 batches reconcile at warehouse scale',()=>{
      const end=Date.UTC(2026,9,30);
      const rows=[...persistedRows,...Array.from({length:47000-persistedRows.length},(_,i)=>({...row(`Scale-${i%40}`,10),
        accounting_date:new Date(end-Math.floor(i/40)*86400000).toISOString().slice(0,10)}))];
      const id=begin(rows);
      for(let offset=0;offset<rows.length;offset+=2000)stage(id,rows.slice(offset,offset+2000),offset/2000);
      const start=Date.now();commit(id);console.log(`47000-row promotion elapsed ${Date.now()-start} ms (local synthetic, not hosted SLA)`);
      assert.equal(sql('select count(*) from public.fact_sales_daily'),'47000');
      assert.equal(sql('select sum(revenue) from public.bi_sales_flat_mv'),rows.reduce((n,r)=>n+r.revenue,0).toFixed(2));
      assert.equal(sql('select sum(checks) from public.agg_sales_monthly'),'47000.00');
      assert.equal(sql('select sum(markup) from public.agg_sales_weekly'),'235000.00');
    });
  } finally {
    if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
    // Preserve synthetic logs for review, never delete a computed directory.
  }
});
