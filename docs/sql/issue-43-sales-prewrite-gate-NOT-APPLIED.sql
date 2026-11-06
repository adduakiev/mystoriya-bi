-- PREPARE ONLY / NOT APPLIED / NOT READY FOR GATE.
-- Rejection-only overlay after the atomic and accepted-source candidate drafts.
-- No independent historical source root or authenticated identity policy exists.
-- Nothing here provisions one, bootstraps genesis, or accepts caller JSON as proof.
-- Production authorization, backups, migration and Edge cutover are separate gates.
begin;

-- Reject BEFORE validation, locks, sequence calls, reservation or staging writes.
-- Replace bodies in place: never retain an executable ungated helper/alias.
create or replace function public.begin_sales_snapshot_v2(p_manifest jsonb)
returns uuid language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE';
end $$;

create or replace function public.stage_sales_batch_v2(p_run_id uuid,p_batch_no integer,p_rows jsonb)
returns integer language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE';
end $$;

create or replace function public.commit_sales_snapshot_v2(p_run_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE';
end $$;

create or replace function public.commit_sales_snapshot_with_evidence_v1(p_run_id uuid,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE';
end $$;

revoke all on function public.begin_sales_snapshot_v2(jsonb),
  public.stage_sales_batch_v2(uuid,integer,jsonb),public.commit_sales_snapshot_v2(uuid),
  public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb) from public,anon,authenticated;
-- Draft fixture privilege only: even service_role must receive 55000.
grant execute on function public.begin_sales_snapshot_v2(jsonb),
  public.stage_sales_batch_v2(uuid,integer,jsonb),public.commit_sales_snapshot_v2(uuid),
  public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb) to service_role;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
