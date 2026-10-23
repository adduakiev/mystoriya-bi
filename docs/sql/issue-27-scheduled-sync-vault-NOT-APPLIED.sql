-- Issue #27 — DESIGN / VALIDATION ONLY — NOT APPLIED.
-- Outside supabase/migrations. Do not execute, including as a dry run, without
-- a separate reviewed owner gate. ROLLBACK does not authorize production access.
-- No HTTP call is executed here. No credential or original command is returned.
-- Review session/audit logging prerequisites in docs/scheduled-sync-vault.md.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local client_min_messages = 'error';
set local log_statement = 'none';
set local log_min_error_statement = 'panic';
set local log_error_verbosity = 'terse';
set local log_parameter_max_length = 0;
set local log_parameter_max_length_on_error = 0;

create temporary table issue_27_validation (metadata jsonb not null) on commit drop;

do $design$
declare
  v_name constant text := 'myastoriya_google_sheet_sync_key';
  v_lookup constant text := $lookup$(select decrypted_secret from vault.decrypted_secrets where name = 'myastoriya_google_sheet_sync_key')$lookup$;
  v_pattern constant text := $pattern$(?<![[:alnum:]_$'])('x-bi-sync-key'[[:space:]]*,[[:space:]]*)'([^']*)'(?=[[:space:]]*[,)])$pattern$;
  v_before cron.job%rowtype;
  v_after cron.job%rowtype;
  v_count bigint;
  v_prefix text;
  v_candidate text;
  v_literal text;
  v_expected_hash text;
  v_candidate_hash text;
  v_new_command text;
  v_secret_id uuid;
  v_vault_candidate text;
  v_recovered_command text;
  v_manual_owner name;
  v_execution_role name;
  v_role record;
begin
  -- These session controls cannot suppress external audit/proxy capture.
  -- Reject known nested/parameter logging; external controls remain a review gate.
  if coalesce(current_setting('pgaudit.log', true), 'none') not in ('none', '')
     or coalesce(current_setting('pgaudit.log_parameter', true), 'off') <> 'off'
     or coalesce(current_setting('auto_explain.log_min_duration', true), '-1') <> '-1'
  then
    raise exception 'Issue 27: unsafe session logging';
  end if;

  -- Serializes cron metadata changes, including inserts with a duplicate name.
  -- A separate application gate must also exclude concurrent Vault changes and
  -- an already-running cron/manual sync; this transaction does not stop workers.
  lock table cron.job in share row exclusive mode;
  lock table public.bi_runtime_config in share mode;
  lock table vault.secrets in share row exclusive mode;
  select count(*) into v_count from cron.job
  where jobname = 'myastoriya_google_sheet_sync_daily' or jobid = 1;
  if v_count <> 1 then
    raise exception 'Issue 27: missing or ambiguous job';
  end if;
  select * into strict v_before from cron.job
  where jobname = 'myastoriya_google_sheet_sync_daily' and jobid = 1;
  if v_before.schedule is distinct from '15 4 * * *'
     or v_before.active is distinct from true
     or v_before.database is distinct from current_database()
     or v_before.command is null
  then
    raise exception 'Issue 27: job baseline changed';
  end if;
  if position('net.http_post' in v_before.command) = 0
     or position('sync-google-sheet' in v_before.command) = 0
     or position('vault.' in lower(v_before.command)) > 0
     or v_before.command ~* '(^|[^[:alnum:]_])(vault|decrypted_secrets)([^[:alnum:]_]|$)'
     or position(v_name in v_before.command) > 0
  then
    raise exception 'Issue 27: unsupported command shape';
  end if;

  select count(*) into v_count
  from regexp_matches(v_before.command, '(x-bi-sync-key)', 'gi');
  if v_count <> 1 then
    raise exception 'Issue 27: ambiguous header';
  end if;
  select count(*) into v_count
  from regexp_matches(v_before.command, v_pattern, 'g');
  if v_count <> 1 then
    raise exception 'Issue 27: missing or multiple credential extractions';
  end if;
  select m[1], m[2] into strict v_prefix, v_candidate
  from regexp_matches(v_before.command, v_pattern, 'g') as m;
  -- Deliberately supports only the audited ordinary SQL pair literal, never
  -- escaped strings, control characters or arbitrary SQL literal syntaxes.
  if length(v_candidate) <> 26 or v_candidate ~ '[[:cntrl:]]'
     or position(chr(92) in v_candidate) > 0
     or current_setting('standard_conforming_strings') <> 'on'
     or current_setting('server_encoding') <> 'UTF8'
  then
    raise exception 'Issue 27: unsupported credential literal';
  end if;
  v_literal := quote_literal(v_candidate);
  if (length(v_before.command) - length(replace(v_before.command, v_candidate, '')))
       / length(v_candidate) <> 1
  then
    raise exception 'Issue 27: credential occurs outside the expected literal';
  end if;

  select value_hash into strict v_expected_hash
  from public.bi_runtime_config where config_key = 'sync_key';
  v_candidate_hash := encode(extensions.digest(v_candidate, 'sha256'), 'hex');
  if v_expected_hash is null or v_candidate_hash is distinct from v_expected_hash then
    raise exception 'Issue 27: credential hash mismatch';
  end if;

  -- Conservative: even a matching pre-existing secret requires separate review.
  -- Never overwrite, rotate, reuse or delete a previously existing secret.
  if exists (select 1 from vault.secrets where name = v_name) then
    raise exception 'Issue 27: Vault name already exists';
  end if;

  -- Check effective access, including column grants, PUBLIC and role membership.
  -- This is an explicit privileged-role allowlist, not a role-name substring test.
  if exists (
    select 1 from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where c.oid in ('vault.secrets'::regclass, 'vault.decrypted_secrets'::regclass)
      and a.grantee = 0 and a.privilege_type = 'SELECT'
  ) or exists (
    select 1 from pg_attribute a cross join lateral aclexplode(a.attacl) p
    where a.attrelid in ('vault.secrets'::regclass, 'vault.decrypted_secrets'::regclass)
      and p.grantee = 0 and p.privilege_type = 'SELECT'
  ) then
    raise exception 'Issue 27: PUBLIC Vault access';
  end if;
  for v_role in select oid, rolname, rolsuper from pg_roles loop
    if not v_role.rolsuper and v_role.rolname not in ('postgres', 'supabase_admin', 'service_role')
       and (
         has_any_column_privilege(v_role.oid, 'vault.decrypted_secrets', 'SELECT')
         or has_any_column_privilege(v_role.oid, 'vault.secrets', 'SELECT')
         or exists (
           select 1 from pg_roles privileged
           where (privileged.rolsuper or privileged.rolname in ('postgres', 'supabase_admin', 'service_role'))
             and pg_has_role(v_role.oid, privileged.oid, 'MEMBER')
         )
       )
    then
      raise exception 'Issue 27: unapproved role can access Vault';
    end if;
  end loop;
  select pg_get_userbyid(proowner) into strict v_manual_owner
  from pg_proc where oid = 'public.bi_trigger_sync(text)'::regprocedure
    and prosecdef;
  foreach v_execution_role in array array[v_before.username::name, v_manual_owner] loop
    if not exists (
      select 1 from pg_roles where rolname = v_execution_role
        and (rolsuper or rolname in ('postgres', 'supabase_admin', 'service_role'))
    ) or not has_schema_privilege(v_execution_role, 'vault', 'USAGE')
      or not has_table_privilege(v_execution_role, 'vault.decrypted_secrets', 'SELECT')
    then
      raise exception 'Issue 27: sync execution role lacks privileged Vault access';
    end if;
  end loop;

  -- First planned write happens only after extraction, hash and ACL gates.
  v_secret_id := vault.create_secret(v_candidate, v_name,
    'Existing daily Google Sheet sync credential; issue 27; no rotation', null::uuid);
  select decrypted_secret into strict v_vault_candidate
  from vault.decrypted_secrets where id = v_secret_id and name = v_name;
  if encode(extensions.digest(v_vault_candidate, 'sha256'), 'hex')
       is distinct from v_expected_hash then
    raise exception 'Issue 27: Vault round-trip hash mismatch';
  end if;

  -- Change ONLY the value literal; retain every other byte, including whitespace,
  -- target URL, non-secret headers, request body and timeout.
  v_new_command := replace(v_before.command, v_prefix || v_literal, v_prefix || v_lookup);
  if v_new_command = v_before.command
     or position(v_candidate in v_new_command) > 0
     or replace(v_before.command, v_prefix || v_literal, '<redacted>')
        is distinct from replace(v_new_command, v_prefix || v_lookup, '<redacted>')
     or (length(v_new_command) - length(replace(v_new_command, v_lookup, '')))
        / length(v_lookup) <> 1
  then
    raise exception 'Issue 27: unsafe command rewrite';
  end if;
  perform cron.alter_job(job_id := v_before.jobid, command := v_new_command);
  select * into strict v_after from cron.job where jobid = v_before.jobid;
  if (to_jsonb(v_before) - 'command') is distinct from (to_jsonb(v_after) - 'command')
     or v_after.command is distinct from v_new_command then
    raise exception 'Issue 27: cron metadata changed';
  end if;

  -- Recovery design proof, entirely in memory: retrieve from Vault, rebuild the
  -- old SQL literal and require byte equality. Do NOT print or export this value.
  -- An authorized recovery can bind v_recovered_command to cron.alter_job;
  -- it must repeat hash/ACL/metadata gates and retain Vault until verified.
  v_recovered_command := replace(v_new_command, v_lookup, quote_literal(v_vault_candidate));
  if v_recovered_command is distinct from v_before.command then
    raise exception 'Issue 27: recovery round-trip failed';
  end if;

  insert into pg_temp.issue_27_validation(metadata) values (jsonb_build_object(
    'status', 'transaction-only validation; NOT APPLIED',
    'jobid', v_before.jobid, 'jobname', v_before.jobname,
    'schedule', v_before.schedule, 'database', v_before.database,
    'username', v_before.username, 'active', v_before.active,
    'secret_name', v_name, 'credential_sha256', v_candidate_hash,
    'before_command_sha256', encode(extensions.digest(v_before.command, 'sha256'), 'hex'),
    'after_command_sha256', encode(extensions.digest(v_new_command, 'sha256'), 'hex'),
    'metadata_preserved', true, 'non_secret_command_bytes_preserved', true,
    'plaintext_absent_from_new_command', true, 'recovery_round_trip', true,
    'http_executed', false));
exception when others then
  -- Never propagate native errors, SQLERRM, SQLSTATE, command text or bind values.
  raise exception using message = 'Issue 27 validation failed; transaction must be rolled back';
end;
$design$;

-- The only result set is hashes/metadata. Never SELECT cron.command or secrets.
select metadata from pg_temp.issue_27_validation;
rollback;
