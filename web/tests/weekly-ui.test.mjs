import test from 'node:test';
import assert from 'node:assert/strict';
import {previewHarness,React,renderToStaticMarkup} from './support/bi-preview-harness.mjs';
function flag(t,value){const old=process.env.BI_ISO_WEEKS_V1;process.env.BI_ISO_WEEKS_V1=value;t.after(()=>{if(old===undefined)delete process.env.BI_ISO_WEEKS_V1;else process.env.BI_ISO_WEEKS_V1=old;});}
const routes=[['/','overview','loadOverviewData'],['/delivery','delivery','loadDeliveryData'],['/dynamics','dynamics','loadDynamicsData']];
for(const [route,name,fn] of routes){
 for(const mode of ['disabled','ready','unavailable']){
  test(`${route} weekly UI ${mode}: preserve shell and never show unverified chart`,async t=>{
   flag(t,mode==='disabled'?'0':'1');t.mock.method(globalThis,'fetch',()=>assert.fail('synthetic SSR only'));
   const h=previewHarness();const mod=h.load(`lib/data/${name}.ts`);const original=mod[fn];let requested;
   t.mock.method(mod,fn,async(query,...args)=>{
    requested=query;
    if(mode==='unavailable')throw Error('ISO_WEEK_CONTRACT_UNAVAILABLE');
    const result=await original({...query,grain:'month'},...args);
    if(mode==='disabled')return result;
    const weekly={years:[2025,2026],cutoff:'2026-01-01',partial:true,series:[{label:'W01',2025:null,2026:0}]};
    return {...result,weekly,years:weekly.years,multiYearData:weekly.series,series:weekly.series};
   });
   const html=await h.render(route,{grain:'week',year:'2026',lfl:'1'});
   assert.match(html,/class="sidebar/);
   assert.equal(requested.grain,mode==='disabled'?'month':'week');
   if(mode==='unavailable'){
    assert.match(html,/Тижневий звіт поки недоступний/);assert.match(html,/Повернутися до місячного звіту/);
    assert.doesNotMatch(html,/data-mock-chart|kpi-card/);
   }else if(mode==='ready'){
    assert.match(html,/ISO-тижні/);assert.match(html,/понеділок–неділя/);assert.match(html,/2026-01-01/);
    assert.match(html,/Неповний тиждень/);assert.match(html,/відсутність спостережень, а не нуль/);
    assert.match(html,/data-mock-chart="MultiYearMetricChart"/);
   }else{assert.match(html,/Тижні \(тимчасово недоступні\)/);assert.doesNotMatch(html,/Неповний тиждень/);}
  });
 }
}
test('complete weekly period is labeled without claiming observation completeness',()=>{
 const h=previewHarness();const {WeeklyReportStatus}=h.load('components/WeeklyReportStatus.tsx');
 const html=renderToStaticMarkup(React.createElement(WeeklyReportStatus,{report:{years:[2026],cutoff:'2026-01-04',partial:false,series:[]}}));
 assert.match(html,/Повний календарний тиждень/);assert.doesNotMatch(html,/Неповний тиждень/);assert.match(html,/відсутність спостережень/);
});
