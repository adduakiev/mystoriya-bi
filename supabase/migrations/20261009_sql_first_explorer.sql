-- bi_explorer_payload for М'ЯСТОРІЯ BI.
-- Runtime password hash is intentionally not versioned here.

CREATE OR REPLACE FUNCTION public.bi_explorer_payload(p_password text, p_dimension text DEFAULT 'location'::text, p_metric text DEFAULT 'revenue'::text, p_sort text DEFAULT 'current'::text, p_focus_year integer DEFAULT NULL::integer, p_focus_month integer DEFAULT NULL::integer, p_channel text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_dimension text;
  v_metric text;
  v_sort text;
  v_selected_year integer;
  v_cutoff date;
  v_cutoff_month integer;
  v_cutoff_day integer;
  v_previous_cutoff date;
  v_current_revenue numeric := 0;
  v_current_checks numeric := 0;
  v_current_markup numeric := 0;
  v_previous_revenue numeric := 0;
  v_previous_checks numeric := 0;
  v_previous_markup numeric := 0;
  v_total_current numeric := 0;
  v_total_previous numeric := 0;
  v_total_growth numeric;
  v_years integer[] := '{}';
  v_months integer[] := '{}';
  v_channels jsonb := '[]'::jsonb;
  v_order_types jsonb := '[]'::jsonb;
  v_locations jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  v_dimension := case
    when p_dimension in ('location','channel','orderType','brand','ownership') then p_dimension
    else 'location'
  end;
  v_metric := case
    when p_metric in ('revenue','checks','averageCheck','markup','markupRate') then p_metric
    else 'revenue'
  end;
  v_sort := case
    when p_sort in ('current','growth','share','name') then p_sort
    else 'current'
  end;

  select
    coalesce(array_agg(distinct extract(year from f.date_id)::int order by extract(year from f.date_id)::int),'{}')
  into v_years
  from public.fact_sales_daily f;

  if array_length(v_years,1) is null then raise exception 'no_data'; end if;
  v_selected_year := coalesce(p_focus_year,v_years[array_length(v_years,1)]);

  create temporary table if not exists _explore_base(
    date_id date not null,
    location text not null,
    channel text not null,
    order_type text not null,
    brand text not null,
    ownership text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _explore_base;

  insert into _explore_base
  select
    f.date_id,
    l.canonical_name,
    c.channel_group,
    ot.name,
    b.name,
    o.name,
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

  select max(date_id) into v_cutoff
  from _explore_base
  where extract(year from date_id)::int=v_selected_year
    and (p_focus_month is null or extract(month from date_id)::int=p_focus_month);

  if v_cutoff is null then
    select max(f.date_id) into v_cutoff
    from public.fact_sales_daily f
    join public.dim_location l on l.id=f.location_id
    left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
    where (not p_lfl or not coalesce(lr.lfl_exclude,false))
      and extract(year from f.date_id)::int=v_selected_year
      and (p_focus_month is null or extract(month from f.date_id)::int=p_focus_month);
  end if;

  if v_cutoff is null then
    select max(date_id) into v_cutoff from public.fact_sales_daily;
  end if;

  v_cutoff_month := extract(month from v_cutoff)::int;
  v_cutoff_day := extract(day from v_cutoff)::int;
  v_previous_cutoff := (v_cutoff-interval '1 year')::date;

  create temporary table if not exists _explore_period(
    period_key text not null,
    dimension_name text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _explore_period;

  insert into _explore_period
  select
    case when extract(year from date_id)::int=v_selected_year then 'current' else 'previous' end,
    case v_dimension
      when 'channel' then channel
      when 'orderType' then order_type
      when 'brand' then brand
      when 'ownership' then ownership
      else location
    end as dimension_name,
    sum(revenue),
    sum(checks),
    sum(markup)
  from _explore_base
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
    )
  group by 1,2;

  select
    coalesce(sum(revenue),0),
    coalesce(sum(checks),0),
    coalesce(sum(markup),0)
  into v_current_revenue,v_current_checks,v_current_markup
  from _explore_period
  where period_key='current';

  select
    coalesce(sum(revenue),0),
    coalesce(sum(checks),0),
    coalesce(sum(markup),0)
  into v_previous_revenue,v_previous_checks,v_previous_markup
  from _explore_period
  where period_key='previous';

  v_total_current := case v_metric
    when 'checks' then v_current_checks
    when 'averageCheck' then case when v_current_checks<>0 then v_current_revenue/v_current_checks else 0 end
    when 'markup' then v_current_markup
    when 'markupRate' then case when v_current_revenue<>0 then v_current_markup/v_current_revenue*100 else 0 end
    else v_current_revenue
  end;

  v_total_previous := case v_metric
    when 'checks' then v_previous_checks
    when 'averageCheck' then case when v_previous_checks<>0 then v_previous_revenue/v_previous_checks else 0 end
    when 'markup' then v_previous_markup
    when 'markupRate' then case when v_previous_revenue<>0 then v_previous_markup/v_previous_revenue*100 else 0 end
    else v_previous_revenue
  end;

  v_total_growth := case
    when v_metric='markupRate' then v_total_current-v_total_previous
    when v_total_previous=0 then null
    else (v_total_current/v_total_previous-1)*100
  end;

  with names as (
    select distinct dimension_name from _explore_period
  ),
  joined as (
    select
      n.dimension_name as name,
      coalesce(c.revenue,0) cur_revenue,
      coalesce(c.checks,0) cur_checks,
      coalesce(c.markup,0) cur_markup,
      coalesce(p.revenue,0) prev_revenue,
      coalesce(p.checks,0) prev_checks,
      coalesce(p.markup,0) prev_markup
    from names n
    left join _explore_period c
      on c.dimension_name=n.dimension_name and c.period_key='current'
    left join _explore_period p
      on p.dimension_name=n.dimension_name and p.period_key='previous'
  ),
  calculated as (
    select
      name,
      cur_revenue,
      cur_checks,
      cur_markup,
      prev_revenue,
      prev_checks,
      prev_markup,
      case v_metric
        when 'checks' then cur_checks
        when 'averageCheck' then case when cur_checks<>0 then cur_revenue/cur_checks else 0 end
        when 'markup' then cur_markup
        when 'markupRate' then case when cur_revenue<>0 then cur_markup/cur_revenue*100 else 0 end
        else cur_revenue
      end current_value,
      case v_metric
        when 'checks' then prev_checks
        when 'averageCheck' then case when prev_checks<>0 then prev_revenue/prev_checks else 0 end
        when 'markup' then prev_markup
        when 'markupRate' then case when prev_revenue<>0 then prev_markup/prev_revenue*100 else 0 end
        else prev_revenue
      end previous_value
    from joined
  ),
  enriched as (
    select
      *,
      case
        when v_metric='markupRate' then current_value-previous_value
        when previous_value=0 then null
        else (current_value/previous_value-1)*100
      end growth_value,
      case when v_current_revenue<>0 then cur_revenue/v_current_revenue*100 else 0 end share
    from calculated
  ),
  sorted as (
    select *
    from enriched
    order by
      case when v_sort='current' then current_value end desc nulls last,
      case when v_sort='growth' then growth_value end desc nulls last,
      case when v_sort='share' then share end desc nulls last,
      case when v_sort='name' then name end asc,
      name asc
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name',name,
      'current',current_value,
      'previous',previous_value,
      'growthValue',growth_value,
      'growthLabel',case
        when v_metric='markupRate'
          then (case when growth_value>=0 then '+' else '' end)||round(growth_value,1)::text||' п.п.'
        when growth_value is null then '—'
        else (case when growth_value>=0 then '+' else '' end)||round(growth_value,1)::text||'%'
      end,
      'revenue',cur_revenue,
      'share',share,
      'checks',cur_checks,
      'averageCheck',case when cur_checks<>0 then cur_revenue/cur_checks else 0 end,
      'markupRate',case when cur_revenue<>0 then cur_markup/cur_revenue*100 else 0 end
    )
  ),'[]'::jsonb)
  into v_rows
  from sorted;

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
      'cutoffDate',v_cutoff,
      'selectedYear',v_selected_year,
      'selectedMonth',p_focus_month,
      'years',to_jsonb(v_years),
      'months',to_jsonb(v_months),
      'channels',v_channels,
      'orderTypes',v_order_types,
      'locations',v_locations,
      'brands',v_brands,
      'ownerships',v_ownerships
    ),
    'totals',jsonb_build_object(
      'current',v_total_current,
      'previous',v_total_previous,
      'growthValue',v_total_growth,
      'growthLabel',case
        when v_metric='markupRate'
          then (case when v_total_growth>=0 then '+' else '' end)||round(v_total_growth,1)::text||' п.п.'
        when v_total_growth is null then '—'
        else (case when v_total_growth>=0 then '+' else '' end)||round(v_total_growth,1)::text||'%'
      end
    ),
    'rows',v_rows
  );
end;
$function$


revoke all on function public.bi_explorer_payload(text,text,text,text,integer,integer,text,text,text,text,text,boolean) from public,authenticated;
grant execute on function public.bi_explorer_payload(text,text,text,text,integer,integer,text,text,text,text,text,boolean) to anon;
