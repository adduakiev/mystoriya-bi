create extension if not exists pgcrypto;

create table if not exists dim_date (
  date_id date primary key,
  year int not null,
  quarter int not null,
  month int not null,
  month_name text not null,
  iso_week int not null,
  week_start date not null,
  month_start date not null,
  day_of_week int not null,
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
  is_active boolean not null default true
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
  brand_id uuid references dim_brand(id),
  ownership_id uuid references dim_ownership(id),
  channel_id uuid not null references dim_channel(id),
  order_type_id uuid references dim_order_type(id),
  revenue numeric(16,2) not null default 0,
  checks numeric(16,2) not null default 0,
  markup numeric(16,2) not null default 0,
  source_row_hash text,
  imported_at timestamptz not null default now(),
  unique(date_id, location_id, channel_id, order_type_id)
);

create index if not exists idx_fact_sales_daily_date on fact_sales_daily(date_id);
create index if not exists idx_fact_sales_daily_location on fact_sales_daily(location_id);
create index if not exists idx_fact_sales_daily_channel on fact_sales_daily(channel_id);

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_name text not null,
  rows_read int default 0,
  rows_loaded int default 0,
  rows_rejected int default 0,
  status text not null default 'running',
  details jsonb not null default '{}'::jsonb
);
