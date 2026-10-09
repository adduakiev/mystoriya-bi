-- SQL-first Locations payload for М'ЯСТОРІЯ BI.
-- Runtime password hash is intentionally not versioned here.

CREATE OR REPLACE FUNCTION public.bi_locations_payload(p_password text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_focus_year integer DEFAULT NULL::integer, p_focus_month integer DEFAULT NULL::integer, p_lfl boolean DEFAULT false)
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
  v_period_label text;
  v_years integer[] := '{}';
  v_months integer[] := '{}';
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_location_rows jsonb := '[]'::jsonb;
  v_lfl_count integer := 0;
  v_lfl_current numeric := 0;
  v_lfl_previous numeric := 0;
  v_month_names text[] := array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  select max(date_id),
         coalesce(array_agg(distinct extract(year from date_id)::int order by extract(year from date_id)::int),'{}')
  into v_source_latest,v_years
  from public.fact_sales_daily;

  if v_source_latest is null then raise exception 'no_data'; end if;
  v_selected_year := coalesce(p_focus_year,extract(year from v_source_latest)::int);

  create temporary table if not exists _loc_base(
    date_id date not null,
    location text not null,
    channel text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _loc_base;

  insert into _loc_base
  select
    f.date_id,
    l.canonical_name,
    c.channel_group,
    f.revenue,
    f.checks,
    f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  select max(date_id) into v_cutoff
  from _loc_base
  where extract(year from date_id)::int=v_selected_year
    and (p_focus_month is null or extract(month from date_id)::int=p_focus_month);

  if v_cutoff is null then
    select max(date_id) into v_cutoff from _loc_base;
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

  v_previous_start := (v_current_start-interval '1 year')::date;
  v_previous_end := (v_current_end-interval '1 year')::date;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_current_revenue,v_current_checks,v_current_markup
  from _loc_base
  where date_id between v_current_start and v_current_end;

  select coalesce(sum(revenue),0),coalesce(sum(checks),0),coalesce(sum(markup),0)
  into v_previous_revenue,v_previous_checks,v_previous_markup
  from _loc_base
  where date_id between v_previous_start and v_previous_end;

  v_current_aov := case when v_current_checks<>0 then v_current_revenue/v_current_checks else 0 end;
  v_current_markup_rate := case when v_current_revenue<>0 then v_current_markup/v_current_revenue*100 else 0 end;
  v_previous_aov := case when v_previous_checks<>0 then v_previous_revenue/v_previous_checks else 0 end;
  v_previous_markup_rate := case when v_previous_revenue<>0 then v_previous_markup/v_previous_revenue*100 else 0 end;

  select coalesce(array_agg(m order by m),'{}')
  into v_months
  from (
    select distinct extract(month from date_id)::int m
    from _loc_base
    where extract(year from date_id)::int=v_selected_year
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_brands
  from (select distinct b.name from public.dim_brand b join public.fact_sales_daily f on f.brand_id=b.id) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_ownerships
  from (select distinct o.name from public.dim_ownership o join public.fact_sales_daily f on f.ownership_id=o.id) x;

  with cur as (
    select
      location,
      sum(revenue) revenue,
      sum(checks) checks,
      sum(markup) markup,
      sum(revenue) filter(where channel='Заклад') venue_revenue,
      sum(checks) filter(where channel='Заклад') venue_checks,
      sum(markup) filter(where channel='Заклад') venue_markup,
      sum(revenue) filter(where channel='Доставка') delivery_revenue,
      sum(revenue) filter(where channel='Агрегатор') aggregator_revenue
    from _loc_base
    where date_id between v_current_start and v_current_end
    group by location
  ),
  prev as (
    select location,sum(revenue) revenue,sum(checks) checks
    from _loc_base
    where date_id between v_previous_start and v_previous_end
    group by location
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'location',cur.location,
        'revenue',cur.revenue,
        'revenueGrowth',case when coalesce(prev.revenue,0)=0 then null else (cur.revenue/prev.revenue-1)*100 end,
        'checks',cur.checks,
        'checksGrowth',case when coalesce(prev.checks,0)=0 then null else (cur.checks/prev.checks-1)*100 end,
        'averageCheck',case when cur.checks<>0 then cur.revenue/cur.checks else 0 end,
        'markup',cur.markup,
        'markupRate',case when cur.revenue<>0 then cur.markup/cur.revenue*100 else 0 end,
        'venueRevenue',coalesce(cur.venue_revenue,0),
        'venueChecks',coalesce(cur.venue_checks,0),
        'venueAverageCheck',case when coalesce(cur.venue_checks,0)<>0 then cur.venue_revenue/cur.venue_checks else 0 end,
        'venueMarkupRate',case when coalesce(cur.venue_revenue,0)<>0 then cur.venue_markup/cur.venue_revenue*100 else 0 end,
        'deliveryRevenue',coalesce(cur.delivery_revenue,0),
        'deliveryShare',case when cur.revenue<>0 then coalesce(cur.delivery_revenue,0)/cur.revenue*100 else 0 end,
        'aggregatorRevenue',coalesce(cur.aggregator_revenue,0),
        'aggregatorShare',case when cur.revenue<>0 then coalesce(cur.aggregator_revenue,0)/cur.revenue*100 else 0 end,
        'previousRevenue',coalesce(prev.revenue,0),
        'lflEligible',(cur.revenue>0 and coalesce(prev.revenue,0)>0)
      ) order by cur.revenue desc
    ),'[]'::jsonb),
    count(*) filter(where cur.revenue>0 and coalesce(prev.revenue,0)>0),
    coalesce(sum(cur.revenue) filter(where cur.revenue>0 and coalesce(prev.revenue,0)>0),0),
    coalesce(sum(prev.revenue) filter(where cur.revenue>0 and coalesce(prev.revenue,0)>0),0)
  into v_location_rows,v_lfl_count,v_lfl_current,v_lfl_previous
  from cur left join prev using(location)
  where cur.revenue>0;

  return jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
      'latestSourceDate',v_source_latest,
      'cutoffDate',v_cutoff,
      'selectedYear',v_selected_year,
      'selectedMonth',p_focus_month,
      'years',to_jsonb(v_years),
      'months',to_jsonb(v_months),
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
    'lfl',jsonb_build_object(
      'count',v_lfl_count,
      'currentRevenue',v_lfl_current,
      'previousRevenue',v_lfl_previous,
      'growth',case when v_lfl_previous=0 then null else (v_lfl_current/v_lfl_previous-1)*100 end
    ),
    'locationRows',v_location_rows
  );
end;
$function$


revoke all on function public.bi_locations_payload(text,text,text,integer,integer,boolean) from public,authenticated;
grant execute on function public.bi_locations_payload(text,text,text,integer,integer,boolean) to anon;
