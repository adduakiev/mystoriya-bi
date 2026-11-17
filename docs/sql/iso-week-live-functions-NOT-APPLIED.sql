-- NOT APPLIED. REVIEW DRAFT ONLY. Never execute as a production migration.
-- Client promotion prerequisites: weeklyYears separate from calendar filter years;
-- preserve NULL chart values (current adapters may convert them to zero);
-- display weeklyCutoff and partial-week label; verify no-data, W53 and year totals
-- with native PostgreSQL tests and installed-function parity.
-- All compared years stop at the same elapsed weekday in the cutoff ISO week.
-- Weeks absent from a year remain NULL, including nonexistent W53.
-- Existing monthly paths and calendar-year navigation are unchanged.

-- bi_delivery_payload — definition captured via SELECT 2026-11-17; unmodified monthly branches.
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
  v_week_cutoff date;
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

  select max(date),
         coalesce(array_agg(distinct extract(year from date)::int order by extract(year from date)::int),'{}')
  into v_source_latest,v_years
  from public.bi_sales_flat_mv;

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
  select date,location,brand,ownership,order_type,revenue,checks,markup
  from public.bi_sales_flat_mv
  where channel='Доставка'
    and (p_order_type is null or order_type=p_order_type)
    and (p_location is null or location=p_location)
    and (p_brand is null or brand=p_brand)
    and (p_ownership is null or ownership=p_ownership)
    and (not p_lfl or not lfl_exclude);

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
  select date,location,order_type,revenue,checks,markup
  from public.bi_sales_flat_mv
  where channel='Доставка'
    and (p_location is null or location=p_location)
    and (p_brand is null or brand=p_brand)
    and (p_ownership is null or ownership=p_ownership)
    and (not p_lfl or not lfl_exclude);

  create temporary table if not exists _del_agg(
    date_id date not null,
    location text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;
  truncate table _del_agg;

  insert into _del_agg
  select date,location,revenue,checks,markup
  from public.bi_sales_flat_mv
  where channel='Агрегатор'
    and (p_location is null or location=p_location)
    and (p_brand is null or brand=p_brand)
    and (p_ownership is null or ownership=p_ownership)
    and (not p_lfl or not lfl_exclude);

  create temporary table if not exists _del_all_channels(
    date_id date not null,
    location text not null,
    channel text not null,
    revenue numeric not null
  ) on commit drop;
  truncate table _del_all_channels;

  insert into _del_all_channels
  select date,location,channel,revenue
  from public.bi_sales_flat_mv
  where (p_location is null or location=p_location)
    and (p_brand is null or brand=p_brand)
    and (p_ownership is null or ownership=p_ownership)
    and (not p_lfl or not lfl_exclude);

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
    select distinct location name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_brands
  from (
    select distinct brand name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
  ) x;

  select coalesce(jsonb_agg(name order by name),'[]'::jsonb)
  into v_ownerships
  from (
    select distinct ownership name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
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
    select max(date_id) into v_week_cutoff from _del_main;
    v_multi_max := extract(week from v_week_cutoff)::int;
    with pts as (select generate_series(1,v_multi_max) n),
    yrs as (select distinct extract(isoyear from date_id)::int y from _del_main),
    vals as (
      select pts.n,yrs.y,
        sum(d.revenue) revenue,
        sum(d.checks) checks,
        sum(d.markup) markup
      from pts cross join yrs
      left join _del_main d
        on extract(isoyear from d.date_id)::int=yrs.y
       and extract(week from d.date_id)::int=pts.n
       and (pts.n < v_multi_max or extract(isodow from d.date_id) <= extract(isodow from v_week_cutoff))
      group by pts.n,yrs.y
    ),
    objs as (
      select n,
        jsonb_build_object('label','W'||lpad(n::text,2,'0')) ||
        jsonb_object_agg(y::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks<>0 then revenue/checks else null end
            when 'markupRate' then case when revenue<>0 then markup/revenue*100 else null end
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
      'weeklyContract','iso-year-week-elapsed-days-v1',
      'weeklyYears',(select jsonb_agg(y order by y) from (select distinct extract(isoyear from date_id)::int y from _del_main) q),
      'weeklyCutoff',v_week_cutoff,
      'weeklyCalendarPartial',extract(isodow from v_week_cutoff)<7,
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
;

-- bi_dynamics_payload — definition captured via SELECT 2026-11-17; unmodified monthly branches.
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
  v_result jsonb;
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

  with base as materialized (
    select date,revenue,checks,markup
    from public.bi_sales_flat_mv
    where (p_channel is null or channel=p_channel)
      and (p_order_type is null or order_type=p_order_type)
      and (p_location is null or location=p_location)
      and (p_brand is null or brand=p_brand)
      and (p_ownership is null or ownership=p_ownership)
      and (not p_lfl or not lfl_exclude)
  ),
  stats as (
    select
      count(*) row_count,
      max(date) latest_date,
      coalesce(array_agg(distinct (case when v_grain='week' then extract(isoyear from date)::int else extract(year from date)::int end) order by (case when v_grain='week' then extract(isoyear from date)::int else extract(year from date)::int end)),'{}') years
    from base
  ),
  meta as (
    select
      row_count,
      latest_date,
      years,
      years[array_length(years,1)] latest_year,
      case when v_grain='week' then extract(isoyear from latest_date)::int-1 when array_length(years,1)>1 then years[array_length(years,1)-1] else null end previous_year,
      extract(month from latest_date)::int cutoff_month,
      extract(day from latest_date)::int cutoff_day,
      extract(week from latest_date)::int cutoff_week
    from stats
  ),
  series as (
    select case when v_grain='week' then (
      with pts as (
        select generate_series(1,(select cutoff_week from meta)) n
      ),
      yrs as (
        select unnest((select years from meta)) y
      ),
      vals as (
        select
          pts.n,yrs.y,
          sum(b.revenue) revenue,
          sum(b.checks) checks,
          sum(b.markup) markup
        from pts
        cross join yrs
        left join base b
          on extract(isoyear from b.date)::int=yrs.y
         and extract(week from b.date)::int=pts.n
         and (pts.n < (select cutoff_week from meta) or extract(isodow from b.date) <= extract(isodow from (select latest_date from meta)))
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
              when 'averageCheck' then case when checks<>0 then revenue/checks else null end
              when 'markupRate' then case when revenue<>0 then markup/revenue*100 else null end
              else revenue
            end order by y
          ) obj
        from vals group by n
      )
      select coalesce(jsonb_agg(obj order by n),'[]'::jsonb) from objs
    ) else (
      with pts as (
        select generate_series(1,12) n
      ),
      yrs as (
        select unnest((select years from meta)) y
      ),
      vals as (
        select
          pts.n,yrs.y,
          coalesce(sum(b.revenue),0) revenue,
          coalesce(sum(b.checks),0) checks,
          coalesce(sum(b.markup),0) markup
        from pts
        cross join yrs
        cross join meta m
        left join base b
          on extract(year from b.date)::int=yrs.y
         and extract(month from b.date)::int=pts.n
         and (pts.n<>m.cutoff_month or extract(day from b.date)::int<=m.cutoff_day)
        group by pts.n,yrs.y
      ),
      objs as (
        select
          n,
          jsonb_build_object(
            'label',
            (array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'])[n]
          ) ||
          jsonb_object_agg(
            y::text,
            case v_metric
              when 'checks' then checks
              when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
              when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
              else revenue
            end order by y
          ) obj
        from vals group by n
      )
      select coalesce(jsonb_agg(obj order by n),'[]'::jsonb) from objs
    ) end j
  ),
  year_totals as (
    select
      (case when v_grain='week' then extract(isoyear from b.date)::int else extract(year from b.date)::int end) y,
      sum(b.revenue) revenue,
      sum(b.checks) checks,
      sum(b.markup) markup
    from base b
    cross join meta m
    where (v_grain='week' and (extract(week from b.date)::int<m.cutoff_week or (extract(week from b.date)::int=m.cutoff_week and extract(isodow from b.date)<=extract(isodow from m.latest_date))))
       or (v_grain<>'week' and (extract(month from b.date)::int<m.cutoff_month
       or (
         extract(month from b.date)::int=m.cutoff_month
         and extract(day from b.date)::int<=m.cutoff_day
       )
       ))
    group by (case when v_grain='week' then extract(isoyear from b.date)::int else extract(year from b.date)::int end)
  ),
  totals as (
    select
      coalesce(max(case when y=m.latest_year then
        case v_metric
          when 'checks' then checks
          when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
          when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
          else revenue
        end
      end),case when v_grain='week' then null else 0 end) latest_total,
      coalesce(max(case when y=m.previous_year then
        case v_metric
          when 'checks' then checks
          when 'averageCheck' then case when checks<>0 then revenue/checks else 0 end
          when 'markupRate' then case when revenue<>0 then markup/revenue*100 else 0 end
          else revenue
        end
      end),case when v_grain='week' then null else 0 end) previous_total
    from year_totals
    cross join meta m
    group by m.latest_year,m.previous_year
  ),
  dims as (
    select
      coalesce((select jsonb_agg(name order by name) from (
        select distinct channel name
        from public.bi_sales_flat_mv
        where (not p_lfl or not lfl_exclude)
      ) q),'[]'::jsonb) channels,
      coalesce((select jsonb_agg(name order by name) from (
        select distinct order_type name
        from public.bi_sales_flat_mv
        where (p_channel is null or channel=p_channel)
          and (not p_lfl or not lfl_exclude)
      ) q),'[]'::jsonb) order_types,
      coalesce((select jsonb_agg(name order by name) from (
        select distinct location name
        from public.bi_sales_flat_mv
        where (not p_lfl or not lfl_exclude)
      ) q),'[]'::jsonb) locations,
      coalesce((select jsonb_agg(name order by name) from (
        select distinct brand name
        from public.bi_sales_flat_mv
        where (not p_lfl or not lfl_exclude)
      ) q),'[]'::jsonb) brands,
      coalesce((select jsonb_agg(name order by name) from (
        select distinct ownership name
        from public.bi_sales_flat_mv
        where (not p_lfl or not lfl_exclude)
      ) q),'[]'::jsonb) ownerships
  )
  select jsonb_build_object(
    'source','supabase-sql',
    'meta',jsonb_build_object(
      'rowCount',m.row_count,
      'latestSourceDate',m.latest_date,
      'years',to_jsonb(m.years),
      'weeklyContract','iso-year-week-elapsed-days-v1',
      'weeklyCutoff',case when v_grain='week' then m.latest_date else null end,
      'weeklyCalendarPartial',case when v_grain='week' then extract(isodow from m.latest_date)<7 else null end,
      'latestYear',m.latest_year,
      'previousYear',m.previous_year,
      'channels',d.channels,
      'orderTypes',d.order_types,
      'locations',d.locations,
      'brands',d.brands,
      'ownerships',d.ownerships
    ),
    'series',s.j,
    'summary',jsonb_build_object(
      'latestYearTotal',t.latest_total,
      'previousYearTotal',t.previous_total,
      'growth',case
        when m.previous_year is null or t.previous_total=0 then null
        when v_metric='markupRate' then t.latest_total-t.previous_total
        else (t.latest_total/t.previous_total-1)*100
      end
    )
  )
  into v_result
  from meta m
  cross join series s
  cross join totals t
  cross join dims d;

  return v_result;
end;
$function$
;

-- bi_overview_payload — definition captured via SELECT 2026-11-17; unmodified monthly branches.
CREATE OR REPLACE FUNCTION public.bi_overview_payload(p_password text, p_channel text DEFAULT NULL::text, p_order_type text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_ownership text DEFAULT NULL::text, p_focus_year integer DEFAULT NULL::integer, p_focus_month integer DEFAULT NULL::integer, p_period text DEFAULT 'ytd'::text, p_comparison text DEFAULT 'ly'::text, p_metric text DEFAULT 'revenue'::text, p_grain text DEFAULT 'month'::text, p_lfl boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_expected_hash text;
  v_actual_hash text;

  v_source_latest date;
  v_rows_latest date;
  v_cutoff date;
  v_selected_year integer;
  v_period text;
  v_comparison text;
  v_metric text;
  v_grain text;

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

  v_source_rows bigint := 0;
  v_filtered_rows bigint := 0;
  v_years integer[] := '{}';
  v_available_months integer[] := '{}';

  v_channels jsonb := '[]'::jsonb;
  v_locations jsonb := '[]'::jsonb;
  v_monthly_table jsonb := '[]'::jsonb;
  v_multi_year jsonb := '[]'::jsonb;
  v_channel_mix jsonb := '[]'::jsonb;
  v_channel_drivers jsonb := '[]'::jsonb;
  v_location_drivers jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
  v_ownerships jsonb := '[]'::jsonb;
  v_location_options jsonb := '[]'::jsonb;
  v_order_types jsonb := '[]'::jsonb;

  v_total_delta numeric := 0;
  v_checks_effect numeric := 0;
  v_aov_effect numeric := 0;

  v_month_names text[] := array['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  v_period_label text;
  v_comparison_label text;

  v_cutoff_month integer;
  v_cutoff_day integer;
  v_rows_cutoff_month integer;
  v_rows_cutoff_day integer;
  v_multi_max integer;
begin
  select value_hash
    into v_expected_hash
  from public.bi_runtime_config
  where config_key = 'access_password';

  v_actual_hash := encode(extensions.digest(coalesce(p_password, ''), 'sha256'), 'hex');

  if v_expected_hash is null or v_actual_hash <> v_expected_hash then
    raise exception 'unauthorized';
  end if;

  v_period := case
    when p_focus_month is not null then 'month'
    when p_period in ('ytd','month','week') then p_period
    else 'ytd'
  end;

  v_comparison := case when p_comparison = 'previous' then 'previous' else 'ly' end;
  v_metric := case when p_metric in ('revenue','checks','averageCheck','markupRate') then p_metric else 'revenue' end;
  v_grain := case when p_grain = 'week' then 'week' else 'month' end;

  select
    max(date),
    count(*),
    coalesce(array_agg(distinct extract(year from date)::int order by extract(year from date)::int), '{}')
  into
    v_source_latest,
    v_source_rows,
    v_years
  from public.bi_sales_flat_mv;

  if v_source_latest is null then
    raise exception 'no_data';
  end if;

  v_selected_year := coalesce(p_focus_year, extract(year from v_source_latest)::int);

  select coalesce(array_agg(m order by m), '{}')
  into v_available_months
  from (
    select distinct extract(month from date)::int as m
    from public.bi_sales_flat_mv
    where extract(year from date)::int = v_selected_year
  ) months;

  create temporary table if not exists _ov_base (
    date_id date not null,
    location text not null,
    brand text not null,
    ownership text not null,
    channel text not null,
    order_type text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;

  truncate table _ov_base;

  insert into _ov_base
  select
    date,
    location,
    brand,
    ownership,
    channel,
    order_type,
    revenue,
    checks,
    markup
  from public.bi_sales_flat_mv
  where (not p_lfl or not lfl_exclude)
    and (p_channel is null or channel = p_channel)
    and (p_order_type is null or order_type = p_order_type)
    and (p_location is null or location = p_location)
    and (p_brand is null or brand = p_brand)
    and (p_ownership is null or ownership = p_ownership);

  select count(*), max(date_id)
  into v_filtered_rows, v_rows_latest
  from _ov_base;

  if v_filtered_rows = 0 or v_rows_latest is null then
    raise exception 'no_data';
  end if;

  create temporary table if not exists _ov_daily (
    date_id date primary key,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null
  ) on commit drop;

  truncate table _ov_daily;

  insert into _ov_daily
  select date_id, sum(revenue), sum(checks), sum(markup)
  from _ov_base
  group by date_id;

  create temporary table if not exists _ov_channel_daily (
    date_id date not null,
    channel text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null,
    primary key (date_id, channel)
  ) on commit drop;

  truncate table _ov_channel_daily;

  insert into _ov_channel_daily
  select date_id, channel, sum(revenue), sum(checks), sum(markup)
  from _ov_base
  group by date_id, channel;

  create temporary table if not exists _ov_location_daily (
    date_id date not null,
    location text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null,
    primary key (date_id, location)
  ) on commit drop;

  truncate table _ov_location_daily;

  insert into _ov_location_daily
  select date_id, location, sum(revenue), sum(checks), sum(markup)
  from _ov_base
  group by date_id, location;

  create temporary table if not exists _ov_mix_channel_daily (
    date_id date not null,
    channel text not null,
    revenue numeric not null,
    checks numeric not null,
    markup numeric not null,
    primary key (date_id, channel)
  ) on commit drop;

  truncate table _ov_mix_channel_daily;

  insert into _ov_mix_channel_daily
  select
    date,
    channel,
    sum(revenue),
    sum(checks),
    sum(markup)
  from public.bi_sales_flat_mv
  where (not p_lfl or not lfl_exclude)
    and (p_location is null or location = p_location)
    and (p_brand is null or brand = p_brand)
    and (p_ownership is null or ownership = p_ownership)
  group by date, channel;

  select max(date_id)
  into v_cutoff
  from _ov_daily
  where extract(year from date_id)::int = v_selected_year
    and (p_focus_month is null or extract(month from date_id)::int = p_focus_month);

  if v_cutoff is null then
    v_cutoff := v_rows_latest;
  end if;

  if v_period = 'week' then
    v_current_start := date_trunc('week', v_cutoff)::date;
    v_current_end := v_cutoff;
    v_period_label := 'Поточний тиждень';
  elsif v_period = 'month' then
    v_current_start := date_trunc('month', v_cutoff)::date;
    v_current_end := v_cutoff;
    v_period_label := v_month_names[extract(month from v_cutoff)::int] || ' ' || extract(year from v_cutoff)::int;
  else
    v_current_start := make_date(extract(year from v_cutoff)::int, 1, 1);
    v_current_end := v_cutoff;
    v_period_label := extract(year from v_cutoff)::int::text;
  end if;

  if v_period = 'week' and v_comparison = 'ly' then
    v_previous_start := date_trunc('week',make_date(extract(isoyear from v_cutoff)::int-1,1,4))::date
      + (extract(week from v_cutoff)::int-1)*7;
    if extract(isoyear from v_previous_start)::int <> extract(isoyear from v_cutoff)::int-1 then
      raise exception 'iso_comparison_unavailable';
    end if;
    v_previous_end := v_previous_start + (v_current_end-v_current_start);
    v_comparison_label := 'ISO LY';
  elsif v_comparison = 'ly' or v_period = 'ytd' then
    v_previous_start := (v_current_start - interval '1 year')::date;
    v_previous_end := (v_current_end - interval '1 year')::date;
    v_comparison_label := case
      when v_period = 'ytd' then extract(year from v_previous_end)::int::text
      else 'LY'
    end;
  elsif v_period = 'week' then
    v_previous_start := v_current_start - 7;
    v_previous_end := v_current_end - 7;
    v_comparison_label := 'Попередній тиждень';
  else
    v_previous_start := (v_current_start - interval '1 month')::date;
    v_previous_end := least(
      (date_trunc('month', v_previous_start)::date + interval '1 month - 1 day')::date,
      v_previous_start + (v_current_end - v_current_start)
    );
    v_comparison_label := 'Попередній місяць';
  end if;

  select
    coalesce(sum(revenue), 0),
    coalesce(sum(checks), 0),
    coalesce(sum(markup), 0)
  into v_current_revenue, v_current_checks, v_current_markup
  from _ov_daily
  where date_id between v_current_start and v_current_end;

  select
    coalesce(sum(revenue), 0),
    coalesce(sum(checks), 0),
    coalesce(sum(markup), 0)
  into v_previous_revenue, v_previous_checks, v_previous_markup
  from _ov_daily
  where date_id between v_previous_start and v_previous_end;

  v_current_aov := case when v_current_checks <> 0 then v_current_revenue / v_current_checks else 0 end;
  v_current_markup_rate := case when v_current_revenue <> 0 then v_current_markup / v_current_revenue * 100 else 0 end;
  v_previous_aov := case when v_previous_checks <> 0 then v_previous_revenue / v_previous_checks else 0 end;
  v_previous_markup_rate := case when v_previous_revenue <> 0 then v_previous_markup / v_previous_revenue * 100 else 0 end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', channel,
        'revenue', revenue,
        'checks', checks,
        'averageCheck', case when checks <> 0 then revenue / checks else 0 end,
        'markupRate', case when revenue <> 0 then markup / revenue * 100 else 0 end,
        'share', case when v_current_revenue <> 0 then revenue / v_current_revenue * 100 else 0 end
      )
      order by revenue desc
    ),
    '[]'::jsonb
  )
  into v_channels
  from (
    select channel, sum(revenue) as revenue, sum(checks) as checks, sum(markup) as markup
    from _ov_channel_daily
    where date_id between v_current_start and v_current_end
    group by channel
  ) g;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', location,
        'revenue', current_revenue,
        'growth', case
          when previous_revenue = 0 then null
          else (current_revenue / previous_revenue - 1) * 100
        end,
        'share', case when v_current_revenue <> 0 then current_revenue / v_current_revenue * 100 else 0 end
      )
      order by current_revenue desc
    ),
    '[]'::jsonb
  )
  into v_locations
  from (
    select
      cur.location,
      cur.current_revenue,
      coalesce(prev.previous_revenue, 0) as previous_revenue
    from (
      select location, sum(revenue) as current_revenue
      from _ov_location_daily
      where date_id between v_current_start and v_current_end
      group by location
    ) cur
    left join (
      select location, sum(revenue) as previous_revenue
      from _ov_location_daily
      where date_id between v_previous_start and v_previous_end
      group by location
    ) prev using (location)
    order by cur.current_revenue desc
    limit 8
  ) x;

  v_cutoff_month := extract(month from v_cutoff)::int;
  v_cutoff_day := extract(day from v_cutoff)::int;

  with months as (
    select generate_series(1, v_cutoff_month) as month_no
  ),
  monthly as (
    select
      m.month_no,
      coalesce((
        select sum(d.revenue)
        from _ov_daily d
        where extract(year from d.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from d.date_id)::int = m.month_no
          and (
            m.month_no <> v_cutoff_month
            or extract(day from d.date_id)::int <= v_cutoff_day
          )
      ), 0) as revenue,
      coalesce((
        select sum(d.checks)
        from _ov_daily d
        where extract(year from d.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from d.date_id)::int = m.month_no
          and (
            m.month_no <> v_cutoff_month
            or extract(day from d.date_id)::int <= v_cutoff_day
          )
      ), 0) as checks,
      coalesce((
        select sum(d.markup)
        from _ov_daily d
        where extract(year from d.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from d.date_id)::int = m.month_no
          and (
            m.month_no <> v_cutoff_month
            or extract(day from d.date_id)::int <= v_cutoff_day
          )
      ), 0) as markup,
      coalesce((
        select sum(d.revenue)
        from _ov_daily d
        where extract(year from d.date_id)::int = extract(year from v_cutoff)::int - 1
          and extract(month from d.date_id)::int = m.month_no
          and (
            m.month_no <> v_cutoff_month
            or extract(day from d.date_id)::int <= v_cutoff_day
          )
      ), 0) as previous_revenue,
      coalesce((
        select sum(d.checks)
        from _ov_daily d
        where extract(year from d.date_id)::int = extract(year from v_cutoff)::int - 1
          and extract(month from d.date_id)::int = m.month_no
          and (
            m.month_no <> v_cutoff_month
            or extract(day from d.date_id)::int <= v_cutoff_day
          )
      ), 0) as previous_checks,
      coalesce((
        select sum(c.revenue)
        from _ov_channel_daily c
        where extract(year from c.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from c.date_id)::int = m.month_no
          and c.channel = 'Заклад'
          and (
            m.month_no <> v_cutoff_month
            or extract(day from c.date_id)::int <= v_cutoff_day
          )
      ), 0) as venue_revenue,
      coalesce((
        select sum(c.revenue)
        from _ov_channel_daily c
        where extract(year from c.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from c.date_id)::int = m.month_no
          and c.channel = 'Агрегатор'
          and (
            m.month_no <> v_cutoff_month
            or extract(day from c.date_id)::int <= v_cutoff_day
          )
      ), 0) as aggregator_revenue,
      coalesce((
        select sum(c.revenue)
        from _ov_channel_daily c
        where extract(year from c.date_id)::int = extract(year from v_cutoff)::int
          and extract(month from c.date_id)::int = m.month_no
          and c.channel = 'Доставка'
          and (
            m.month_no <> v_cutoff_month
            or extract(day from c.date_id)::int <= v_cutoff_day
          )
      ), 0) as delivery_revenue
    from months m
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', month_no,
        'label', v_month_names[month_no],
        'revenue', revenue,
        'revenueGrowth', case when previous_revenue = 0 then null else (revenue / previous_revenue - 1) * 100 end,
        'checks', checks,
        'checksGrowth', case when previous_checks = 0 then null else (checks / previous_checks - 1) * 100 end,
        'averageCheck', case when checks <> 0 then revenue / checks else 0 end,
        'markupRate', case when revenue <> 0 then markup / revenue * 100 else 0 end,
        'venueShare', case when revenue <> 0 then venue_revenue / revenue * 100 else 0 end,
        'aggregatorShare', case when revenue <> 0 then aggregator_revenue / revenue * 100 else 0 end,
        'deliveryShare', case when revenue <> 0 then delivery_revenue / revenue * 100 else 0 end,
        'isPartial', (
          month_no = v_cutoff_month
          and v_cutoff_day < extract(day from (date_trunc('month', v_cutoff)::date + interval '1 month - 1 day'))::int
        )
      )
      order by month_no
    ),
    '[]'::jsonb
  )
  into v_monthly_table
  from monthly;

  v_rows_cutoff_month := extract(month from v_rows_latest)::int;
  v_rows_cutoff_day := extract(day from v_rows_latest)::int;

  if p_focus_month is not null then
    if p_focus_month = v_rows_cutoff_month then
      v_multi_max := v_rows_cutoff_day;
    else
      v_multi_max := extract(
        day from (
          date_trunc('month', make_date(extract(year from v_rows_latest)::int, p_focus_month, 1))::date
          + interval '1 month - 1 day'
        )
      )::int;
    end if;

    with points as (
      select generate_series(1, v_multi_max) as point_no
    ),
    years as (
      select unnest(v_years) as year_no
    ),
    values_grid as (
      select
        p.point_no,
        y.year_no,
        coalesce(sum(d.revenue), 0) as revenue,
        coalesce(sum(d.checks), 0) as checks,
        coalesce(sum(d.markup), 0) as markup
      from points p
      cross join years y
      left join _ov_daily d
        on extract(year from d.date_id)::int = y.year_no
       and extract(month from d.date_id)::int = p_focus_month
       and extract(day from d.date_id)::int = p.point_no
      group by p.point_no, y.year_no
    ),
    point_objects as (
      select
        point_no,
        jsonb_build_object('label', point_no::text) ||
        jsonb_object_agg(
          year_no::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks <> 0 then revenue / checks else 0 end
            when 'markupRate' then case when revenue <> 0 then markup / revenue * 100 else 0 end
            else revenue
          end
          order by year_no
        ) as obj
      from values_grid
      group by point_no
    )
    select coalesce(jsonb_agg(obj order by point_no), '[]'::jsonb)
    into v_multi_year
    from point_objects;

  elsif v_grain = 'week' then
    v_multi_max := extract(week from v_rows_latest)::int;

    with points as (
      select generate_series(1, v_multi_max) as point_no
    ),
    years as (
      select distinct extract(isoyear from date_id)::int as year_no from _ov_daily
    ),
    values_grid as (
      select
        p.point_no,
        y.year_no,
        sum(d.revenue) as revenue,
        sum(d.checks) as checks,
        sum(d.markup) as markup
      from points p
      cross join years y
      left join _ov_daily d
        on extract(isoyear from d.date_id)::int = y.year_no
       and extract(week from d.date_id)::int = p.point_no
       and (p.point_no < v_multi_max or extract(isodow from d.date_id) <= extract(isodow from v_rows_latest))
      group by p.point_no, y.year_no
    ),
    point_objects as (
      select
        point_no,
        jsonb_build_object('label', 'W' || lpad(point_no::text, 2, '0')) ||
        jsonb_object_agg(
          year_no::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks <> 0 then revenue / checks else null end
            when 'markupRate' then case when revenue <> 0 then markup / revenue * 100 else null end
            else revenue
          end
          order by year_no
        ) as obj
      from values_grid
      group by point_no
    )
    select coalesce(jsonb_agg(obj order by point_no), '[]'::jsonb)
    into v_multi_year
    from point_objects;

  else
    with points as (
      select generate_series(1, 12) as point_no
    ),
    years as (
      select unnest(v_years) as year_no
    ),
    values_grid as (
      select
        p.point_no,
        y.year_no,
        coalesce(sum(d.revenue), 0) as revenue,
        coalesce(sum(d.checks), 0) as checks,
        coalesce(sum(d.markup), 0) as markup
      from points p
      cross join years y
      left join _ov_daily d
        on extract(year from d.date_id)::int = y.year_no
       and extract(month from d.date_id)::int = p.point_no
       and (
         p.point_no <> v_rows_cutoff_month
         or extract(day from d.date_id)::int <= v_rows_cutoff_day
       )
      group by p.point_no, y.year_no
    ),
    point_objects as (
      select
        point_no,
        jsonb_build_object('label', v_month_names[point_no]) ||
        jsonb_object_agg(
          year_no::text,
          case v_metric
            when 'checks' then checks
            when 'averageCheck' then case when checks <> 0 then revenue / checks else 0 end
            when 'markupRate' then case when revenue <> 0 then markup / revenue * 100 else 0 end
            else revenue
          end
          order by year_no
        ) as obj
      from values_grid
      group by point_no
    )
    select coalesce(jsonb_agg(obj order by point_no), '[]'::jsonb)
    into v_multi_year
    from point_objects;
  end if;

  with months as (
    select generate_series(
      1,
      case
        when extract(year from v_cutoff)::int = v_selected_year
          then extract(month from v_cutoff)::int
        else 12
      end
    ) as month_no
  ),
  values_grid as (
    select
      m.month_no,
      c.channel,
      coalesce(sum(c.revenue), 0) as revenue
    from months m
    cross join (values ('Заклад'), ('Агрегатор'), ('Доставка')) as wanted(channel)
    left join _ov_mix_channel_daily c
      on c.channel = wanted.channel
     and extract(year from c.date_id)::int = v_selected_year
     and extract(month from c.date_id)::int = m.month_no
     and (
       extract(year from v_cutoff)::int <> v_selected_year
       or m.month_no <> extract(month from v_cutoff)::int
       or extract(day from c.date_id)::int <= extract(day from v_cutoff)::int
     )
    group by m.month_no, wanted.channel, c.channel
  ),
  normalized as (
    select
      month_no,
      coalesce(max(revenue) filter (where channel = 'Заклад'), 0) as venue,
      coalesce(max(revenue) filter (where channel = 'Агрегатор'), 0) as aggregator,
      coalesce(max(revenue) filter (where channel = 'Доставка'), 0) as delivery
    from values_grid
    group by month_no
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', v_month_names[month_no],
        'venue', case when venue + aggregator + delivery <> 0 then venue / (venue + aggregator + delivery) * 100 else 0 end,
        'aggregator', case when venue + aggregator + delivery <> 0 then aggregator / (venue + aggregator + delivery) * 100 else 0 end,
        'delivery', case when venue + aggregator + delivery <> 0 then delivery / (venue + aggregator + delivery) * 100 else 0 end
      )
      order by month_no
    ),
    '[]'::jsonb
  )
  into v_channel_mix
  from normalized;

  v_total_delta := v_current_revenue - v_previous_revenue;
  v_checks_effect := (v_current_checks - v_previous_checks) * v_previous_aov;
  v_aov_effect := v_current_checks * (v_current_aov - v_previous_aov);

  with cur as (
    select channel as name, sum(revenue) as revenue
    from _ov_channel_daily
    where date_id between v_current_start and v_current_end
    group by channel
  ),
  prev as (
    select channel as name, sum(revenue) as revenue
    from _ov_channel_daily
    where date_id between v_previous_start and v_previous_end
    group by channel
  ),
  names as (
    select name from cur
    union
    select name from prev
  ),
  drivers as (
    select
      n.name,
      coalesce(c.revenue, 0) - coalesce(p.revenue, 0) as delta
    from names n
    left join cur c using (name)
    left join prev p using (name)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', name,
        'delta', delta,
        'contribution', case when abs(v_total_delta) < 0.01 then null else delta / v_total_delta * 100 end
      )
      order by abs(delta) desc
    ),
    '[]'::jsonb
  )
  into v_channel_drivers
  from drivers;

  with cur as (
    select location as name, sum(revenue) as revenue
    from _ov_location_daily
    where date_id between v_current_start and v_current_end
    group by location
  ),
  prev as (
    select location as name, sum(revenue) as revenue
    from _ov_location_daily
    where date_id between v_previous_start and v_previous_end
    group by location
  ),
  names as (
    select name from cur
    union
    select name from prev
  ),
  drivers as (
    select
      n.name,
      coalesce(c.revenue, 0) - coalesce(p.revenue, 0) as delta
    from names n
    left join cur c using (name)
    left join prev p using (name)
    order by abs(coalesce(c.revenue, 0) - coalesce(p.revenue, 0)) desc
    limit 6
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', name,
        'delta', delta,
        'contribution', case when abs(v_total_delta) < 0.01 then null else delta / v_total_delta * 100 end
      )
      order by abs(delta) desc
    ),
    '[]'::jsonb
  )
  into v_location_drivers
  from drivers;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into v_brands
  from (
    select distinct brand name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
  ) x;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into v_ownerships
  from (
    select distinct ownership name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
  ) x;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into v_location_options
  from (
    select distinct location as name
    from public.bi_sales_flat_mv
    where (not p_lfl or not lfl_exclude)
  ) x;

  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
  into v_order_types
  from (
    select distinct order_type name
    from public.bi_sales_flat_mv
    where p_channel is null or channel = p_channel
  ) x;

  return jsonb_build_object(
    'source', 'supabase-sql',
    'meta', jsonb_build_object(
      'sourceRowCount', v_source_rows,
      'filteredRowCount', v_filtered_rows,
      'latestSourceDate', v_source_latest,
      'cutoffDate', v_cutoff,
      'selectedYear', v_selected_year,
      'selectedMonth', p_focus_month,
      'years', to_jsonb(v_years),
      'weeklyContract', 'iso-year-week-elapsed-days-v1',
      'weeklyYears', (select jsonb_agg(y order by y) from (select distinct extract(isoyear from date_id)::int y from _ov_daily) q),
      'weeklyCutoff', v_rows_latest,
      'weeklyCalendarPartial', extract(isodow from v_rows_latest)<7,
      'availableMonths', to_jsonb(v_available_months),
      'period', v_period,
      'comparison', v_comparison,
      'periodLabel', v_period_label,
      'comparisonLabel', v_comparison_label,
      'currentYear', extract(year from v_cutoff)::int,
      'previousYear', extract(year from v_previous_end)::int,
      'brands', v_brands,
      'ownerships', v_ownerships,
      'locations', v_location_options,
      'orderTypes', v_order_types
    ),
    'current', jsonb_build_object(
      'revenue', v_current_revenue,
      'checks', v_current_checks,
      'markup', v_current_markup,
      'averageCheck', v_current_aov,
      'markupRate', v_current_markup_rate
    ),
    'previous', jsonb_build_object(
      'revenue', v_previous_revenue,
      'checks', v_previous_checks,
      'markup', v_previous_markup,
      'averageCheck', v_previous_aov,
      'markupRate', v_previous_markup_rate
    ),
    'channels', v_channels,
    'locations', v_locations,
    'monthlyTable', v_monthly_table,
    'multiYearData', v_multi_year,
    'channelMixData', v_channel_mix,
    'growthDrivers', jsonb_build_object(
      'totalDelta', v_total_delta,
      'checksEffect', v_checks_effect,
      'averageCheckEffect', v_aov_effect,
      'channelDrivers', v_channel_drivers,
      'locationDrivers', v_location_drivers
    )
  );
end;
$function$
;
