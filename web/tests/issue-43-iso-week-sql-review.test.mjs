import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../docs/sql/issue-43-iso-week-contract-shadow-NOT-APPLIED.sql',import.meta.url),'utf8');
const isoParts=(s)=>{
 const d=new Date(s+'T00:00:00Z'),t=new Date(d);
 t.setUTCDate(t.getUTCDate()+4-(d.getUTCDay()||7));
 const y=t.getUTCFullYear();
 return [y,Math.ceil((1+(t-new Date(Date.UTC(y,0,1)))/86400000)/7)];
};
test('D160 remains only SELECT shadow, never a migration',()=>{
 assert.match(sql,/NOT APPLIED/);
 assert.doesNotMatch(sql,/^\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|CALL|DO)\b/im);
});
test('weekly ISOYEAR, WEEK and cutoff consistently pair',()=>{
 assert.match(sql,/extract\(isoyear FROM max\(date\)\)::int latest_iso_year/i);
 assert.match(sql,/extract\(week FROM max\(date\)\)::int cutoff_week/i);
 assert.match(sql,/extract\(isoyear FROM date\)::int iso_year/i);
 assert.match(sql,/extract\(week FROM date\)::int week_no/i);
 assert.match(sql,/LEFT JOIN observed o USING \(iso_year,week_no\)/);
 assert.doesNotMatch(sql,/extract\(year FROM date\)/i);
});
test('real zero retains counts; missing metrics remain NULL',()=>{
 assert.match(sql,/coalesce\(o\.observation_rows,0\) observation_rows/);
 assert.match(sql,/coalesce\(o\.observation_days,0\) observation_days/);
 assert.match(sql,/o\.revenue,o\.checks,o\.markup/);
 assert.doesNotMatch(sql,/coalesce\(o\.revenue,0\)/i);
});
test('ISO W01 and W53 do not use calendar year',()=>{
 for(const [date,y,w] of [['2024-12-30',2025,1],['2025-12-29',2026,1],
 ['2021-01-01',2020,53],['2027-01-01',2026,53]])
 assert.deepEqual(isoParts(date),[y,w],date);
});
test('W53 expected 2020/2026 fixture totals',()=>{
 const values=[['2020-12-28',100],['2021-01-01',200],
 ['2021-01-04',300],['2026-12-31',10],['2027-01-01',20]];
 const sums=new Map();
 for(const [day,value] of values){const k=isoParts(day).join('-');sums.set(k,(sums.get(k)||0)+value);}
 assert.deepEqual([...sums],[['2020-53',300],['2021-1',300],['2026-53',30]]);
 assert.match(sql,/\(2020,53,300::numeric\),\(2021,1,300\),\(2026,53,30\)/);
});
