create extension if not exists pgcrypto;

create table if not exists dim_date (
  date_id date primary key,
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  month int not null check (month between 1 and 12),
  month_name text not null,
  iso_week int not null check (iso_week between 1 and 53),
  week_start date not null,
  month_start date not null,
  day_of_week int not null check (day_of_week between 1 and 7),
  is_weekend boolean not null
);

create table if not exists dim_brand (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists dim_ownership (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists dim_location (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  city text,
  brand_id uuid references dim_brand(id),
  ownership_id uuid references dim_ownership(id),
  open_date date,
  close_date date,
  lfl_from date,
  lfl_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dim_channel (
  id uuid primary key default gen_random_uuid(),
  channel_group text not null,
  channel_name text not null,
  is_owned boolean not null default false,
  is_aggregator boolean not null default false,
  unique(channel_group, channel_name)
);

create table if not exists dim_order_type (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  normalized_group text
);

create table if not exists fact_sales_daily (
  id bigint generated always as identity primary key,
  date_id date not null references dim_date(date_id),
  location_id uuid not null references dim_location(id),
  brand_id uuid not null references dim_brand(id),
  ownership_id uuid not null references dim_ownership(id),
  channel_id uuid not null references dim_channel(id),
  order_type_id uuid not null references dim_order_type(id),
  revenue numeric(16,2) not null default 0,
  checks numeric(16,2) not null default 0,
  markup numeric(16,2) not null default 0,
  source_row_hash text,
  imported_at timestamptz not null default now(),
  unique(date_id, location_id, brand_id, ownership_id, channel_id, order_type_id)
);

create index if not exists idx_fact_sales_daily_date on fact_sales_daily(date_id);
create index if not exists idx_fact_sales_daily_location on fact_sales_daily(location_id);
create index if not exists idx_fact_sales_daily_channel on fact_sales_daily(channel_id);
create index if not exists idx_fact_sales_daily_brand on fact_sales_daily(brand_id);
create index if not exists idx_fact_sales_daily_ownership on fact_sales_daily(ownership_id);
create index if not exists idx_fact_sales_daily_order_type on fact_sales_daily(order_type_id);

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_name text not null,
  source_cutoff_date date,
  rows_read int default 0,
  rows_loaded int default 0,
  rows_rejected int default 0,
  status text not null default 'running',
  details jsonb not null default '{}'::jsonb
);

create table if not exists staging_sales_raw (
  id bigint generated always as identity primary key,
  import_run_id uuid not null references import_runs(id) on delete cascade,
  source_row_number int not null,
  accounting_date_raw text,
  location_raw text,
  brand_raw text,
  ownership_raw text,
  channel_group_raw text,
  order_type_raw text,
  revenue_raw text,
  checks_raw text,
  markup_raw text,
  source_payload jsonb not null default '{}'::jsonb,
  loaded_at timestamptz not null default now(),
  unique(import_run_id, source_row_number)
);

create table if not exists map_location_source (
  source_name text primary key,
  canonical_name text not null,
  is_active boolean not null default true,
  notes text
);

create table if not exists data_quality_issues (
  id bigint generated always as identity primary key,
  import_run_id uuid references import_runs(id) on delete cascade,
  source_row_number int,
  issue_type text not null,
  severity text not null check (severity in ('info','warning','error')),
  field_name text,
  raw_value text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_dim_location_brand on dim_location(brand_id);
create index if not exists idx_dim_location_ownership on dim_location(ownership_id);
create index if not exists idx_data_quality_import_run on data_quality_issues(import_run_id);
create index if not exists idx_staging_sales_raw_import_run on staging_sales_raw(import_run_id);

alter table dim_date enable row level security;
alter table dim_brand enable row level security;
alter table dim_ownership enable row level security;
alter table dim_location enable row level security;
alter table dim_channel enable row level security;
alter table dim_order_type enable row level security;
alter table fact_sales_daily enable row level security;
alter table import_runs enable row level security;
alter table staging_sales_raw enable row level security;
alter table map_location_source enable row level security;
alter table data_quality_issues enable row level security;

insert into map_location_source(source_name, canonical_name) values
('Ахматова NEW','Ахматова'),
('Европарк NEW','Європарк'),
('Оболонь NEW','Оболонь'),
('Теремки NEW','Теремки'),
('Кудряшова new','Кудряшова'),
('Парк Авеню NEW','Парк Авеню'),
('София new','Софія'),
('Софія (NEW)','Софія')
on conflict (source_name) do update set canonical_name = excluded.canonical_name;


create table if not exists location_lifecycle_registry (
  canonical_name text primary key,
  status text not null check (status in ('active','closed')),
  lfl_exclude boolean not null default false,
  close_date date,
  notes text,
  updated_at timestamptz not null default now()
);

alter table location_lifecycle_registry enable row level security;

insert into location_lifecycle_registry(canonical_name, status, lfl_exclude, notes) values
('Кудряшова', 'closed', true, 'Мокра / Кудряшова'),
('Європарк', 'closed', true, 'Closed location'),
('Поділ', 'closed', true, 'Closed location'),
('Піраміда', 'closed', true, 'Closed location'),
('Черкаси', 'closed', true, 'Closed location'),
('Сверстюка', 'closed', true, 'Closed location'),
('ЖК Галактика', 'closed', true, 'Closed location')
on conflict (canonical_name) do update
set status = excluded.status,
    lfl_exclude = excluded.lfl_exclude,
    notes = excluded.notes,
    updated_at = now();
