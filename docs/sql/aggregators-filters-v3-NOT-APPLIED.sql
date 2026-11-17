-- REVIEW CANDIDATE ONLY — NOT APPLIED. Not part of migrations.
-- Based on repository main 946a6c2. Verify installed definitions before promotion.
-- Native PostgreSQL fixture tests, access-control review and production parity required.
-- Web remains gated by BI_AGGREGATORS_FILTERS_V3=1 until this RPC is accepted.
-- All dimension filters share ONE warehouse snapshot and comparison window.
-- Weekly scope = Monday–Sunday ISO; LY = same ISO week and elapsed weekdays.
-- Missing prior-year W53 fails closed; never treat it as zero or W01.
-- No credentials or production records belong in this file.

CREATE OR REPLACE FUNCTION public.bi_aggregators_payload_v3(p_password text, p_period text DEFAULT 'ytd', p_comparison text DEFAULT 'ly', p_lfl boolean DEFAULT false, p_year integer DEFAULT NULL, p_month integer DEFAULT NULL, p_brand text DEFAULT NULL, p_ownership text DEFAULT NULL, p_location text DEFAULT NULL, p_order_type text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_filter_options jsonb;
  v_locations jsonb;
  v_selected_year integer;
  v_prior_iso_year integer;
  v_actual_hash text;
  v_period text;
  v_comparison text;
  v_cutoff date;
  v_current_start date;
  v_current_end date;
  v_previous_start date;
  v_previous_end date;
  v_current_revenue numeric := 0;
  v_current_checks numeric := 0;
  v_current_markup numeric := 0;
  v_previous_revenue numeric := 0;
  v_previous_checks numeric := 0;
  v_previous_markup numeric := 0;
  v_current_aov numeric := 0;
  v_current_markup_rate numeric := 0;
  v_previous_aov numeric := 0;
  v_previous_markup_rate numeric := 0;
  v_period_label text;
  v_comparison_label text;
  v_rows bigint := 0;
  v_trend jsonb := '[]'::jsonb;
  v_aggregators jsonb := '[]'::jsonb;
  v_month_names text[] := array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  v_weekday_names text[] := array['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  if p_year is not null and (p_year < 1900 or p_year > 9999) then raise exception 'invalid_year'; end if;
  if p_month is not null and (p_month < 1 or p_month > 12) then raise exception 'invalid_month'; end if;
  if p_month is not null and p_period <> 'month' then raise exception 'invalid_period'; end if;

  v_period := case when p_period in ('ytd','month','week') then p_period else 'ytd' end;
  v_comparison := case when p_comparison='previous' then 'previous' else 'ly' end;

  drop table if exists pg_temp._ag_v3_base;
  create temporary table pg_temp._ag_v3_base(
    date_id date not null,
    order_type text not null,
    location text not null,
    brand text not null,
    ownership text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;

  insert into pg_temp._ag_v3_base
  select date,order_type,location,brand,ownership,revenue,checks,markup
  from public.bi_sales_flat_mv
  where channel='Агрегатор'
    and (not p_lfl or not lfl_exclude);

  -- Catalog uses the same warehouse snapshot and registry LFL cohort.
  select jsonb_build_object(
    'years',coalesce(jsonb_agg(distinct extract(year from date_id)::int),'[]'::jsonb),
    'brands',coalesce(jsonb_agg(distinct brand),'[]'::jsonb),
    'ownerships',coalesce(jsonb_agg(distinct ownership),'[]'::jsonb),
    'locations',coalesce(jsonb_agg(distinct location),'[]'::jsonb),
    'orderTypes',coalesce(jsonb_agg(distinct order_type),'[]'::jsonb)
  ) into v_filter_options from pg_temp._ag_v3_base;
  delete from pg_temp._ag_v3_base
  where (p_brand is not null and brand <> p_brand)
     or (p_ownership is not null and ownership <> p_ownership)
     or (p_location is not null and location <> p_location)
     or (p_order_type is not null and order_type <> p_order_type);
  select count(*) into v_rows from pg_temp._ag_v3_base;
  select coalesce(p_year,extract(year from max(date_id))::int) into v_selected_year from pg_temp._ag_v3_base;
  select max(date_id) into v_cutoff from pg_temp._ag_v3_base
  where extract(year from date_id)::int=v_selected_year
    and (p_month is null or extract(month from date_id)::int=p_month);
  -- Empty requested periods fail closed, never silently return source maximum.
  if v_cutoff is null then raise exception 'no_data'; end if;

  if v_period='week' then
    v_current_start := date_trunc('week',v_cutoff)::date;
    v_current_end := v_cutoff;
    v_period_label := 'Поточний тиждень';
  elsif v_period='month' then
    v_current_start := date_trunc('month',v_cutoff)::date;
    v_current_end := v_cutoff;
    v_period_label := v_month_names[extract(month from v_cutoff)::int] || ' ' || extract(year from v_cutoff)::int;
  else
    v_current_start := make_date(extract(year from v_cutoff)::int,1,1);
    v_current_end := v_cutoff;
    v_period_label := extract(year from v_cutoff)::int::text;
  end if;

  if v_period='week' and v_comparison='ly' then
    v_prior_iso_year := extract(isoyear from v_cutoff)::int-1;
    v_previous_start := date_trunc('week',make_date(v_prior_iso_year,1,4))::date
      + (extract(week from v_cutoff)::int-1)*7;
    -- W53 may not exist in the comparison ISO year. Do not alias it to W01.
    if extract(isoyear from v_previous_start)::int <> v_prior_iso_year then
      raise exception 'iso_comparison_unavailable';
    end if;
    v_previous_end := v_previous_start + (v_current_end-v_current_start);
    v_comparison_label := 'ISO LY';
  elsif v_comparison='ly' or v_period='ytd' then
    v_previous_start := (v_current_start - interval '1 year')::date;
    v_previous_end := (v_current_end - interval '1 year')::date;
    v_comparison_label := case when v_period='ytd'
      then extract(year from v_previous_end)::int::text else 'LY' end;
  elsif v_period='week' then
    v_previous_start := v_current_start - 7;
    v_previous_end := v_current_end - 7;
    v_comparison_label := 'Попередній тиждень';
  else
    v_previous_start := (v_current_start - interval '1 month')::date;
    v_previous_end := least(
      (date_trunc('month',v_previous_start)::date + interval '1 month - 1 day')::date,
      v_previous_start + (v_current_end-v_current_start)
    );
    v_comparison_label := 'Попередній місяць';
  end if;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_current_revenue,v_current_checks,v_current_markup
  from pg_temp._ag_v3_base where date_id between v_current_start and v_current_end;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_previous_revenue,v_previous_checks,v_previous_markup
  from pg_temp._ag_v3_base where date_id between v_previous_start and v_previous_end;

  v_current_aov := case when v_current_checks<>0 then v_current_revenue/v_current_checks else 0 end;
  v_current_markup_rate := case when v_current_revenue<>0 then v_current_markup/v_current_revenue*100 else 0 end;
  v_previous_aov := case when v_previous_checks<>0 then v_previous_revenue/v_previous_checks else 0 end;
  v_previous_markup_rate := case when v_previous_revenue<>0 then v_previous_markup/v_previous_revenue*100 else 0 end;

  if v_period='ytd' then
    with points as (
      select generate_series(1,extract(month from v_current_end)::int) as n
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label',v_month_names[n],
        'current',coalesce((select sum(revenue) from pg_temp._ag_v3_base where extract(year from date_id)=extract(year from v_current_end) and extract(month from date_id)=n and date_id between v_current_start and v_current_end),0),
        'previous',coalesce((select sum(revenue) from pg_temp._ag_v3_base where extract(year from date_id)=extract(year from v_previous_end) and extract(month from date_id)=n and date_id between v_previous_start and v_previous_end),0)
      ) order by n
    ),'[]'::jsonb)
    into v_trend from points;
  else
    with points as (
      select generate_series(0,(v_current_end-v_current_start)) as n
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label',case
          when v_period='week' then v_weekday_names[extract(dow from (v_current_start+n))::int+1]
          else extract(day from (v_current_start+n))::int::text
        end,
        'current',coalesce((select sum(revenue) from pg_temp._ag_v3_base where date_id=v_current_start+n),0),
        'previous',case when v_previous_start+n<=v_previous_end
          then coalesce((select sum(revenue) from pg_temp._ag_v3_base where date_id=v_previous_start+n),0)
          else 0 end
      ) order by n
    ),'[]'::jsonb)
    into v_trend from points;
  end if;

  with cur as (
    select order_type,
      sum(revenue) revenue,
      sum(checks) checks,
      sum(markup) markup
    from pg_temp._ag_v3_base
    where date_id between v_current_start and v_current_end
    group by order_type
  ),
  prev as (
    select order_type,sum(revenue) revenue
    from pg_temp._ag_v3_base
    where date_id between v_previous_start and v_previous_end
    group by order_type
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',cur.order_type,
      'revenue',cur.revenue,
      'checks',cur.checks,
      'averageCheck',case when cur.checks<>0 then cur.revenue/cur.checks else 0 end,
      'markupRate',case when cur.revenue<>0 then cur.markup/cur.revenue*100 else 0 end,
      'growth',case when coalesce(prev.revenue,0)=0 then null else (cur.revenue/prev.revenue-1)*100 end,
      'share',case when v_current_revenue<>0 then cur.revenue/v_current_revenue*100 else 0 end
    ) order by cur.revenue desc
  ),'[]'::jsonb)
  into v_aggregators
  from cur left join prev using(order_type);

  with cur as (
    select location,sum(revenue) revenue from pg_temp._ag_v3_base
    where date_id between v_current_start and v_current_end group by location
  ), prev as (
    select location,sum(revenue) revenue from pg_temp._ag_v3_base
    where date_id between v_previous_start and v_previous_end group by location
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',cur.location,'revenue',cur.revenue,
    'growth',case when coalesce(prev.revenue,0)=0 then null else (cur.revenue/prev.revenue-1)*100 end,
    'share',case when v_current_revenue<>0 then cur.revenue/v_current_revenue*100 else 0 end
  ) order by cur.revenue desc),'[]'::jsonb)
  into v_locations from (select * from cur order by revenue desc limit 8) cur left join prev using(location);

  return jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
      'contractVersion','aggregators-filters-v3',
      'filterOptions',v_filter_options,
      'requestedFilters',jsonb_build_object('year',p_year,'month',p_month,'brand',p_brand,
        'ownership',p_ownership,'location',p_location,'orderType',p_order_type,'lfl',p_lfl),
      'rowCount',v_rows,
      'cutoffDate',v_cutoff,
      'period',v_period,
      'comparison',v_comparison,
      'periodLabel',v_period_label,
      'comparisonLabel',v_comparison_label,
      'currentYear',extract(year from v_cutoff)::int,
      'previousYear',extract(year from v_previous_end)::int
    ),
    'current',jsonb_build_object(
      'revenue',v_current_revenue,'checks',v_current_checks,'markup',v_current_markup,
      'averageCheck',v_current_aov,'markupRate',v_current_markup_rate
    ),
    'previous',jsonb_build_object(
      'revenue',v_previous_revenue,'checks',v_previous_checks,'markup',v_previous_markup,
      'averageCheck',v_previous_aov,'markupRate',v_previous_markup_rate
    ),
    'trend',v_trend,
    'locations',v_locations,
    'aggregators',v_aggregators
  );
end;
$function$
;


REVOKE ALL ON FUNCTION public.bi_aggregators_payload_v3(text,text,text,boolean,integer,integer,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bi_aggregators_payload_v3(text,text,text,boolean,integer,integer,text,text,text,text) TO anon, authenticated, service_role;

