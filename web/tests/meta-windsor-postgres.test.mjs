import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, writeFileSync, openSync, closeSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const candidate = readFileSync(new URL('../../docs/sql/issue-34-meta-windsor-NOT-APPLIED.sql', import.meta.url), 'utf8');

test('Meta candidate stays outside automatic migrations and cannot activate destinations or schedules', () => {
  assert.match(candidate, /NOT APPLIED/);
  assert.match(candidate, /rollback;\s*$/);
  assert.doesNotMatch(candidate, /\b(?:perform|select)\s+cron\.|https?:\/\/|\bcommit\s*;/i);
  assert.match(candidate, /primary key \(date, account_id, campaign_id\)/);
  assert.match(candidate, /null,actions_offsite_conversion_fb_pixel_purchase/);
  assert.doesNotMatch(candidate, /coalesce\(sum\(/i);
});

// Never reads DATABASE_URL or connects to an existing server. A missing local
// PostgreSQL installation is reported as skipped; static tests are not a substitute.
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/local/pgsql/bin']
  .find(dir => existsSync(path.join(dir, 'initdb')));
test('Meta candidate: disposable PostgreSQL transform, privileges, nulls, evidence and isolation',
  {skip: !pgBin || process.getuid?.() === 0 ? 'requires local PostgreSQL binaries and a non-root user' : false}, () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'meta-windsor-pg-'));
    const run = (binary, args, input) => {
      let fd;
      if (input) {
        const file = path.join(dir, 'input.sql');
        writeFileSync(file, input);
        fd = openSync(file, 'r');
      }
      const result = spawnSync(path.join(pgBin, binary), args, {encoding: 'utf8', timeout: 15000,
        killSignal: 'SIGKILL', stdio: [fd ?? 'ignore', 'pipe', 'pipe']});
      if (fd !== undefined) closeSync(fd);
      assert.equal(result.status, 0, `${binary}: ${result.error ?? ""}\n${result.stderr}\n${result.stdout}`);
      return result.stdout + result.stderr;
    };
    try {
      run('initdb', ['-D', path.join(dir, 'data'), '-A', 'trust', '--no-locale', '-U', 'meta_test']);
      const setup = `
        create role anon;
        create role authenticated;
        create role service_role bypassrls;
        -- Simulate Supabase default table grants: candidate must revoke them.
        alter default privileges grant all on tables to anon, authenticated, service_role;
        create schema extensions;
        create extension pgcrypto with schema extensions;
        create table public.bi_runtime_config(config_key text, value_hash text);
        insert into public.bi_runtime_config values ('access_password',encode(extensions.digest('fixture-password','sha256'),'hex'));
      `;
      const original = readFileSync(new URL('../../supabase/migrations/20261019_meta_ads_contract.sql', import.meta.url), 'utf8');
      const regression = readFileSync(new URL('./fixtures/meta-windsor-regression.sql', import.meta.url), 'utf8');
      // Single-user mode needs no sockets and cannot connect to another server.
      // One complete input query preserves PL/pgSQL bodies; line comments are
      // removed only from these controlled SQL fixtures before joining lines.
      const sql = setup + original + candidate.replace(/rollback;\s*$/, '') + regression + "\nrollback;\nselect 'meta_windsor_regression_passed' as fixture_result;\n";
      const input = sql.replace(/--[^\n]*/g, '').replace(/\n/g, ' ') + '\n\n';
      const output = run('postgres', ['--single', '-D', path.join(dir, 'data'), '-j', 'postgres'], input);
      assert.doesNotMatch(output, /(?:ERROR|FATAL|PANIC):/, output);
      assert.match(output, /fixture_result.*meta_windsor_regression_passed/, output);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
