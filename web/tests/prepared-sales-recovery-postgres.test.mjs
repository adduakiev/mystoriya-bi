import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { prepareSalesRecovery } from '../../supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs';

const root = new URL('../../', import.meta.url);
const ext = process.platform === 'win32' ? '.exe' : '';
const pgBin = [process.env.SALES_TEST_PG_BIN, '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin']
  .find(p => p && fs.existsSync(path.join(p, `initdb${ext}`)));

// Complements, never replaces, sales-atomic-postgres.test.mjs's server/concurrency
// fixture. Real PostgreSQL single-user mode needs neither sockets nor an existing DB.
test('prepared exact-decimal 47k bodies reconcile and roll back on disposable single-user PostgreSQL', {
  skip: !pgBin ? 'requires local PostgreSQL binaries' : false, timeout: 180000
}, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-prepared-single-pg-'));
  const data = path.join(dir, 'data');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
  const run = (name, args, input) => {
    let fd;
    if (input) {
      const file = path.join(dir, 'synthetic-input.sql');
      fs.writeFileSync(file, input); fd = fs.openSync(file, 'r');
    }
    let result;
    try {
      result = spawnSync(path.join(pgBin, name + ext), args, { env, encoding: 'utf8', timeout: 150000,
        maxBuffer: 1024 * 1024, stdio: [fd ?? 'ignore', 'pipe', 'pipe'] });
    } finally { if (fd !== undefined) fs.closeSync(fd); }
    // Never echo SQL/input or an oversized stdout, even on fixture failure.
    const phases = result.stderr.split('\n').filter(line => /NOTICE:.*FIXTURE_PHASE_/.test(line)).map(line => line.slice(0, 120)).join('; ');
    assert.equal(result.status, 0, `${name} failed: ${result.error?.code ?? result.status}; ${phases}`);
    const messages = (result.stdout + result.stderr).split('\n').filter(line => /(?:ERROR|FATAL|PANIC):/.test(line));
    assert.deepEqual(messages.map(line => line.slice(0, 200)), []);
    return result.stdout;
  };
  try {
    run('initdb', ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'fixture']);
    const schema = fs.readFileSync(new URL('supabase/schema.sql', root), 'utf8');
    const runtime = fs.readFileSync(new URL('supabase/migrations/20261008_warehouse_runtime.sql', root), 'utf8');
    const design = fs.readFileSync(new URL('docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql', root), 'utf8');
    const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
    const matrix = [header, ...Array.from({ length: 47000 }, (_, i) => ['', '', '', '', '',
      new Date(Date.UTC(2026, 9, 31) - Math.floor(i / 40) * 86400000).toISOString().slice(0, 10),
      `Synthetic-${i % 40}`, 'Fixture', 'Owned', 'Заклад', 'Sale', i === 0 ? '90071992547409.91' : '0.10', '1', '-0.03'])];
    const prepared = prepareSalesRecovery(matrix, { previous: { rawRows: 1, minDate: '2026-10-31', maxDate: '2026-10-31' }, now: new Date('2026-11-01T00:00:00Z') });
    const literal = s => `'${s.replaceAll("'", "''")}'::jsonb`;
    const digest = `select md5(jsonb_build_object(
      'facts',(select jsonb_agg(to_jsonb(f) order by id) from public.fact_sales_daily f),
      'locations',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_location f),
      'brands',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_brand f),
      'ownership',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_ownership f),
      'channels',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_channel f),
      'types',(select jsonb_agg(to_jsonb(f) order by id) from public.dim_order_type f),
      'dates',(select jsonb_agg(to_jsonb(f) order by date_id) from public.dim_date f),
      'flat',(select jsonb_agg(to_jsonb(f) order by date,location) from public.bi_sales_flat_mv f),
      'monthly',(select jsonb_agg(to_jsonb(f) order by location_id) from public.agg_sales_monthly f),
      'weekly',(select jsonb_agg(to_jsonb(f) order by location_id) from public.agg_sales_weekly f),
      'generation',(select version from bi_import_private.generation))::text)`;
    const setup = `create role anon;create role authenticated;create role service_role;create schema extensions;
      ${schema.split('insert into map_location_source')[0]}
      ${schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]}
      ${runtime.split('create or replace function public.bi_sales_snapshot')[0]}
      create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;
      create or replace function public.refresh_bi_aggregates() returns void language plpgsql as $$begin
        refresh materialized view public.bi_sales_flat_mv;refresh materialized view public.agg_sales_monthly;refresh materialized view public.agg_sales_weekly;end$$;
      ${design.replace('rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.', 'commit;')}
      do $$declare seed uuid;begin
        seed:=public.begin_sales_snapshot_v2('{"rows":1,"raw_rows":1,"batches":1,"revenue":10,"checks":1,"markup":5,"min_date":"2026-10-31","max_date":"2026-10-31"}');
        perform public.stage_sales_batch_v2(seed,0,'[{"accounting_date":"2026-10-31","location_raw":"Synthetic-0","brand":"Fixture","ownership":"Owned","channel_group":"Заклад","order_type":"Sale","revenue":10,"checks":1,"markup":5}]');
        perform public.commit_sales_snapshot_v2(seed);
      end$$;
      create function public.fixture_failure() returns trigger language plpgsql as $$begin raise exception 'FIXTURE_ROLLBACK';end$$;
      create trigger fixture_fail before update on public.import_runs for each row when(new.status='success') execute function public.fixture_failure();
      do $fixture$ declare v_id uuid; v_before text; v_after text; v_receipt jsonb; v_total numeric; v_markup numeric; v_checks numeric; rel text;begin
        raise notice 'FIXTURE_PHASE_BEGIN';
        v_id:=public.begin_sales_snapshot_v2(${literal(prepared.manifestJson)});
        ${prepared.batches.map(b => `perform public.stage_sales_batch_v2(v_id,${b.batchNo},${literal(b.json)});`).join('\n')}
        raise notice 'FIXTURE_PHASE_STAGED';
        v_before:=(${digest});
        begin perform public.commit_sales_snapshot_v2(v_id);raise exception 'EXPECTED_FAILURE_MISSING';
        exception when others then if sqlerrm <> 'FIXTURE_ROLLBACK' then raise;end if;end;
        v_after:=(${digest});
        raise notice 'FIXTURE_PHASE_ROLLBACK';
        if v_before is distinct from v_after then raise exception 'SNAPSHOT_CHANGED_AFTER_FAILURE';end if;
        if (select state from bi_import_private.sales_runs where id=v_id)<>'staging' or
           (select status from public.import_runs where id=v_id)<>'running' then raise exception 'STATUS_CHANGED_AFTER_FAILURE';end if;
        drop trigger fixture_fail on public.import_runs;
        v_receipt:=public.commit_sales_snapshot_v2(v_id);
        raise notice 'FIXTURE_PHASE_PROMOTED';
        foreach rel in array array['fact_sales_daily','bi_sales_flat_mv','agg_sales_monthly','agg_sales_weekly'] loop
          execute format('select sum(revenue),sum(markup),sum(checks) from public.%I',rel) into v_total,v_markup,v_checks;
          if v_total<>90071992552109.81 or v_markup<>-1410.00 or v_checks<>47000 then raise exception 'EXACT_TOTAL_MISMATCH';end if;
        end loop;
        if (select count(*) from public.fact_sales_daily)<>47000 then raise exception 'ROW_COUNT_MISMATCH';end if;
        v_before:=(${digest});
        if public.commit_sales_snapshot_v2(v_id) is distinct from v_receipt then raise exception 'RETRY_RECEIPT_MISMATCH';end if;
        v_after:=(${digest});if v_before is distinct from v_after then raise exception 'RETRY_CHANGED_SNAPSHOT';end if;
      end $fixture$;
      select 'prepared_sales_47000_exact_rollback_passed';`;
    // -j consumes the controlled SQL as a whole, including multiline function bodies.
    const input = setup.replace(/--[^\n]*/g, '').replace(/\n/g, ' ') + '\n\n';
    const output = run('postgres', ['--single', '-D', data, '-j', 'postgres'], input);
    assert.match(output, /prepared_sales_47000_exact_rollback_passed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true }); // exact mkdtemp path; synthetic only
  }
});
