import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../../docs/sql/issue-43-monthly-observation-contract-NOT-APPLIED.sql',import.meta.url),'utf8');
const dynamics=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.bi_dynamics_payload('),
  sql.indexOf('CREATE OR REPLACE FUNCTION public.bi_overview_payload('));
const overview=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.bi_overview_payload('));

test('issue #43 proposal is not in executable migration directory and guards both exact installed hashes',()=>{
 assert.match(sql,/REVIEW-ONLY candidate/);
 assert.match(sql,/NOT APPLIED/);
 assert.match(sql,/12cddc230b9c05d25d93346ab6d493a8/);
 assert.match(sql,/55214a718cebaafa50aff6d5feb04ff6/);
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION public\.bi_/g)||[]).length,2);
 for(const fn of [overview,dynamics]){
   assert.match(fn,/SECURITY DEFINER\s+SET search_path TO 'public', 'extensions'/);
   assert.match(fn,/v_actual_hash <> v_expected_hash/);
 }
});
test('Dynamics monthly row-count provenance is separate from chart; actual zeros retained',()=>{
 assert.match(dynamics,/month_counts as \(/);
 assert.match(dynamics,/count\(b\.date\)::int as observation_count/);
 assert.match(dynamics,/jsonb_build_object\('seriesObservationCounts', mo\.j\)/);
 assert.match(dynamics,/when v_grain = 'month'/);
 const month=dynamics.slice(dynamics.indexOf('select generate_series(1,12) n'));
 assert.match(month,/sum\(b\.revenue\) revenue/);
 assert.doesNotMatch(month,/coalesce\(sum\(b\.revenue\),0\) revenue/);
 assert.match(month,/when 'markupRate' then case when revenue<>0 then markup\/revenue\*100 else null end/);
});
test('Overview monthly table returns twelve rows and distinct nullable measures and counts',()=>{
 assert.match(overview,/-- Twelve stable month rows/);
 assert.match(overview,/select generate_series\(1, 12\)::int as month_no/);
 assert.match(overview,/'currentObservationCount', coalesce\(cur\.observation_count, 0\)/);
 assert.match(overview,/'previousObservationCount', coalesce\(prior\.observation_count, 0\)/);
 assert.match(overview,/'revenue', cur\.revenue/);
 assert.match(overview,/when cur\.observation_count is null or prior\.observation_count is null/);
 assert.match(overview,/when cur\.revenue <> 0/);
 assert.match(overview,/then coalesce\(ch\.venue_revenue, 0\) \/ cur\.revenue \* 100 else null/);
});
test('Overview monthly comparison chart now has a separate count; day/week unchanged',()=>{
 assert.match(overview,/count\(d\.date_id\)::int as observation_count/);
 assert.match(overview,/case when observation_count = 0 then null else/);
 assert.match(overview,/if p_focus_month is not null then/);
 assert.match(overview,/v_multi_max := extract\(week from v_rows_latest\)::int/);
 assert.match(overview,/v_multi_max := v_rows_cutoff_day/);
});
