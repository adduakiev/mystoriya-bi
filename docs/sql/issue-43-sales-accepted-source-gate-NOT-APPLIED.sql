-- DESIGN / NOT APPLIED. Disposable tests only; no authenticated evidence channel exists.
-- Review overlay AFTER issue-43-sales-atomic-NOT-APPLIED.sql, never a cutover script.
-- The original atomic candidate remains a pre-activation regression fixture only.
begin;

-- JSON, service_role, a digest, or a JS verification token cannot authenticate an
-- attestor to PostgreSQL. No table, receipt, root, key, role or success branch is
-- provisioned here. Even authentic synthetic signatures cannot open this gate.
create function public.commit_sales_snapshot_with_evidence_v1(p_run_id uuid, p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE';
end $$;

-- Close the old commit route too: merely adding a gated RPC leaves a bypass.
-- Replace its body rather than rename/preserve an executable ungated helper.
create or replace function public.commit_sales_snapshot_v2(p_run_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE';
end $$;

revoke all on function public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb),
  public.commit_sales_snapshot_v2(uuid) from public,anon,authenticated;
-- Draft fixture privilege only. This file is NOT installed in any environment.
grant execute on function public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb),
  public.commit_sales_snapshot_v2(uuid) to service_role;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
