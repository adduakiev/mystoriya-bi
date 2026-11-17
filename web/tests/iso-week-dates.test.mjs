import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {moduleLoader,React,renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const {isoWeekDateRange}=moduleLoader({})('lib/iso-week-dates.ts');

test('ISO dates use Monday–Sunday and preserve both calendar years at the boundaries',()=>{
  assert.deepEqual(isoWeekDateRange(2026,'W01'),{
    isoYear:2026,week:1,monday:'2025-12-29',sunday:'2026-01-04',
    shortLabel:'W01 29.12–04.01',fullLabel:'W01 29.12.2025–04.01.2026'
  });
  assert.deepEqual(isoWeekDateRange(2026,53),{
    isoYear:2026,week:53,monday:'2026-12-28',sunday:'2027-01-03',
    shortLabel:'W53 28.12–03.01',fullLabel:'W53 28.12.2026–03.01.2027'
  });
  assert.equal(isoWeekDateRange(2025,'W52').monday,'2025-12-22');
  assert.equal(isoWeekDateRange(2025,'W53'),null);
  assert.equal(isoWeekDateRange(2020,'W53').sunday,'2021-01-03');
});

test('invalid years and week labels cannot invent calendar dates',()=>{
  for(const year of [NaN,Infinity,2026.5,0,-1,10000]) assert.equal(isoWeekDateRange(year,1),null);
  for(const week of [0,54,1.5,NaN,'W00','W54','W1','W01 extra','Січ','1','']) {
    assert.equal(isoWeekDateRange(2026,week),null);
  }
});

test('ISO date ranges are deterministic across UTC, Kyiv and Los Angeles',()=>{
  const code=`import {moduleLoader} from './web/tests/support/bi-preview-harness.mjs';
    const {isoWeekDateRange}=moduleLoader({})('lib/iso-week-dates.ts');
    console.log(JSON.stringify([1,13,44,53].map(w=>isoWeekDateRange(2026,w))));`;
  const values=['UTC','Europe/Kyiv','America/Los_Angeles'].map(TZ=>execFileSync(process.execPath,
    ['--input-type=module','-e',code],{cwd:new URL('../../',import.meta.url),env:{...process.env,TZ},encoding:'utf8'}));
  assert.equal(values[0],values[1]); assert.equal(values[0],values[2]);
});

function chart(props){
  const captured={};
  const recharts=Object.fromEntries(['CartesianGrid','Legend','Line','LineChart','ResponsiveContainer','Tooltip','XAxis','YAxis']
    .map(name=>[name,p=>{(captured[name]??=[]).push(p);return React.createElement('div',null,p.children);} ]));
  const {MultiYearMetricChart}=moduleLoader({recharts})('components/MultiYearMetricChart.tsx');
  renderToStaticMarkup(React.createElement(MultiYearMetricChart,{data:[{label:'W01',2025:null,2026:0}],years:[2025,2026],metric:'revenue',...props}));
  return captured;
}

test('weekly chart tooltip labels dates for the explicitly supplied ISO year',()=>{
  const tooltip=chart({weekDateYear:2026}).Tooltip[0];
  assert.equal(tooltip.labelFormatter('W01'),'W01 29.12.2025–04.01.2026 · ISO-рік 2026');
  assert.equal(tooltip.labelFormatter('W53'),'W53 28.12.2026–03.01.2027 · ISO-рік 2026');
  assert.deepEqual(tooltip.formatter(null,'2025'),['—','2025']);
  assert.deepEqual(tooltip.formatter(0,'2026'),['₴0','2026']);
  assert.equal(chart({weekDateYear:2025}).Tooltip[0].labelFormatter('W53'),'W53 · ISO-рік 2025 · дати недоступні');
});

test('omitting ISO year preserves monthly labels and all existing metric formatters',()=>{
  for(const [metric,expected]of [['revenue','₴12'],['checks','12'],['averageCheck','₴12'],['markupRate','12.3%']]){
    const captured=chart({metric,data:[{label:'Січ',2025:12.3,2026:12.3}]});
    assert.equal(captured.Tooltip[0].labelFormatter,undefined);
    assert.deepEqual(captured.Tooltip[0].formatter(12.3,'2026'),[expected,'2026']);
    assert.deepEqual(captured.Line.map(p=>[p.dataKey,p.connectNulls]),[['2025',false],['2026',false]]);
  }
});
