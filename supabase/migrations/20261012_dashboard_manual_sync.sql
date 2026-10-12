-- Manual dashboard refresh controls for М'ЯСТОРІЯ BI.
-- The sync secret remains server-side inside the existing pg_cron command.

create or replace function public.bi_trigger_sync(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_command text;
  v_request_id bigint;
  v_running record;
begin
  select value_hash
    into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');

  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select id,status,started_at
    into v_running
  from public.import_runs
  where source_name='google_sheets:Данние короткі'
    and status='running'
    and started_at >= now() - interval '15 minutes'
  order by started_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'accepted',false,
      'alreadyRunning',true,
      'runId',v_running.id,
      'status',v_running.status,
      'startedAt',v_running.started_at,
      'requestedAt',now()
    );
  end if;

  select command
    into v_command
  from cron.job
  where jobname='myastoriya_google_sheet_sync_daily'
  limit 1;

  if v_command is null then
    raise exception 'sync job not configured';
  end if;

  execute v_command into v_request_id;

  return jsonb_build_object(
    'accepted',true,
    'alreadyRunning',false,
    'requestId',v_request_id,
    'requestedAt',now()
  );
end;
$$;

create or replace function public.bi_sync_progress(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_run record;
begin
  select value_hash
    into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');

  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select
    id,
    status,
    started_at,
    finished_at,
    source_cutoff_date,
    rows_read,
    rows_loaded,
    rows_rejected
  into v_run
  from public.import_runs
  where source_name='google_sheets:Данние короткі'
  order by started_at desc
  limit 1;

  return jsonb_build_object(
    'runId',v_run.id,
    'status',v_run.status,
    'startedAt',v_run.started_at,
    'finishedAt',v_run.finished_at,
    'cutoffDate',v_run.source_cutoff_date,
    'rowsRead',v_run.rows_read,
    'rowsLoaded',v_run.rows_loaded,
    'rowsRejected',v_run.rows_rejected,
    'warehouseRows',(select count(*) from public.fact_sales_daily),
    'warehouseCutoff',(select max(date_id) from public.fact_sales_daily)
  );
end;
$$;

revoke all on function public.bi_trigger_sync(text) from public,authenticated;
grant execute on function public.bi_trigger_sync(text) to anon;

revoke all on function public.bi_sync_progress(text) from public,authenticated;
grant execute on function public.bi_sync_progress(text) to anon;
