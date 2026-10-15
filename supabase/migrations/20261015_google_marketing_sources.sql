-- Google marketing sources for Digital Intelligence.
create table if not exists public.digital_google_ads_daily (
  date_id date primary key,cost numeric(18,4) not null default 0,clicks bigint not null default 0,impressions bigint not null default 0,
  conversions numeric(18,4) not null default 0,conversion_value numeric(18,4) not null default 0,imported_at timestamptz not null default now()
);
create table if not exists public.digital_google_ads_campaign_snapshot (
  period_end date not null,period_days integer not null default 30,campaign_name text not null,cost numeric(18,4) not null default 0,
  clicks bigint not null default 0,impressions bigint not null default 0,conversions numeric(18,4) not null default 0,
  conversion_value numeric(18,4) not null default 0,imported_at timestamptz not null default now(),primary key(period_end,period_days,campaign_name)
);
create table if not exists public.digital_pagespeed_snapshot (
  captured_on date primary key,desktop_score numeric(10,2),mobile_score numeric(10,2),desktop_lcp numeric(12,2),desktop_inp numeric(12,2),
  desktop_cls numeric(12,4),mobile_lcp numeric(12,2),mobile_inp numeric(12,2),mobile_cls numeric(12,4),desktop_category text,mobile_category text,
  imported_at timestamptz not null default now()
);
create table if not exists public.digital_gbp_daily (
  date_id date not null,location_id text not null,location_title text not null,impressions bigint not null default 0,clicks bigint not null default 0,
  call_clicks bigint not null default 0,website_clicks bigint not null default 0,direction_requests bigint not null default 0,menu_clicks bigint not null default 0,
  imported_at timestamptz not null default now(),primary key(date_id,location_id)
);
alter table public.digital_google_ads_daily enable row level security;
alter table public.digital_google_ads_campaign_snapshot enable row level security;
alter table public.digital_pagespeed_snapshot enable row level security;
alter table public.digital_gbp_daily enable row level security;
revoke all on public.digital_google_ads_daily,public.digital_google_ads_campaign_snapshot,public.digital_pagespeed_snapshot,public.digital_gbp_daily from anon,authenticated;
create index if not exists idx_digital_gbp_date on public.digital_gbp_daily(date_id);
-- RPC definitions are managed in Supabase and password-gated like other BI payloads.
