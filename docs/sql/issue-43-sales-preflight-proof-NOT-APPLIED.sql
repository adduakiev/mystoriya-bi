-- PREPARE ONLY / NOT APPLIED / NOT READY FOR GATE. SYNTHETIC DISPOSABLE DB ONLY.
-- Decision only: no receipt, reservation, sequence, staging or Sales capability.
-- Reuses the attestor fixture; DOES NOT authenticate Google or bootstrap genesis.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$begin
  if current_database()<>'sales_attestor_synthetic'
    or to_regclass('sales_attestor_private.targets') is null
    or to_regclass('bi_import_private.generation') is null
    or to_regclass('sales_attestor_private.preflight_root') is not null then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_DISPOSABLE_FIXTURE_REQUIRED';
  end if;
end$$;

-- Empty, noncaller-provisioned SINGLE active prior root. Only the disposable
-- administrator seeds it, outside this candidate. There is no root setter API.
create table sales_attestor_private.preflight_root (
  singleton boolean primary key default true check(singleton),
  prior_run_id uuid not null,
  receipt_sha256 text not null check(receipt_sha256 ~ '^[a-f0-9]{64}$'),
  generation bigint not null check(generation>=0),
  producer_group text not null,
  expires_at timestamptz not null
);
alter table sales_attestor_private.preflight_root owner to sales_attestor_owner;
alter table sales_attestor_private.preflight_root enable row level security;
revoke all on sales_attestor_private.preflight_root from public,anon,authenticated,service_role,sales_reviewer_a,sales_reviewer_b;
create trigger preflight_root_immutable before update or delete or truncate
  on sales_attestor_private.preflight_root for each statement
  execute function sales_attestor_private.reject_mutation();
alter table sales_attestor_private.preflight_root enable always trigger preflight_root_immutable;

-- Private owner can observe replay/generation, with a row lock on generation.
-- UPDATE(version) is required by PostgreSQL FOR SHARE; no function updates it.
-- These synthetic grants/policies are NOT a proposed production ACL cutover.
grant usage on schema bi_import_private to sales_attestor_owner;
grant select,update(version) on bi_import_private.generation to sales_attestor_owner;
grant select on public.import_runs to sales_attestor_owner;
create policy synthetic_preflight_generation on bi_import_private.generation
  for select to sales_attestor_owner using(true);
-- Row-lock visibility requires UPDATE USING; WITH CHECK(false) forbids an
-- actual generation UPDATE through this owner even if a function regresses.
create policy synthetic_preflight_lock on bi_import_private.generation
  for update to sales_attestor_owner using(true) with check(false);
create policy synthetic_preflight_runs on public.import_runs
  for select to sales_attestor_owner using(true);
-- Do not retain the older receipt-producing review entry point in this fixture.
revoke all on function sales_attestor_private.review(uuid,jsonb) from public,anon,authenticated,service_role,sales_reviewer_a,sales_reviewer_b;

create function sales_attestor_private.preflight(p_run_id uuid,p_binding jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  r sales_attestor_private.preflight_root%rowtype;
  t sales_attestor_private.targets%rowtype;
  grp text;
  v bigint;
begin
  if current_database()<>'sales_attestor_synthetic' then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_DISPOSABLE_FIXTURE_REQUIRED';
  end if;
  -- Actual authenticated LOGIN, never current_user, JSON, JWT or SET ROLE.
  select independence_group into grp from sales_attestor_private.reviewers
    where reviewer=session_user;
  if grp is null or not exists(select from pg_roles where rolname=session_user
    and rolcanlogin and not (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls))
    or exists(select from pg_auth_members m join pg_roles p on p.oid in(m.roleid,m.member)
      where p.rolname in('sales_attestor_owner','sales_reviewer_a','sales_reviewer_b')) then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_INDEPENDENT_LOGIN_REQUIRED';
  end if;
  -- Fixed lock order. A concurrent generation writer blocks this decision; all
  -- bindings and wall-clock expiry are checked AFTER acquiring every row lock.
  select version into v from bi_import_private.generation where singleton for share;
  select * into r from sales_attestor_private.preflight_root where singleton for share;
  if not found or v is null then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_ROOT_UNAVAILABLE';
  end if;
  select * into t from sales_attestor_private.targets where run_id=p_run_id for share;
  if not found or p_binding is distinct from t.binding then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_UNTRUSTED_BINDING';
  end if;
  -- The entire target is privately pinned, including current source identity,
  -- exact response/source/manifest/proposed-warehouse hashes and run UUID.
  if (t.binding->>'kind' is distinct from 'sales-preflight/synthetic-v1')
    or (t.binding->>'run_id' is distinct from p_run_id::text)
    or (t.binding->>'source_identity' is distinct from 'synthetic:private-sheet:A:N')
    or not coalesce((t.binding->>'source_sha256') ~ '^[a-f0-9]{64}$',false)
    or not coalesce((t.binding->>'response_sha256') ~ '^[a-f0-9]{64}$',false)
    or not coalesce((t.binding->>'manifest_sha256') ~ '^[a-f0-9]{64}$',false)
    or not coalesce((t.binding->>'warehouse_sha256') ~ '^[a-f0-9]{64}$',false)
    or t.binding->'prior' is distinct from jsonb_build_object('run_id',r.prior_run_id,
      'receipt_sha256',r.receipt_sha256,'generation',r.generation::text)
    or (t.binding->>'base_generation' is distinct from v::text)
    or (t.binding->>'generation' is distinct from (v+1)::text)
    or r.generation<>v then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_ROOT_OR_GENERATION_MISMATCH';
  end if;
  if grp=r.producer_group then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_NONINDEPENDENT_REVIEWER';
  end if;
  if least(r.expires_at,t.expires_at)<=clock_timestamp() then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_EXPIRED';
  end if;
  if p_run_id=r.prior_run_id or exists(select from public.import_runs where id=p_run_id)
    or exists(select from sales_attestor_private.receipts where run_id=p_run_id)
    or exists(select from sales_attestor_private.accepted_reviews where run_id=p_run_id) then
    raise exception using errcode='55000', message='SALES_PREFLIGHT_REPLAY';
  end if;
  -- Repeatable observation, NOT a token or permission. No caller may use this
  -- result later to authorize writes; a future first-write transaction must
  -- reauthenticate and recheck under its own locks before ANY durable write.
  return jsonb_build_object('decision','SYNTHETIC_PREFLIGHT_ONLY','run_id',p_run_id,
    'binding_sha256',t.binding_sha256,'reviewer',session_user,'generation',v::text);
end$$;
alter function sales_attestor_private.preflight(uuid,jsonb) owner to sales_attestor_owner;
revoke all on function sales_attestor_private.preflight(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function sales_attestor_private.preflight(uuid,jsonb) to sales_reviewer_a,sales_reviewer_b;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
