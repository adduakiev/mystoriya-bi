-- REVIEW ONLY / NOT APPLIED. Synthetic accepted-source trust-boundary draft.
-- NOT a migration, source authenticator, root bootstrap, or Sales promotion path.
-- Fixture provisioning is deliberately outside this file. Never wire to a runner.
-- Existing rejection-only overlays and both runtime 503 guards remain mandatory.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $preconditions$
declare r record;
begin
  if current_database() <> 'sales_attestor_synthetic' then
    raise exception using errcode='55000', message='SALES_ATTESTOR_SYNTHETIC_DATABASE_REQUIRED';
  end if;
  if to_regnamespace('sales_attestor_private') is not null then
    raise exception using errcode='55000', message='SALES_ATTESTOR_SCHEMA_ALREADY_EXISTS';
  end if;
  if (select count(*) from pg_roles where rolname in
    ('sales_attestor_owner','sales_reviewer_a','sales_reviewer_b','service_role','anon','authenticated')) <> 6 then
    raise exception using errcode='55000', message='SALES_ATTESTOR_REVIEW_ROLES_REQUIRED';
  end if;
  for r in select * from pg_roles where rolname in
    ('sales_attestor_owner','sales_reviewer_a','sales_reviewer_b','service_role','anon','authenticated') loop
    if r.rolsuper or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolbypassrls
      or r.rolcanlogin <> (r.rolname in ('sales_reviewer_a','sales_reviewer_b')) then
      raise exception using errcode='55000', message='SALES_ATTESTOR_UNSAFE_ROLE';
    end if;
  end loop;
  -- No inherited/SET ROLE path to an attestor or object owner, in either direction.
  if exists(select from pg_auth_members m join pg_roles protected_role on protected_role.oid in (m.roleid,m.member)
    where protected_role.rolname in ('sales_attestor_owner','sales_reviewer_a','sales_reviewer_b')) then
    raise exception using errcode='55000', message='SALES_ATTESTOR_MEMBERSHIP_FORBIDDEN';
  end if;
  if exists(select from pg_default_acl where defaclrole in
    (select oid from pg_roles where rolname in (current_user,'sales_attestor_owner'))) then
    raise exception using errcode='55000', message='SALES_ATTESTOR_DEFAULT_ACL_REQUIRES_REVIEW';
  end if;
end $preconditions$;

create schema sales_attestor_private authorization sales_attestor_owner;
revoke all on schema sales_attestor_private from PUBLIC,anon,authenticated,service_role;

-- Empty protected fixture policy. No request may provision its own trusted target,
-- prior root, independence group, keys or role. Authentic policy/root provisioning
-- for a real source remains a separate, unimplemented owner gate.
create table sales_attestor_private.reviewers (
  reviewer name primary key,
  independence_group text not null unique,
  check(reviewer in ('sales_reviewer_a','sales_reviewer_b'))
);
create table sales_attestor_private.targets (
  run_id uuid primary key,
  binding jsonb not null check(jsonb_typeof(binding)='object'),
  binding_sha256 text not null check(binding_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  check(binding_sha256=encode(sha256(convert_to(binding::text,'UTF8')),'hex'))
);
create table sales_attestor_private.receipts (
  run_id uuid not null references sales_attestor_private.targets(run_id),
  reviewer name not null references sales_attestor_private.reviewers(reviewer),
  independence_group text not null,
  binding jsonb not null,
  binding_sha256 text not null,
  observed_at timestamptz not null,
  receipt_sha256 text not null unique,
  primary key(run_id,reviewer)
);
-- These FKs intentionally reject plain TRUNCATE receipts BEFORE any trigger.
-- The independent BEFORE TRUNCATE guard must also reject TRUNCATE ... CASCADE.
create table sales_attestor_private.accepted_reviews (
  run_id uuid primary key references sales_attestor_private.targets(run_id),
  reviewer_a name not null,
  reviewer_b name not null check(reviewer_a <> reviewer_b),
  binding_sha256 text not null,
  receipt_a_sha256 text not null references sales_attestor_private.receipts(receipt_sha256),
  receipt_b_sha256 text not null references sales_attestor_private.receipts(receipt_sha256),
  foreign key(run_id,reviewer_a) references sales_attestor_private.receipts(run_id,reviewer),
  foreign key(run_id,reviewer_b) references sales_attestor_private.receipts(run_id,reviewer)
);

create function sales_attestor_private.reject_mutation() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='42501', message='SALES_ATTESTOR_IMMUTABLE';
end $$;
create trigger receipts_immutable before update or delete or truncate
  on sales_attestor_private.receipts for each statement
  execute function sales_attestor_private.reject_mutation();
create trigger accepted_reviews_immutable before update or delete or truncate
  on sales_attestor_private.accepted_reviews for each statement
  execute function sales_attestor_private.reject_mutation();
create trigger targets_immutable before update or delete or truncate
  on sales_attestor_private.targets for each statement
  execute function sales_attestor_private.reject_mutation();
create trigger reviewers_immutable before update or delete or truncate
  on sales_attestor_private.reviewers for each statement
  execute function sales_attestor_private.reject_mutation();
alter table sales_attestor_private.receipts enable always trigger receipts_immutable;
alter table sales_attestor_private.accepted_reviews enable always trigger accepted_reviews_immutable;
alter table sales_attestor_private.targets enable always trigger targets_immutable;
alter table sales_attestor_private.reviewers enable always trigger reviewers_immutable;

create function sales_attestor_private.review(p_run_id uuid,p_binding jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  t sales_attestor_private.targets%rowtype;
  prior sales_attestor_private.receipts%rowtype;
  rec sales_attestor_private.receipts%rowtype;
  peer sales_attestor_private.receipts%rowtype;
  grp text;
  observed timestamptz;
  digest text;
begin
  -- session_user is the actual authenticated LOGIN, never current_user (definer),
  -- JWT/JSON observer IDs, SET ROLE, or a signature under caller-selected keys.
  select independence_group into grp from sales_attestor_private.reviewers where reviewer=session_user;
  if grp is null then
    raise exception using errcode='42501', message='SALES_ATTESTOR_INDEPENDENT_LOGIN_REQUIRED';
  end if;
  -- Serialize review pairs and retries on the protected target, including across
  -- two distinct LOGIN connections. No advisory/hash collision lock is needed.
  select * into t from sales_attestor_private.targets where run_id=p_run_id for update;
  if not found or p_binding is distinct from t.binding then
    raise exception using errcode='42501', message='SALES_ATTESTOR_UNTRUSTED_BINDING';
  end if;
  select * into prior from sales_attestor_private.receipts where run_id=p_run_id and reviewer=session_user;
  if found then return to_jsonb(prior); end if; -- exact immutable lost-response readback
  if t.expires_at <= clock_timestamp() then
    raise exception using errcode='42501', message='SALES_ATTESTOR_TARGET_EXPIRED';
  end if;
  observed := clock_timestamp();
  digest := encode(sha256(convert_to(jsonb_build_array('sales-review-receipt/synthetic-v1',
    p_run_id,session_user,grp,t.binding_sha256,observed)::text,'UTF8')),'hex');
  insert into sales_attestor_private.receipts values
    (p_run_id,session_user,grp,t.binding,t.binding_sha256,observed,digest) returning * into rec;
  select * into peer from sales_attestor_private.receipts where run_id=p_run_id and reviewer<>session_user;
  if found then
    if peer.independence_group=grp or peer.binding is distinct from t.binding then
      raise exception using errcode='42501', message='SALES_ATTESTOR_NONINDEPENDENT_PAIR';
    end if;
    insert into sales_attestor_private.accepted_reviews values
      (p_run_id,peer.reviewer,rec.reviewer,t.binding_sha256,peer.receipt_sha256,rec.receipt_sha256);
  end if;
  return to_jsonb(rec);
end $$;

create function sales_attestor_private.read_receipt(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
  if not exists(select from sales_attestor_private.reviewers where reviewer=session_user) then
    raise exception using errcode='42501', message='SALES_ATTESTOR_INDEPENDENT_LOGIN_REQUIRED';
  end if;
  select to_jsonb(r) into result from sales_attestor_private.receipts r
    where run_id=p_run_id and reviewer=session_user;
  return result;
end $$;

alter table sales_attestor_private.reviewers owner to sales_attestor_owner;
alter table sales_attestor_private.targets owner to sales_attestor_owner;
alter table sales_attestor_private.receipts owner to sales_attestor_owner;
alter table sales_attestor_private.accepted_reviews owner to sales_attestor_owner;
alter table sales_attestor_private.reviewers enable row level security;
alter table sales_attestor_private.targets enable row level security;
alter table sales_attestor_private.receipts enable row level security;
alter table sales_attestor_private.accepted_reviews enable row level security;
alter function sales_attestor_private.reject_mutation() owner to sales_attestor_owner;
alter function sales_attestor_private.review(uuid,jsonb) owner to sales_attestor_owner;
alter function sales_attestor_private.read_receipt(uuid) owner to sales_attestor_owner;
revoke all on all tables in schema sales_attestor_private from PUBLIC,anon,authenticated,service_role,sales_reviewer_a,sales_reviewer_b;
revoke all on all functions in schema sales_attestor_private from PUBLIC,anon,authenticated,service_role,sales_reviewer_a,sales_reviewer_b;
grant usage on schema sales_attestor_private to sales_reviewer_a,sales_reviewer_b;
grant execute on function sales_attestor_private.review(uuid,jsonb),sales_attestor_private.read_receipt(uuid)
  to sales_reviewer_a,sales_reviewer_b;
rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.
