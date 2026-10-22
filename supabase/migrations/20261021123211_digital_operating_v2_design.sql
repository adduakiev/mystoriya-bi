-- DESIGN ONLY. NOT APPLIED. Requires separate approval, staging SQL/RLS tests and backup plan.
-- Private schema must NOT be added to PostgREST exposed schemas.
-- Server-only trusted DB connection; no browser/service-role key distribution.
begin;
create schema if not exists operating_private;
revoke all on schema operating_private from public, anon, authenticated;
grant usage on schema operating_private to service_role;

-- No creator-wide default privilege changes: the migration role may be shared.
-- Every future private migration must explicitly REVOKE browser/PUBLIC access
-- on each new table, sequence and function in its creation transaction, enable
-- table RLS, then grant only reviewed server privileges. Never expose this schema.

create table operating_private.operating_runs (
  run_id uuid primary key,
  mode text not null check (mode in ('live','replay')),
  status text not null check (status in ('QUEUED','COLLECTING','QUALITY','SPECIALISTS','COUNCIL','COMPLETED','FAILED','BLOCKED')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  source_as_of timestamptz, evidence_fingerprint text check (evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  collector_version text not null, runtime_version text not null, agent_version text not null,
  collector_at timestamptz, council_at timestamptz,
  error_code text check (error_code in ('PROVIDER_DISABLED','STALE_INPUT','QUALITY_BLOCK','FINGERPRINT_REQUIRED','FINGERPRINT_READ_FAILED','EVIDENCE_CHANGED','MODE_MISMATCH','RUN_FAILED','RECOVERY_REQUIRED')),
  revision integer not null default 1 check (revision > 0),
  check ((status in ('COMPLETED','FAILED','BLOCKED')) = (finished_at is not null)),
  check (finished_at is null or finished_at >= started_at)
);
create index operating_runs_success_idx on operating_private.operating_runs (finished_at desc) where status='COMPLETED';

-- Aggregate projection only: no raw RPC JSON, customers, cookies, prompts or secrets column.
create table operating_private.operating_run_evidence (
  run_id uuid not null references operating_private.operating_runs(run_id), evidence_id text not null,
  source text not null, domain text not null check(domain in ('sales','ads','seo','ux')),
  label text not null, unit text not null, source_date date, observed_at timestamptz, fetched_at timestamptz not null,
  period_from date, period_to date, value double precision, previous double precision, target double precision, forecast double precision,
  direction text not null check(direction in ('higher','lower','neutral')),
  source_status text not null check(source_status in ('AVAILABLE','BROKEN','UNKNOWN')),
  coverage text not null check(coverage in ('FULL','PARTIAL','UNKNOWN')),
  confidence numeric not null check(confidence between 0 and 1),
  quality_status text not null check(quality_status in ('PASS','WARN','BLOCK')),
  freshness_sla_days integer not null check(freshness_sla_days between 0 and 365),
  expected_dates integer check(expected_dates>=0), observed_dates integer check(observed_dates>=0), duplicate_rows integer check(duplicate_rows>=0),
  attribution text not null check(attribution in ('analytics','platform','backend','none')),
  primary key(run_id,evidence_id), check(period_from<=period_to),
  check(value > '-Infinity'::float8 and value < 'Infinity'::float8),
  check(previous > '-Infinity'::float8 and previous < 'Infinity'::float8),
  check(target > '-Infinity'::float8 and target < 'Infinity'::float8),
  check(forecast > '-Infinity'::float8 and forecast < 'Infinity'::float8)
);

-- Validate the only JSON permitted: bounded, schema-checked specialist findings.
create function operating_private.valid_findings(value jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare f jsonb; evidence_id jsonb;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value)>40 or octet_length(value::text)>64000 then return false; end if;
  for f in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(f)<>'object' then return false; end if;
    if not (f ?& array['key','kind','insight','action','evidence_ids','impact_uah','impact_basis'])
      or (f - array['key','kind','insight','action','evidence_ids','impact_uah','impact_basis']) <> '{}'::jsonb
      or f->>'kind' not in ('fact','hypothesis','blocked')
      or jsonb_typeof(f->'kind')<>'string'
      or jsonb_typeof(f->'evidence_ids')<>'array'
      or jsonb_typeof(f->'key')<>'string' or jsonb_typeof(f->'insight')<>'string'
      or jsonb_typeof(f->'action')<>'string' or jsonb_typeof(f->'impact_basis')<>'string'
      or f->'impact_uah' <> 'null'::jsonb then return false; end if;
    if length(f->>'key') not between 1 and 200 or (f->>'key') !~ '^[a-zA-Z0-9_.:-]+$'
      or length(f->>'insight') not between 1 and 4000 or length(btrim(f->>'insight'))=0
      or length(f->>'action') not between 1 and 4000 or length(btrim(f->>'action'))=0
      or length(f->>'impact_basis') not between 1 and 4000 or length(btrim(f->>'impact_basis'))=0
      or jsonb_array_length(f->'evidence_ids')>64
      or (f->>'kind'='fact' and jsonb_array_length(f->'evidence_ids')=0) then return false; end if;
    for evidence_id in select * from jsonb_array_elements(f->'evidence_ids') loop
      if jsonb_typeof(evidence_id) is distinct from 'string' then return false; end if;
      if length(evidence_id #>> '{}') not between 1 and 200
        or length(btrim(evidence_id #>> '{}'))=0 then return false; end if;
    end loop;
  end loop;
  return octet_length(value::text)<=64000;
end $$;

create table operating_private.operating_agent_outputs (
  run_id uuid not null references operating_private.operating_runs(run_id),
  agent_id text not null check(agent_id in ('agent-sales-retail','agent-digital-ads','agent-seo-content','agent-bi-uxui')),
  runtime_version text not null, created_at timestamptz not null default now(),
  summary text not null check(length(summary)<=4000), findings jsonb not null check(operating_private.valid_findings(findings)),
  primary key(run_id,agent_id)
);

create table operating_private.operating_council_items (
  run_id uuid not null references operating_private.operating_runs(run_id), recommendation_id text not null,
  classification text not null check(classification in ('FACT','INFERENCE','RECOMMENDATION','BLOCKED')),
  problem text not null, recommendation text not null, evidence_ids text[] not null,
  confidence numeric not null check(confidence between 0 and 1),
  priority text not null default 'UNASSESSED' check(priority in ('UNASSESSED','P1','P2','P3')),
  priority_basis text, expected_impact text, created_at timestamptz not null default now(),
  primary key(run_id,recommendation_id), check(priority='UNASSESSED' or nullif(priority_basis,'') is not null)
);

create table operating_private.operating_tasks (
  id uuid primary key, recommendation_id text not null, source_run_id uuid not null,
  problem text not null, recommendation text not null, evidence_ids text[] not null, expected_impact text,
  owner text, priority text not null default 'UNASSESSED' check(priority in ('UNASSESSED','P1','P2','P3')),
  priority_basis text, status text not null default 'NEW' check(status in ('NEW','IN PROGRESS','DONE','CHECK RESULT')),
  revision integer not null default 1 check(revision>0), deadline date, check_date date, result text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(source_run_id,recommendation_id) references operating_private.operating_council_items(run_id,recommendation_id),
  unique(source_run_id,recommendation_id),
  check(status='NEW' or nullif(owner,'') is not null),
  check(status<>'CHECK RESULT' or (check_date is not null and nullif(result,'') is not null)),
  check(priority='UNASSESSED' or nullif(priority_basis,'') is not null)
);
create index operating_tasks_status_idx on operating_private.operating_tasks(status,updated_at desc);

-- Run updates are compare-and-swap transactions too; no transition out of a terminal state.
create function operating_private.guard_run() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.status<>'QUEUED' or new.revision<>1 then raise exception 'Invalid initial run'; end if;
  else
    if new.run_id<>old.run_id or new.mode<>old.mode or new.started_at<>old.started_at
      or new.revision<>old.revision+1 then raise exception 'Run revision or identity conflict'; end if;
    if old.status in ('COMPLETED','FAILED','BLOCKED') then raise exception 'Terminal run is immutable'; end if;
    if new.status<>old.status and new.status not in ('FAILED','BLOCKED') and not
      ((old.status='QUEUED' and new.status='COLLECTING') or (old.status='COLLECTING' and new.status='QUALITY')
      or (old.status='QUALITY' and new.status='SPECIALISTS') or (old.status='SPECIALISTS' and new.status='COUNCIL')
      or (old.status='COUNCIL' and new.status='COMPLETED')) then raise exception 'Invalid run transition'; end if;
    if new.status='COMPLETED' and (select count(*) from operating_private.operating_agent_outputs where run_id=new.run_id)<>4
      then raise exception 'Four specialist results required'; end if;
  end if;
  return new;
end $$;
create trigger operating_run_guard before insert or update on operating_private.operating_runs
for each row execute function operating_private.guard_run();

create table operating_private.operating_task_events (
  event_id bigint generated always as identity primary key,
  task_id uuid not null references operating_private.operating_tasks(id), revision integer not null,
  event_type text not null check(event_type in ('CREATED','UPDATED')),
  status text not null, owner text, priority text not null, deadline date, check_date date, result text,
  occurred_at timestamptz not null default now(), unique(task_id,revision)
);

-- Caller must also use WHERE id=:id AND revision=:expected_revision; zero rows -> HTTP 409.
-- Task update + event insertion occur in one DB transaction via triggers, never two client calls.
create function operating_private.guard_task() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.status<>'NEW' or new.revision<>1 then raise exception 'Invalid initial task'; end if;
    if not exists(select 1 from operating_private.operating_runs r
      join operating_private.operating_council_items c on c.run_id=r.run_id
      where r.run_id=new.source_run_id and r.mode='live' and r.status='COMPLETED'
      and r.finished_at>=now()-interval '24 hours' and r.finished_at<=now()
      -- Current = latest eligible completed LIVE run visible to this transaction,
      -- independent of whether that run contains the requested recommendation.
      -- Ties are resolved deterministically by started_at, then UUID (descending).
      and r.run_id=(select latest.run_id from operating_private.operating_runs latest
        where latest.mode='live' and latest.status='COMPLETED'
        and latest.finished_at>=now()-interval '24 hours' and latest.finished_at<=now()
        order by latest.finished_at desc, latest.started_at desc, latest.run_id desc
        limit 1)
      and c.recommendation_id=new.recommendation_id and c.classification='RECOMMENDATION'
      and new.problem is not distinct from c.problem
      and new.recommendation is not distinct from c.recommendation
      and new.evidence_ids is not distinct from c.evidence_ids
      and new.expected_impact is not distinct from c.expected_impact)
      then raise exception 'Matching current live recommendation required'; end if;
  else
    if new.id is distinct from old.id
      or new.source_run_id is distinct from old.source_run_id
      or new.recommendation_id is distinct from old.recommendation_id
      or new.created_at is distinct from old.created_at
      or new.problem is distinct from old.problem
      or new.recommendation is distinct from old.recommendation
      or new.evidence_ids is distinct from old.evidence_ids
      or new.expected_impact is distinct from old.expected_impact
      or new.revision<>old.revision+1 then raise exception 'Revision or immutable task payload conflict'; end if;
    if new.status<>old.status and not ((old.status='NEW' and new.status='IN PROGRESS')
      or (old.status='IN PROGRESS' and new.status='DONE') or (old.status='DONE' and new.status='CHECK RESULT'))
      then raise exception 'Invalid task transition'; end if;
  end if;
  new.updated_at=now(); return new;
end $$;
create trigger operating_task_guard before insert or update on operating_private.operating_tasks
for each row execute function operating_private.guard_task();
create function operating_private.record_task_event() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into operating_private.operating_task_events(task_id,revision,event_type,status,owner,priority,deadline,check_date,result)
  values(new.id,new.revision,case when TG_OP='INSERT' then 'CREATED' else 'UPDATED' end,new.status,new.owner,new.priority,new.deadline,new.check_date,new.result);
  return new;
end $$;
create trigger operating_task_event after insert or update on operating_private.operating_tasks
for each row execute function operating_private.record_task_event();

alter table operating_private.operating_runs enable row level security;
alter table operating_private.operating_run_evidence enable row level security;
alter table operating_private.operating_agent_outputs enable row level security;
alter table operating_private.operating_council_items enable row level security;
alter table operating_private.operating_tasks enable row level security;
alter table operating_private.operating_task_events enable row level security;
-- No browser policies: deny by default. service_role bypasses RLS and must stay server-only.
revoke all on table operating_private.operating_runs from public, anon, authenticated;
revoke all on table operating_private.operating_run_evidence from public, anon, authenticated;
revoke all on table operating_private.operating_agent_outputs from public, anon, authenticated;
revoke all on table operating_private.operating_council_items from public, anon, authenticated;
revoke all on table operating_private.operating_tasks from public, anon, authenticated;
revoke all on table operating_private.operating_task_events from public, anon, authenticated;
revoke all on sequence operating_private.operating_task_events_event_id_seq from public, anon, authenticated;
revoke all on function operating_private.valid_findings(jsonb) from public, anon, authenticated;
revoke all on function operating_private.guard_run() from public, anon, authenticated;
revoke all on function operating_private.guard_task() from public, anon, authenticated;
revoke all on function operating_private.record_task_event() from public, anon, authenticated;
grant select,insert,update on operating_private.operating_runs, operating_private.operating_tasks to service_role;
grant select,insert on operating_private.operating_run_evidence, operating_private.operating_agent_outputs,
  operating_private.operating_council_items, operating_private.operating_task_events to service_role;
grant usage,select on sequence operating_private.operating_task_events_event_id_seq to service_role;
grant execute on function operating_private.valid_findings(jsonb), operating_private.guard_run(),
  operating_private.guard_task(), operating_private.record_task_event() to service_role;
commit;
