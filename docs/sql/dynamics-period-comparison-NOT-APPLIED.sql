-- NOT APPLIED. Review candidate, not a production migration.
-- Only the disposable local fixture is allowed to install this draft.
-- Existing bi_dynamics_payload, its chart and YoY totals are untouched.
DO $guard$
BEGIN
 IF current_database()<>'bi_fixture_dynamics_period_comparison'
    OR session_user<>'fixture'
    OR current_setting('bi.fixture_mode',true) IS DISTINCT FROM 'isolated-dynamics-period-comparison-v1'
 THEN RAISE EXCEPTION 'isolated_fixture_required'; END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.bi_dynamics_period_comparison(
 p_password text, p_metric text DEFAULT 'revenue', p_grain text DEFAULT 'month',
 p_channel text DEFAULT NULL, p_order_type text DEFAULT NULL, p_location text DEFAULT NULL,
 p_brand text DEFAULT NULL, p_ownership text DEFAULT NULL, p_lfl boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
SET timezone = 'UTC'
AS $function$
DECLARE
 v_expected_hash text;
 v_payload jsonb;
BEGIN
 SELECT value_hash INTO v_expected_hash FROM public.bi_runtime_config WHERE config_key='access_password';
 IF v_expected_hash IS NULL OR v_expected_hash<>encode(extensions.digest(coalesce(p_password,''),'sha256'),'hex')
 THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_metric IS NULL OR p_metric NOT IN ('revenue','checks','averageCheck','markupRate')
    OR p_grain IS NULL OR p_grain NOT IN ('month','week') OR p_lfl IS NULL
 THEN RAISE EXCEPTION 'invalid_parameters'; END IF;

 -- Observation means an actual warehouse row for this scope, never an inferred
 -- zero for an absent date. Coverage cannot certify the completeness of upstream
 -- ingestion or an absent order-type slice within an otherwise observed day.
 WITH scoped AS MATERIALIZED (
   SELECT date,location,lfl_exclude,revenue,checks,markup
   FROM public.bi_sales_flat_mv
   WHERE (p_channel IS NULL OR channel=p_channel)
     AND (p_order_type IS NULL OR order_type=p_order_type)
     AND (p_location IS NULL OR location=p_location)
     AND (p_brand IS NULL OR brand=p_brand)
     AND (p_ownership IS NULL OR ownership=p_ownership)
 ), source AS (
   SELECT max(date) FILTER(WHERE NOT p_lfl OR lfl_exclude IS FALSE) cutoff FROM scoped
 ), scope AS (
   SELECT cutoff,
     CASE WHEN p_grain='week' THEN extract(isoyear FROM cutoff)::int ELSE extract(year FROM cutoff)::int END latest_year,
     CASE WHEN p_grain='week' THEN date_trunc('week',make_date(extract(isoyear FROM cutoff)::int,1,4))::date
          ELSE date_trunc('year',cutoff)::date END first_start,
     CASE WHEN p_grain='week' THEN extract(week FROM cutoff)::int ELSE extract(month FROM cutoff)::int END period_count
   FROM source
 ), starts AS (
   SELECT s.*,n,
     CASE WHEN p_grain='week' THEN first_start+n*7 ELSE (first_start+make_interval(months=>n))::date END current_start
   FROM scope s CROSS JOIN LATERAL generate_series(0,s.period_count-1) n
 ), period_bounds AS (
   SELECT *,
     CASE WHEN p_grain='week' THEN current_start+6 ELSE (current_start+interval '1 month - 1 day')::date END full_current_end,
     CASE WHEN p_grain='week' THEN current_start-7 ELSE (current_start-interval '1 month')::date END previous_start,
     current_start-1 natural_previous_end
   FROM starts
 ), available AS (
   SELECT *,full_current_end natural_current_end,least(cutoff,full_current_end) available_current_end,
     cutoff<full_current_end partial
   FROM period_bounds
 ), windows AS (
   SELECT *,
     CASE WHEN partial THEN current_start+least(available_current_end-current_start+1,natural_previous_end-previous_start+1)-1
          ELSE available_current_end END current_end,
     CASE WHEN partial THEN previous_start+least(available_current_end-current_start+1,natural_previous_end-previous_start+1)-1
          ELSE natural_previous_end END previous_end
   FROM available
 ), daily AS MATERIALIZED (
   SELECT location,date,bool_or(lfl_exclude IS DISTINCT FROM false) registry_excluded,
     bool_and(CASE p_metric
       WHEN 'revenue' THEN revenue IS NOT NULL AND revenue::text NOT IN ('NaN','Infinity','-Infinity')
       WHEN 'checks' THEN checks IS NOT NULL AND checks::text NOT IN ('NaN','Infinity','-Infinity')
       WHEN 'averageCheck' THEN revenue IS NOT NULL AND checks IS NOT NULL
         AND revenue::text NOT IN ('NaN','Infinity','-Infinity') AND checks::text NOT IN ('NaN','Infinity','-Infinity')
       WHEN 'markupRate' THEN revenue IS NOT NULL AND markup IS NOT NULL
         AND revenue::text NOT IN ('NaN','Infinity','-Infinity') AND markup::text NOT IN ('NaN','Infinity','-Infinity')
       ELSE false END) valid,
     sum(revenue) revenue,sum(checks) checks,sum(markup) markup
   FROM scoped GROUP BY location,date
 ), candidate_days AS (
   SELECT w.n,d.location,
     bool_or(d.registry_excluded) AND p_lfl registry_excluded,
     count(*) FILTER(WHERE d.date BETWEEN w.current_start AND w.current_end AND d.valid)::int current_days,
     count(*) FILTER(WHERE d.date BETWEEN w.previous_start AND w.previous_end AND d.valid)::int previous_days,
     count(*) FILTER(WHERE d.date BETWEEN w.current_start AND w.current_end AND NOT d.valid)::int current_invalid,
     count(*) FILTER(WHERE d.date BETWEEN w.previous_start AND w.previous_end AND NOT d.valid)::int previous_invalid,
     sum(d.revenue) FILTER(WHERE d.date BETWEEN w.current_start AND w.current_end) current_revenue,
     sum(d.checks) FILTER(WHERE d.date BETWEEN w.current_start AND w.current_end) current_checks,
     sum(d.markup) FILTER(WHERE d.date BETWEEN w.current_start AND w.current_end) current_markup,
     sum(d.revenue) FILTER(WHERE d.date BETWEEN w.previous_start AND w.previous_end) previous_revenue,
     sum(d.checks) FILTER(WHERE d.date BETWEEN w.previous_start AND w.previous_end) previous_checks,
     sum(d.markup) FILTER(WHERE d.date BETWEEN w.previous_start AND w.previous_end) previous_markup
   FROM windows w JOIN daily d ON d.date BETWEEN w.current_start AND w.current_end
     OR d.date BETWEEN w.previous_start AND w.previous_end
   GROUP BY w.n,d.location
 ), candidates AS (
   SELECT c.*,NOT registry_excluded AND current_days=w.current_end-w.current_start+1
     AND previous_days=w.previous_end-w.previous_start+1 included
   FROM candidate_days c JOIN windows w USING(n)
 ), totals AS (
   SELECT w.n,count(c.location)::int candidate_count,
     count(c.location) FILTER(WHERE included)::int included_count,
     count(c.location) FILTER(WHERE registry_excluded)::int registry_excluded_count,
     count(c.location) FILTER(WHERE NOT included AND NOT registry_excluded)::int incomplete_count,
     coalesce(sum(c.current_days) FILTER(WHERE included),0)::int current_observed_days,
     coalesce(sum(c.previous_days) FILTER(WHERE included),0)::int previous_observed_days,
     sum(current_revenue) FILTER(WHERE included) current_revenue,
     sum(current_checks) FILTER(WHERE included) current_checks,
     sum(current_markup) FILTER(WHERE included) current_markup,
     sum(previous_revenue) FILTER(WHERE included) previous_revenue,
     sum(previous_checks) FILTER(WHERE included) previous_checks,
     sum(previous_markup) FILTER(WHERE included) previous_markup,
     sum(current_revenue) FILTER(WHERE NOT registry_excluded) observed_current_revenue,
     sum(current_checks) FILTER(WHERE NOT registry_excluded) observed_current_checks,
     sum(current_markup) FILTER(WHERE NOT registry_excluded) observed_current_markup,
     sum(previous_revenue) FILTER(WHERE NOT registry_excluded) observed_previous_revenue,
     sum(previous_checks) FILTER(WHERE NOT registry_excluded) observed_previous_checks,
     sum(previous_markup) FILTER(WHERE NOT registry_excluded) observed_previous_markup,
     coalesce(sum(current_invalid) FILTER(WHERE NOT registry_excluded),0) current_invalid,
     coalesce(sum(previous_invalid) FILTER(WHERE NOT registry_excluded),0) previous_invalid
   FROM windows w LEFT JOIN candidates c USING(n) GROUP BY w.n
 ), metrics AS (
   SELECT w.*,t.*,
     CASE p_metric WHEN 'revenue' THEN t.current_revenue WHEN 'checks' THEN t.current_checks
       WHEN 'averageCheck' THEN t.current_revenue/nullif(t.current_checks,0)
       WHEN 'markupRate' THEN t.current_markup/nullif(t.current_revenue,0)*100 END current_value,
     CASE p_metric WHEN 'revenue' THEN t.previous_revenue WHEN 'checks' THEN t.previous_checks
       WHEN 'averageCheck' THEN t.previous_revenue/nullif(t.previous_checks,0)
       WHEN 'markupRate' THEN t.previous_markup/nullif(t.previous_revenue,0)*100 END previous_value,
     CASE WHEN t.current_invalid=0 THEN CASE p_metric WHEN 'revenue' THEN t.observed_current_revenue WHEN 'checks' THEN t.observed_current_checks
       WHEN 'averageCheck' THEN t.observed_current_revenue/nullif(t.observed_current_checks,0)
       WHEN 'markupRate' THEN t.observed_current_markup/nullif(t.observed_current_revenue,0)*100 END END observed_current,
     CASE WHEN t.previous_invalid=0 THEN CASE p_metric WHEN 'revenue' THEN t.observed_previous_revenue WHEN 'checks' THEN t.observed_previous_checks
       WHEN 'averageCheck' THEN t.observed_previous_revenue/nullif(t.observed_previous_checks,0)
       WHEN 'markupRate' THEN t.observed_previous_markup/nullif(t.observed_previous_revenue,0)*100 END END observed_previous
   FROM windows w JOIN totals t USING(n)
 ), classified AS (
   SELECT *,CASE WHEN included_count=0 THEN 'NO_TRUSTWORTHY_COHORT'
     WHEN NOT p_lfl AND included_count<candidate_count THEN 'INCOMPLETE_COVERAGE'
     WHEN current_value IS NULL OR previous_value IS NULL THEN 'UNDEFINED_METRIC'
     ELSE NULL END reason
   FROM metrics
 ), output AS (
   SELECT jsonb_build_object(
     'key',CASE WHEN p_grain='week' THEN to_char(current_start,'IYYY-"W"IW') ELSE to_char(current_start,'YYYY-MM') END,
     'label',CASE WHEN p_grain='week' THEN to_char(current_start,'"W"IW') ELSE to_char(current_start,'MM') END,
     'status',CASE WHEN reason IS NULL THEN 'ready' ELSE 'unavailable' END,'reason',reason,
     'currentStart',current_start,'currentEnd',current_end,'previousStart',previous_start,'previousEnd',previous_end,
     'naturalCurrentEnd',natural_current_end,'naturalPreviousEnd',natural_previous_end,
     'currentDays',current_end-current_start+1,'previousDays',previous_end-previous_start+1,
     'partial',partial,'clampedDays',available_current_end-current_end,
     'current',CASE WHEN reason IS NULL THEN current_value ELSE NULL END,
     'previous',CASE WHEN reason IS NULL THEN previous_value ELSE NULL END,
     'delta',CASE WHEN reason IS NOT NULL THEN NULL WHEN p_metric='markupRate' THEN current_value-previous_value
       ELSE (current_value/NULLIF(previous_value,0)-1)*100 END,
     'unit',CASE WHEN p_metric='markupRate' THEN 'pp' ELSE 'percent' END,
     'observedCurrent',observed_current,'observedPrevious',observed_previous,
     'cohort',jsonb_build_object(
       'mode',CASE WHEN p_lfl THEN 'pairwise-complete' ELSE 'all-locations' END,
       'candidateCount',candidate_count,'includedCount',included_count,'excludedCount',candidate_count-included_count,
       'registryExcludedCount',registry_excluded_count,'incompleteCount',incomplete_count,
       'currentObservedDays',current_observed_days,'previousObservedDays',previous_observed_days,
       'currentExpectedDays',included_count*(current_end-current_start+1),
       'previousExpectedDays',included_count*(previous_end-previous_start+1),
       'currentCoverage',current_observed_days::numeric/nullif(included_count*(current_end-current_start+1),0),
       'previousCoverage',previous_observed_days::numeric/nullif(included_count*(previous_end-previous_start+1),0)
     )
   ) period,current_start FROM classified
 )
 SELECT jsonb_build_object(
   'contractVersion','dynamics-period-comparison-v1',
   'status',CASE WHEN s.cutoff IS NULL THEN 'unavailable' ELSE 'ready' END,
   'reason',CASE WHEN s.cutoff IS NULL THEN 'NO_DATA' ELSE NULL END,
   'latestYear',s.latest_year,'cutoff',s.cutoff,'grain',p_grain,'metric',p_metric,
   'filters',jsonb_build_object('channel',p_channel,'orderType',p_order_type,'location',p_location,
     'brand',p_brand,'ownership',p_ownership,'lfl',p_lfl),
   'periods',coalesce((SELECT jsonb_agg(period ORDER BY current_start) FROM output),'[]'::jsonb)
 ) INTO v_payload FROM scope s;
 RETURN v_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.bi_dynamics_period_comparison(text,text,text,text,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bi_dynamics_period_comparison(text,text,text,text,text,text,text,text,boolean) TO anon, authenticated, service_role;
