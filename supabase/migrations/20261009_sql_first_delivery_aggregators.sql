-- SQL-first payloads for Aggregators and Delivery.
-- Runtime password hashes remain in public.bi_runtime_config and are not versioned here.

CREATE OR REPLACE FUNCTION public.bi_aggregators_payload(p_password text, p_period text DEFAULT 'ytd'::text, p_comparison text DEFAULT 'ly'::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
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

  v_period := case when p_period in ('ytd','month','week') then p_period else 'ytd' end;
  v_comparison := case when p_comparison='previous' then 'previous' else 'ly' end;

  create temporary table if not exists _ag_base(
    date_id date not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _ag_base;

  insert into _ag_base
  select
    f.date_id,
    ot.name,
    f.revenue,
    f.checks,
    f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_channel c on c.id=f.channel_id
  join public.dim_order_type ot on ot.id=f.order_type_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where c.channel_group='Агрегатор'
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  select count(*), max(date_id) into v_rows, v_cutoff from _ag_base;
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

  if v_comparison='ly' or v_period='ytd' then
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
  from _ag_base where date_id between v_current_start and v_current_end;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_previous_revenue,v_previous_checks,v_previous_markup
  from _ag_base where date_id between v_previous_start and v_previous_end;

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
        'current',coalesce((select sum(revenue) from _ag_base where extract(year from date_id)=extract(year from v_current_end) and extract(month from date_id)=n),0),
        'previous',coalesce((select sum(revenue) from _ag_base where extract(year from date_id)=extract(year from v_previous_end) and extract(month from date_id)=n),0)
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
        'current',coalesce((select sum(revenue) from _ag_base where date_id=v_current_start+n),0),
        'previous',case when v_previous_start+n<=v_previous_end
          then coalesce((select sum(revenue) from _ag_base where date_id=v_previous_start+n),0)
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
    from _ag_base
    where date_id between v_current_start and v_current_end
    group by order_type
  ),
  prev as (
    select order_type,sum(revenue) revenue
    from _ag_base
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

  return jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
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
    'aggregators',v_aggregators
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.bi_aggregators_payload_v2(p_password text, p_period text DEFAULT 'ytd'::text, p_comparison text DEFAULT 'ly'::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_payload jsonb;
  v_cutoff date;
  v_period text;
  v_comparison text;
  v_current_start date;
  v_current_end date;
  v_previous_start date;
  v_previous_end date;
  v_current_revenue numeric := 0;
  v_locations jsonb := '[]'::jsonb;
begin
  v_payload := public.bi_aggregators_payload(p_password,p_period,p_comparison,p_lfl);
  v_cutoff := (v_payload->'meta'->>'cutoffDate')::date;
  v_period := coalesce(v_payload->'meta'->>'period','ytd');
  v_comparison := coalesce(v_payload->'meta'->>'comparison','ly');
  v_current_revenue := coalesce((v_payload->'current'->>'revenue')::numeric,0);

  if v_period='week' then
    v_current_start := date_trunc('week',v_cutoff)::date;
    v_current_end := v_cutoff;
  elsif v_period='month' then
    v_current_start := date_trunc('month',v_cutoff)::date;
    v_current_end := v_cutoff;
  else
    v_current_start := make_date(extract(year from v_cutoff)::int,1,1);
    v_current_end := v_cutoff;
  end if;

  if v_comparison='ly' or v_period='ytd' then
    v_previous_start := (v_current_start - interval '1 year')::date;
    v_previous_end := (v_current_end - interval '1 year')::date;
  elsif v_period='week' then
    v_previous_start := v_current_start-7;
    v_previous_end := v_current_end-7;
  else
    v_previous_start := (v_current_start - interval '1 month')::date;
    v_previous_end := least(
      (date_trunc('month',v_previous_start)::date + interval '1 month - 1 day')::date,
      v_previous_start + (v_current_end-v_current_start)
    );
  end if;

  with base as (
    select
      f.date_id,
      l.canonical_name as location,
      f.revenue
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    join public.dim_channel c on c.id=f.channel_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where c.channel_group='Агрегатор'
      and (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ),
  cur as (
    select location,sum(revenue) revenue
    from base
    where date_id between v_current_start and v_current_end
    group by location
  ),
  prev as (
    select location,sum(revenue) revenue
    from base
    where date_id between v_previous_start and v_previous_end
    group by location
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',cur.location,
      'revenue',cur.revenue,
      'growth',case when coalesce(prev.revenue,0)=0 then null else (cur.revenue/prev.revenue-1)*100 end,
      'share',case when v_current_revenue<>0 then cur.revenue/v_current_revenue*100 else 0 end
    ) order by cur.revenue desc
  ),'[]'::jsonb)
  into v_locations
  from (
    select * from cur order by revenue desc limit 8
  ) cur
  left join prev using(location);

  return v_payload || jsonb_build_object('locations',v_locations);
end;
$function$


CREATE OR REPLACE FUNCTION public.bi_delivery_payload(p_password text, p_order_type text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_focus_year integer DEFAULT NULL::integer, p_focus_month integer DEFAULT NULL::integer, p_metric text DEFAULT 'revenue'::text, p_grain text DEFAULT 'month'::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_source_latest date;
  v_selected_year integer;
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
  v_delivery_revenue numeric := 0;
  v_delivery_checks numeric := 0;
  v_delivery_markup numeric := 0;
  v_aggregator_revenue numeric := 0;
  v_aggregator_checks numeric := 0;
  v_aggregator_markup numeric := 0;
  v_period_label text;
  v_metric text;
  v_grain text;
  v_years integer[] := '{}';
  v_months integer[] := '{}';
  v_types jsonb := '[]'::jsonb;
  v_locations jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_type_summary jsonb := '[]'::jsonb;
  v_multi_year jsonb := '[]'::jsonb;
  v_compare_series jsonb := '[]'::jsonb;
  v_location_rows jsonb := '[]'::jsonb;
  v_row_count bigint := 0;
  v_month_names text[] := array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  v_source_cutoff_month integer;
  v_source_cutoff_day integer;
  v_multi_max integer;
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  v_metric := case when p_metric in ('revenue','checks','averageCheck','markupRate') then p_metric else 'revenue' end;
  v_grain := case when p_grain='week' then 'week' else 'month' end;

  select max(date_id),
         coalesce(array_agg(distinct extract(year from date_id)::int order by extract(year from date_id)::int),'{}')
  into v_source_latest,v_years
  from public.fact_sales_daily;

  if v_source_latest is null then raise exception 'no_data'; end if;
  v_selected_year := coalesce(p_focus_year,extract(year from v_source_latest)::int);

  create temporary table if not exists _del_main(
    date_id date not null,
    location text not null,
    brand text not null,
    ownership text not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _del_main;

  insert into _del_main
  select f.date_id,l.canonical_name,b.name,o.name,ot.name,f.revenue,f.checks,f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  join public.dim_order_type ot on ot.id=f.order_type_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where c.channel_group='Доставка'
    and (p_order_type is null or ot.name=p_order_type)
    and (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  create temporary table if not exists _del_all(
    date_id date not null,
    location text not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _del_all;

  insert into _del_all
  select f.date_id,l.canonical_name,ot.name,f.revenue,f.checks,f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  join public.dim_order_type ot on ot.id=f.order_type_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where c.channel_group='Доставка'
    and (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  create temporary table if not exists _del_agg(
    date_id date not null,
    location text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _del_agg;

  insert into _del_agg
  select f.date_id,l.canonical_name,f.revenue,f.checks,f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where c.channel_group='Агрегатор'
    and (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  create temporary table if not exists _del_all_channels(
    date_id date not null,
    location text not null,
    channel text not null,
    revenue numeric not null
  ) on commit drop;
  truncate table _del_all_channels;

  insert into _del_all_channels
  select f.date_id,l.canonical_name,c.channel_group,f.revenue
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  select max(date_id) into v_cutoff
  from _del_main
  where extract(year from date_id)::int=v_selected_year
    and (p_focus_month is null or extract(month from date_id)::int=p_focus_month);

  if v_cutoff is null then
    select max(date_id) into v_cutoff from _del_main;
  end if;
  if v_cutoff is null then raise exception 'no_data'; end if;

  if p_focus_month is not null then
    v_current_start := date_trunc('month',v_cutoff)::date;
    v_current_end := v_cutoff;
    v_period_label := v_month_names[extract(month from v_cutoff)::int] || ' ' || extract(year from v_cutoff)::int;
  else
    v_current_start := make_date(extract(year from v_cutoff)::int,1,1);
    v_current_end := v_cutoff;
    v_period_label := extract(year from v_cutoff)::int::text;
  end if;

  v_previous_start := (v_current_start - interval '1 year')::date;
  v_previous_end := (v_current_end - interval '1 year')::date;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_current_revenue,v_current_checks,v_current_markup
  from _del_main where date_id between v_current_start and v_current_end;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_previous_revenue,v_previous_checks,v_previous_markup
  from _del_main where date_id between v_previous_start and v_previous_end;

  v_current_aov := case when v_current_checks<>0 then v_current_revenue/v_current_checks else 0 end;
  v_current_markup_rate := case when v_current_revenue<>0 then v_current_markup/v_current_revenue*100 else 0 end;
  v_previous_aov := case when v_previous_checks<>0 then v_previous_revenue/v_previous_checks else 0 end;
  v_previous_markup_rate := case when v_previous_revenue<>0 then v_previous_markup/v_previous_revenue*100 else 0 end;

  select count(*),coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_row_count,v_delivery_revenue,v_delivery_checks,v_delivery_markup
  from _del_all where date_id between v_current_start and v_current_end;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_aggregator_revenue,v_aggregator_checks,v_aggregator_markup
  from _del_agg where date_id between v_current_start and v_current_end;

  select coalesce(array_agg(m order by m),'{}')
  into v_months
  from (
    select distinct extract(month from date_id)::int m
    from _del_main
    where extract(year from date_id)::int=v_selected_year
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_types
  from (select distinct order_type name from _del_all) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_locations
  from (
    select distinct l.canonical_name name
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_brands
  from (
    select distinct b.name
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    join public.dim_brand b on b.id=f.brand_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_ownerships
  from (
    select distinct o.name
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    join public.dim_ownership o on o.id=f.ownership_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

  with g as (
    select order_type,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _del_all
    where date_id between v_current_start and v_current_end
    group by order_type
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',order_type,
      'revenue',revenue,
      'checks',checks,
      'averageCheck',case when checks<>0 then revenue/checks else 0 end,
      'markupRate',case when revenue<>0 then markup/revenue*100 else 0 end,
      'share',case when v_delivery_revenue<>0 then revenue/v_delivery_revenue*100 else 0 end
    ) order by revenue desc
  ),'[]'::jsonb)
  into v_type_summary from g;

  v_source_cutoff_month := extract(month from v_source_latest)::int;
  v_source_cutoff_day := extract(day from v_source_latest)::int;

  if p_focus_month is not null then
    if p_focus_month=v_source_cutoff_month then
      v_multi_max := v_source_cutoff_day;
    else
      v_multi_max := extract(day from (
        date_trunc('month',make_date(extract(year from v_source_latest)::int,p_focus_month,1))::date
        + interval '1 month - 1 day'
      ))::int;
    end if;

    with pts as (select generate_series(1,v_multi_max) n),
    yrs as (select unnest(v_years) y),
    vals as (
      select pts.n,yrs.y,
        coalesce(sum(d.revenue),0) revenue,
        coalesce(sum(d.checks),0) checks,
        coalesce(sum(d.markup),0) markup
      from pts cross join yrs
      left join _del_main d
        on extract(year from d.date_id)::int=yrs.y
       and extract(month from d.date_id)::int=p_focus_month
       and extract(day from d.date_id)::int=pts.n
      group by pts.n,yrs.y
    ),
    objs as (
      select n,
        jsonb_build_object('label',n::text) ||
        jsonb_object_agg(y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
            else revenue
          end order by y
        ) obj
      from vals group by n
    )
    select coalesce(jsonb_agg(obj order by n),'[]'::jsonb)
    into v_multi_year from objs;

  elsif v_grain='week' then
    v_multi_max := extract(week from v_source_latest)::int;
    with pts as (select generate_series(1,v_multi_max) n),
    yrs as (select unnest(v_years) y),
    vals as (
      select pts.n,yrs.y,
        coalesce(sum(d.revenue),0) revenue,
        coalesce(sum(d.checks),0) checks,
        coalesce(sum(d.markup),0) markup
      from pts cross join yrs
      left join _del_main d
        on extract(year from d.date_id)::int=yrs.y
       and extract(week from d.date_id)::int=pts.n
      group by pts.n,yrs.y
    ),
    objs as (
      select n,
        jsonb_build_object('label','W'||lpad(n::text,2,'0')) ||
        jsonb_object_agg(y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
            else revenue
          end order by y
        ) obj
      from vals group by n
    )
    select coalesce(jsonb_agg(obj order by n),'[]'::jsonb)
    into v_multi_year from objs;

  else
    with pts as (select generate_series(1,12) n),
    yrs as (select unnest(v_years) y),
    vals as (
      select pts.n,yrs.y,
        coalesce(sum(d.revenue),0) revenue,
        coalesce(sum(d.checks),0) checks,
        coalesce(sum(d.markup),0) markup
      from pts cross join yrs
      left join _del_main d
        on extract(year from d.date_id)::int=yrs.y
       and extract(month from d.date_id)::int=pts.n
       and (pts.n<>v_source_cutoff_month or extract(day from d.date_id)::int<=v_source_cutoff_day)
      group by pts.n,yrs.y
    ),
    objs as (
      select n,
        jsonb_build_object('label',v_month_names[n]) ||
        jsonb_object_agg(y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
            else revenue
          end order by y
        ) obj
      from vals group by n
    )
    select coalesce(jsonb_agg(obj order by n),'[]'::jsonb)
    into v_multi_year from objs;
  end if;

  with months as (
    select generate_series(
      case when p_focus_month is not null then p_focus_month else 1 end,
      case when p_focus_month is not null then p_focus_month else extract(month from v_cutoff)::int end
    ) n
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label',left(v_month_names[n],3),
      'delivery',coalesce((
        select sum(revenue) from _del_all
        where extract(year from date_id)::int=v_selected_year
          and extract(month from date_id)::int=n
          and (n<>extract(month from v_cutoff)::int or extract(day from date_id)::int<=extract(day from v_cutoff)::int)
      ),0),
      'aggregator',coalesce((
        select sum(revenue) from _del_agg
        where extract(year from date_id)::int=v_selected_year
          and extract(month from date_id)::int=n
          and (n<>extract(month from v_cutoff)::int or extract(day from date_id)::int<=extract(day from v_cutoff)::int)
      ),0)
    ) order by n
  ),'[]'::jsonb)
  into v_compare_series from months;

  with cur as (
    select location,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _del_all
    where date_id between v_current_start and v_current_end
    group by location
  ),
  prev as (
    select location,sum(revenue) revenue
    from _del_all
    where date_id between v_previous_start and v_previous_end
    group by location
  ),
  totals as (
    select location,sum(revenue) revenue
    from _del_all_channels
    where date_id between v_current_start and v_current_end
    group by location
  ),
  ag as (
    select location,sum(revenue) revenue
    from _del_agg
    where date_id between v_current_start and v_current_end
    group by location
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',cur.location,
      'revenue',cur.revenue,
      'growth',case when coalesce(prev.revenue,0)=0 then null else (cur.revenue/prev.revenue-1)*100 end,
      'checks',cur.checks,
      'averageCheck',case when cur.checks<>0 then cur.revenue/cur.checks else 0 end,
      'markupRate',case when cur.revenue<>0 then cur.markup/cur.revenue*100 else 0 end,
      'deliveryShare',case when coalesce(totals.revenue,0)<>0 then cur.revenue/totals.revenue*100 else 0 end,
      'aggregatorRevenue',coalesce(ag.revenue,0),
      'versusAggregator',case when coalesce(ag.revenue,0)<>0 then cur.revenue/ag.revenue*100 else 0 end
    ) order by cur.revenue desc
  ),'[]'::jsonb)
  into v_location_rows
  from cur
  left join prev using(location)
  left join totals using(location)
  left join ag using(location);

  return jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
      'rowCount',v_row_count,
      'latestSourceDate',v_source_latest,
      'cutoffDate',v_cutoff,
      'selectedYear',v_selected_year,
      'selectedMonth',p_focus_month,
      'years',to_jsonb(v_years),
      'months',to_jsonb(v_months),
      'deliveryTypes',v_types,
      'locations',v_locations,
      'brands',v_brands,
      'ownerships',v_ownerships,
      'periodLabel',v_period_label,
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
    'deliveryMetrics',jsonb_build_object(
      'revenue',v_delivery_revenue,'checks',v_delivery_checks,'markup',v_delivery_markup,
      'averageCheck',case when v_delivery_checks<>0 then v_delivery_revenue/v_delivery_checks else 0 end,
      'markupRate',case when v_delivery_revenue<>0 then v_delivery_markup/v_delivery_revenue*100 else 0 end
    ),
    'aggregatorMetrics',jsonb_build_object(
      'revenue',v_aggregator_revenue,'checks',v_aggregator_checks,'markup',v_aggregator_markup,
      'averageCheck',case when v_aggregator_checks<>0 then v_aggregator_revenue/v_aggregator_checks else 0 end,
      'markupRate',case when v_aggregator_revenue<>0 then v_aggregator_markup/v_aggregator_revenue*100 else 0 end
    ),
    'typeSummary',v_type_summary,
    'multiYearData',v_multi_year,
    'compareSeries',v_compare_series,
    'locationRows',v_location_rows
  );
end;
$function$



revoke all on function public.bi_aggregators_payload(text,text,text,boolean) from public,authenticated;
grant execute on function public.bi_aggregators_payload(text,text,text,boolean) to anon;

revoke all on function public.bi_aggregators_payload_v2(text,text,text,boolean) from public,authenticated;
grant execute on function public.bi_aggregators_payload_v2(text,text,text,boolean) to anon;

revoke all on function public.bi_delivery_payload(
  text,text,text,text,text,integer,integer,text,text,boolean
) from public,authenticated;
grant execute on function public.bi_delivery_payload(
  text,text,text,text,text,integer,integer,text,text,boolean
) to anon;
