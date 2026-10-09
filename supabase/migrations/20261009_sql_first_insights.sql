-- bi_insights_payload for М'ЯСТОРІЯ BI.
-- Runtime password hash is intentionally not versioned here.

CREATE OR REPLACE FUNCTION public.bi_insights_payload(p_password text, p_focus_year integer DEFAULT NULL::integer, p_focus_month integer DEFAULT NULL::integer, p_channel text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_selected_year integer;
  v_cutoff date;
  v_previous_cutoff date;
  v_cutoff_month integer;
  v_cutoff_day integer;
  v_years integer[] := '{}';
  v_months integer[] := '{}';
  v_channels jsonb := '[]'::jsonb;
  v_order_types jsonb := '[]'::jsonb;
  v_locations jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_row_count bigint := 0;
  v_current jsonb;
  v_previous jsonb;
  v_locations_summary jsonb := '[]'::jsonb;
  v_channels_summary jsonb := '[]'::jsonb;
  v_order_types_summary jsonb := '[]'::jsonb;
  v_monthly jsonb := '[]'::jsonb;
  v_period_label text;
  v_month_names text[] := array[
    'Січень','Лютий','Березень','Квітень','Травень','Червень',
    'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'
  ];
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select coalesce(array_agg(distinct extract(year from date_id)::int order by extract(year from date_id)::int),'{}')
  into v_years
  from public.fact_sales_daily;

  if array_length(v_years,1) is null then raise exception 'no_data'; end if;
  v_selected_year := coalesce(p_focus_year,v_years[array_length(v_years,1)]);

  create temporary table if not exists _ins_base(
    date_id date not null,
    location text not null,
    channel text not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _ins_base;

  insert into _ins_base
  select
    f.date_id,
    l.canonical_name,
    c.channel_group,
    ot.name,
    f.revenue,
    f.checks,
    f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_channel c on c.id=f.channel_id
  join public.dim_order_type ot on ot.id=f.order_type_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where (p_channel is null or c.channel_group=p_channel)
    and (p_order_type is null or ot.name=p_order_type)
    and (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  select count(*) into v_row_count from _ins_base;

  select max(date_id) into v_cutoff
  from _ins_base
  where extract(year from date_id)::int=v_selected_year
    and (p_focus_month is null or extract(month from date_id)::int=p_focus_month);

  if v_cutoff is null then
    select max(date_id) into v_cutoff from _ins_base;
  end if;

  if v_cutoff is null then
    v_cutoff := make_date(v_selected_year,coalesce(p_focus_month,1),1);
  end if;

  v_previous_cutoff := (v_cutoff-interval '1 year')::date;
  v_cutoff_month := extract(month from v_cutoff)::int;
  v_cutoff_day := extract(day from v_cutoff)::int;
  v_period_label := case
    when p_focus_month is not null
      then v_month_names[p_focus_month]||' '||v_selected_year::text
    else v_selected_year::text||' YTD'
  end;

  create temporary table if not exists _ins_period(
    period_key text not null,
    location text not null,
    channel text not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _ins_period;

  insert into _ins_period
  select
    case when extract(year from date_id)::int=v_selected_year then 'current' else 'previous' end,
    location,
    channel,
    order_type,
    revenue,
    checks,
    markup
  from _ins_base
  where
    (
      extract(year from date_id)::int=v_selected_year
      and (
        (p_focus_month is not null
          and extract(month from date_id)::int=p_focus_month
          and extract(day from date_id)::int<=v_cutoff_day)
        or
        (p_focus_month is null
          and (
            extract(month from date_id)::int<v_cutoff_month
            or (
              extract(month from date_id)::int=v_cutoff_month
              and extract(day from date_id)::int<=v_cutoff_day
            )
          )
        )
      )
    )
    or
    (
      extract(year from date_id)::int=v_selected_year-1
      and (
        (p_focus_month is not null
          and extract(month from date_id)::int=p_focus_month
          and extract(day from date_id)::int<=v_cutoff_day)
        or
        (p_focus_month is null
          and (
            extract(month from date_id)::int<v_cutoff_month
            or (
              extract(month from date_id)::int=v_cutoff_month
              and extract(day from date_id)::int<=v_cutoff_day
            )
          )
        )
      )
    );

  select jsonb_build_object(
    'revenue',coalesce(sum(revenue),0),
    'checks',coalesce(sum(checks),0),
    'markup',coalesce(sum(markup),0)
  )
  into v_current
  from _ins_period
  where period_key='current';

  select jsonb_build_object(
    'revenue',coalesce(sum(revenue),0),
    'checks',coalesce(sum(checks),0),
    'markup',coalesce(sum(markup),0)
  )
  into v_previous
  from _ins_period
  where period_key='previous';

  with cur as (
    select location name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='current' group by location
  ),
  prev as (
    select location name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='previous' group by location
  ),
  names as (
    select name from cur union select name from prev
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',n.name,
    'current',jsonb_build_object(
      'revenue',coalesce(c.revenue,0),'checks',coalesce(c.checks,0),'markup',coalesce(c.markup,0)
    ),
    'previous',jsonb_build_object(
      'revenue',coalesce(p.revenue,0),'checks',coalesce(p.checks,0),'markup',coalesce(p.markup,0)
    )
  ) order by n.name),'[]'::jsonb)
  into v_locations_summary
  from names n left join cur c using(name) left join prev p using(name);

  with cur as (
    select channel name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='current' group by channel
  ),
  prev as (
    select channel name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='previous' group by channel
  ),
  names as (
    select name from cur union select name from prev
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',n.name,
    'current',jsonb_build_object(
      'revenue',coalesce(c.revenue,0),'checks',coalesce(c.checks,0),'markup',coalesce(c.markup,0)
    ),
    'previous',jsonb_build_object(
      'revenue',coalesce(p.revenue,0),'checks',coalesce(p.checks,0),'markup',coalesce(p.markup,0)
    )
  ) order by n.name),'[]'::jsonb)
  into v_channels_summary
  from names n left join cur c using(name) left join prev p using(name);

  with cur as (
    select order_type name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='current' group by order_type
  ),
  prev as (
    select order_type name,sum(revenue) revenue,sum(checks) checks,sum(markup) markup
    from _ins_period where period_key='previous' group by order_type
  ),
  names as (
    select name from cur union select name from prev
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',n.name,
    'current',jsonb_build_object(
      'revenue',coalesce(c.revenue,0),'checks',coalesce(c.checks,0),'markup',coalesce(c.markup,0)
    ),
    'previous',jsonb_build_object(
      'revenue',coalesce(p.revenue,0),'checks',coalesce(p.checks,0),'markup',coalesce(p.markup,0)
    )
  ) order by n.name),'[]'::jsonb)
  into v_order_types_summary
  from names n left join cur c using(name) left join prev p using(name);

  if p_focus_month is null then
    with month_nums as (
      select generate_series(1,v_cutoff_month) month_no
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'month',m.month_no,
      'currentRevenue',coalesce((
        select sum(revenue) from _ins_base
        where extract(year from date_id)::int=v_selected_year
          and extract(month from date_id)::int=m.month_no
          and (m.month_no<>v_cutoff_month or extract(day from date_id)::int<=v_cutoff_day)
      ),0),
      'previousRevenue',coalesce((
        select sum(revenue) from _ins_base
        where extract(year from date_id)::int=v_selected_year-1
          and extract(month from date_id)::int=m.month_no
          and (m.month_no<>v_cutoff_month or extract(day from date_id)::int<=v_cutoff_day)
      ),0)
    ) order by m.month_no),'[]'::jsonb)
    into v_monthly
    from month_nums m;
  end if;

  select coalesce(array_agg(m order by m),'{}')
  into v_months
  from (
    select distinct extract(month from f.date_id)::int m
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where extract(year from f.date_id)::int=v_selected_year
      and (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_channels
  from (
    select distinct c.channel_group name
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    join public.dim_channel c on c.id=f.channel_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_order_types
  from (
    select distinct ot.name
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    join public.dim_channel c on c.id=f.channel_id
    join public.dim_order_type ot on ot.id=f.order_type_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (p_channel is null or c.channel_group=p_channel)
      and (not p_lfl or not coalesce(lr.lfl_exclude,false))
  ) x;

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

  return jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
      'rowCount',v_row_count,
      'selectedYear',v_selected_year,
      'selectedMonth',p_focus_month,
      'cutoffDate',v_cutoff,
      'previousCutoffDate',v_previous_cutoff,
      'periodLabel',v_period_label,
      'years',to_jsonb(v_years),
      'months',to_jsonb(v_months),
      'channels',v_channels,
      'orderTypes',v_order_types,
      'locations',v_locations,
      'brands',v_brands,
      'ownerships',v_ownerships
    ),
    'current',v_current,
    'previous',v_previous,
    'entities',jsonb_build_object(
      'locations',v_locations_summary,
      'channels',v_channels_summary,
      'orderTypes',v_order_types_summary
    ),
    'monthly',v_monthly
  );
end;
$function$


revoke all on function public.bi_insights_payload(text,integer,integer,text,text,text,text,text,boolean) from public,authenticated;
grant execute on function public.bi_insights_payload(text,integer,integer,text,text,text,text,text,boolean) to anon;
