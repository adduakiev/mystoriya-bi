-- bi_dynamics_payload for М'ЯСТОРІЯ BI.
-- Runtime password hash is intentionally not versioned here.

CREATE OR REPLACE FUNCTION public.bi_dynamics_payload(p_password text, p_metric text DEFAULT 'revenue'::text, p_grain text DEFAULT 'month'::text, p_channel text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;
  v_metric text;
  v_grain text;
  v_latest_date date;
  v_latest_year integer;
  v_previous_year integer;
  v_cutoff_month integer;
  v_cutoff_day integer;
  v_cutoff_week integer;
  v_years integer[] := '{}';
  v_series jsonb := '[]'::jsonb;
  v_channels jsonb := '[]'::jsonb;
  v_order_types jsonb := '[]'::jsonb;
  v_locations jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_row_count bigint := 0;
  v_latest_total numeric := 0;
  v_previous_total numeric := 0;
  v_month_names text[] := array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
begin
  select value_hash into v_expected_hash
  from public.bi_runtime_config
  where config_key='access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex');
  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  v_metric := case
    when p_metric in ('revenue','checks','averageCheck','markupRate') then p_metric
    else 'revenue'
  end;
  v_grain := case when p_grain='week' then 'week' else 'month' end;

  create temporary table if not exists _dyn_base(
    date_id date not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _dyn_base;

  insert into _dyn_base
  select f.date_id,f.revenue,f.checks,f.markup
  from public.fact_sales_daily f
  join public.dim_location l on l.id=f.location_id
  join public.dim_brand b on b.id=f.brand_id
  join public.dim_ownership o on o.id=f.ownership_id
  join public.dim_channel c on c.id=f.channel_id
  join public.dim_order_type ot on ot.id=f.order_type_id
  left join public.location_lifecycle_registry lr on lr.canonical_name=l.canonical_name
  where (p_channel is null or c.channel_group=p_channel)
    and (p_order_type is null or ot.name=p_order_type)
    and (p_location is null or l.canonical_name=p_location)
    and (p_brand is null or b.name=p_brand)
    and (p_ownership is null or o.name=p_ownership)
    and (not p_lfl or not coalesce(lr.lfl_exclude,false));

  select
    count(*),
    max(date_id),
    coalesce(array_agg(distinct extract(year from date_id)::int order by extract(year from date_id)::int),'{}')
  into v_row_count,v_latest_date,v_years
  from _dyn_base;

  if v_latest_date is null then raise exception 'no_data'; end if;

  v_latest_year := v_years[array_length(v_years,1)];
  v_previous_year := case
    when array_length(v_years,1) > 1 then v_years[array_length(v_years,1)-1]
    else null
  end;
  v_cutoff_month := extract(month from v_latest_date)::int;
  v_cutoff_day := extract(day from v_latest_date)::int;
  v_cutoff_week := extract(week from v_latest_date)::int;

  if v_grain='week' then
    with pts as (
      select generate_series(1,v_cutoff_week) n
    ),
    yrs as (
      select unnest(v_years) y
    ),
    vals as (
      select
        pts.n,
        yrs.y,
        coalesce(sum(d.revenue),0) revenue,
        coalesce(sum(d.checks),0) checks,
        coalesce(sum(d.markup),0) markup
      from pts
      cross join yrs
      left join _dyn_base d
        on extract(year from d.date_id)::int=yrs.y
       and extract(week from d.date_id)::int=pts.n
      group by pts.n,yrs.y
    ),
    objs as (
      select
        n,
        jsonb_build_object('label','W'||lpad(n::text,2,'0')) ||
        jsonb_object_agg(
          y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
            else revenue
          end
          order by y
        ) obj
      from vals
      group by n
    )
    select coalesce(jsonb_agg(obj order by n),'[]'::jsonb)
    into v_series
    from objs;
  else
    with pts as (
      select generate_series(1,12) n
    ),
    yrs as (
      select unnest(v_years) y
    ),
    vals as (
      select
        pts.n,
        yrs.y,
        coalesce(sum(d.revenue),0) revenue,
        coalesce(sum(d.checks),0) checks,
        coalesce(sum(d.markup),0) markup
      from pts
      cross join yrs
      left join _dyn_base d
        on extract(year from d.date_id)::int=yrs.y
       and extract(month from d.date_id)::int=pts.n
       and (pts.n<>v_cutoff_month or extract(day from d.date_id)::int<=v_cutoff_day)
      group by pts.n,yrs.y
    ),
    objs as (
      select
        n,
        jsonb_build_object('label',v_month_names[n]) ||
        jsonb_object_agg(
          y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
            else revenue
          end
          order by y
        ) obj
      from vals
      group by n
    )
    select coalesce(jsonb_agg(obj order by n),'[]'::jsonb)
    into v_series
    from objs;
  end if;

  with totals as (
    select
      extract(year from date_id)::int y,
      sum(revenue) revenue,
      sum(checks) checks,
      sum(markup) markup
    from _dyn_base
    where (
      extract(month from date_id)::int < v_cutoff_month
      or (
        extract(month from date_id)::int = v_cutoff_month
        and extract(day from date_id)::int <= v_cutoff_day
      )
    )
    group by extract(year from date_id)::int
  )
  select
    coalesce(max(case when y=v_latest_year then
      case v_metric
        when 'checks' then checks
        when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
        when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
        else revenue
      end
    end),0),
    coalesce(max(case when y=v_previous_year then
      case v_metric
        when 'checks' then checks
        when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
        when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
        else revenue
      end
    end),0)
  into v_latest_total,v_previous_total
  from totals;

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
      'latestSourceDate',v_latest_date,
      'years',to_jsonb(v_years),
      'latestYear',v_latest_year,
      'previousYear',v_previous_year,
      'channels',v_channels,
      'orderTypes',v_order_types,
      'locations',v_locations,
      'brands',v_brands,
      'ownerships',v_ownerships
    ),
    'series',v_series,
    'summary',jsonb_build_object(
      'latestYearTotal',v_latest_total,
      'previousYearTotal',v_previous_total,
      'growth',case
        when v_previous_year is null or v_previous_total=0 then null
        when v_metric='markupRate' then v_latest_total-v_previous_total
        else (v_latest_total/v_previous_total-1)*100
      end
    )
  );
end;
$function$


revoke all on function public.bi_dynamics_payload(text,text,text,text,text,text,text,text,boolean) from public,authenticated;
grant execute on function public.bi_dynamics_payload(text,text,text,text,text,text,text,text,boolean) to anon;
