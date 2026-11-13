import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {moduleLoader, React, renderToStaticMarkup} from './support/bi-preview-harness.mjs';
const load = moduleLoader({'server-only':{}, 'node:crypto':crypto,
  './report.module.css':{default:{value:'value',scroll:'scroll'}},
  'next/link':{default:({children, prefetch, ...props})=>React.createElement('a',props,children)},
  '@/components/SidebarBrand':{SidebarBrand:()=>null}});
const {normalizeGlovoSheet, GLOVO_HEADERS, buildGlovoReport, selectGlovoReport} = load('lib/data/glovo-contract.ts');
const {applyGlovoMappings:map, GLOVO_SITE_HEADERS:SH, GLOVO_BRAND_HEADERS:BH} = load('lib/data/glovo-mapping.ts');
const {confirmGlovoMonths, glovoMonthDigest, GLOVO_MONTH_DIGESTS} = load('lib/data/glovo-confirmation.ts');
const {analyzeGlovo, glovoPairedTicket} = load('lib/data/glovo-analytics.ts');
const {glovoReferenceParity} = load('lib/data/glovo-parity.ts');
const filters = {month:'',brand:'',group:'',location:'',mapping:'',sort:'source'};
const row = (month='2026-01', brand='Synthetic A', location='Synthetic site', orders=2, sum=20) =>
  [month,brand,location,'Synthetic raw name','Synthetic address',orders,sum,7,1];
const contract = (...rows) => normalizeGlovoSheet([GLOVO_HEADERS,...rows]);
const site = (location='Synthetic site', target='Ахматова NEW', approval='Погоджено') => [location,'Synthetic address',target,approval,'Synthetic site reason'];
const brand = (name='Synthetic A', location='Synthetic site', type='Віртуальний', ownership='Власні', approval='Погоджено') =>
  [999,name,location,type,ownership,approval,'Synthetic brand reason'];
const mapped = (...rows) => map(contract(...rows), [SH,site()], [BH,brand(),brand('Synthetic B','Synthetic site','Фізичний','Франшиза')]);

test('approved exact dictionaries classify only their raw pair and preserve source identity, lineage and reasons', () => {
  const source = contract(row(), row('2026-01','Synthetic A','Other site'), row('2026-01','Synthetic B'),row('2026-01','New storefront'));
  const result = map(source,[SH,site()],[BH,brand(),brand('Synthetic B','Synthetic site','Фізичний','Франшиза')]);
  assert.equal(result.rows[0].physicalLocation,'Ахматова');
  assert.equal(result.rows[0].identity,'VIRTUAL'); assert.equal(result.rows[0].ownership,'OWNED');
  assert.equal(result.rows[0].normalizedGroup,'Synthetic A');
  assert.equal(result.rows[0].sourceRow,7); assert.equal(result.rows[0].key,source.rows[0].key);
  assert.match(result.rows[0].mappingReason,/Excel 999.*Synthetic brand reason/);
  assert.match(result.rows[0].mappingReason,/Synthetic site reason/);
  assert.equal(result.rows[1].identity,'UNKNOWN'); assert.equal(result.rows[1].physicalLocation,null);
  assert.equal(result.rows[2].identity,'PHYSICAL'); assert.equal(result.rows[2].ownership,'FRANCHISE');
  assert.equal(result.rows[3].identity,'UNKNOWN'); assert.equal(result.rows[3].normalizedGroup,null);
  assert.equal(source.rows[0].identity,'UNKNOWN','input remains immutable');
  for (const approval of ['', 'Очікує']) {
    const pending = map(contract(row()),[SH,site('Synthetic site','unapproved',approval)], [BH,brand('Synthetic A','Synthetic site','unapproved','unapproved',approval)]).rows[0];
    assert.equal(pending.physicalLocation,null); assert.equal(pending.identity,'UNKNOWN'); assert.equal(pending.ownership,'UNKNOWN');
  }
});

test('all explicit site, identity and ownership aliases apply; Meat Bar grouping survives dictionary mapping', () => {
  for (const [target, expected] of [['Ахматова NEW','Ахматова'],['Оболонь NEW','Оболонь'],['Теремки NEW','Теремки'],['Парк Авеню NEW','Парк Авеню'],['София new','Софія']]) {
    assert.equal(map(contract(row()),[SH,site('Synthetic site',target)],[BH]).rows[0].physicalLocation,expected);
  }
  for (const [raw, expected] of [['Власні','OWNED'],['Власний','OWNED'],['Франчазі','FRANCHISE'],['Франшиза','FRANCHISE'],['Партнерський','PARTNER']]) {
    for (const type of ['Реальний','Фізичний','Віртуальний']) {
      const r = map(contract(row()),[SH],[BH,brand('Synthetic A','Synthetic site',type,raw)]).rows[0];
      assert.equal(r.ownership,expected); assert.equal(r.identity,type==='Віртуальний'?'VIRTUAL':'PHYSICAL');
    }
  }
  const name='Meatbar Івано-Франківська';
  const r=map(contract(row('2026-01',name)),[SH,site()],[BH,brand(name)]).rows[0];
  assert.equal(r.rawBrand,name); assert.equal(r.normalizedGroup,'МітБар');
});

test('mapping structural ambiguity rejects the entire report including invalid unused approved records', () => {
  const bad = [
    [[['bad']],[BH]], [[SH],[['bad']]], [[SH,site(),site()],[BH]], [[SH],[BH,brand(),brand()]],
    [[SH,site('Synthetic site','')],[BH]], [[SH,site('Synthetic site','target','Rejected')],[BH]],
    [[SH],[BH,brand('Unused','Other','bad')]], [[SH],[BH,brand('Unused','Other','Реальний','bad')]],
    [[SH],[BH,[...brand(),'extra']]], [[SH],[BH,brand('', 'Synthetic site')]],
    [[SH],[BH,Object.assign(brand(),{0:'7'})]], [[SH,site(),site('Synthetic site','target','Очікує')],[BH]]
  ];
  for (const [sites,brands] of bad) assert.throws(()=>map(contract(row()),sites,brands),{message:'GLOVO_MAPPING_INVALID'});
});

test('digest uses sorted raw JSON rows; every fact, missing measure and lineage change invalidate confirmation', () => {
  const rows=[row(),row('2026-01','Synthetic B')];
  const digest=glovoMonthDigest(rows);
  assert.equal(digest,crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'));
  assert.equal(digest,glovoMonthDigest([...rows].reverse()));
  assert.equal(confirmGlovoMonths([GLOVO_HEADERS,...rows],{'2026-01':digest})[0].status,'CONFIRMED');
  assert.equal(confirmGlovoMonths([GLOVO_HEADERS,...rows])[0].status,'CHANGED');
  for (const changes of [{5:null},{6:21},{7:99},{2:'Other source'}]) {
    const changed=[Object.assign([...rows[0]],changes),rows[1]];
    assert.equal(confirmGlovoMonths([GLOVO_HEADERS,...changed],{'2026-01':digest})[0].status,'CHANGED');
  }
  assert.equal(confirmGlovoMonths([GLOVO_HEADERS,row('2026-11')])[0].status,'UNCONFIRMED');
  assert.equal(Object.keys(GLOVO_MONTH_DIGESTS).length,10);
  const missing=row('2026-01','Synthetic A','Synthetic site',2,null);
  const confirmed=confirmGlovoMonths([GLOVO_HEADERS,missing],{'2026-01':glovoMonthDigest([missing])});
  assert.equal(buildGlovoReport(contract(missing),confirmed.map(c=>c.month),['2026-01']).coverage,'PARTIAL');
});

test('all-network KPIs use strict totals, paired ticket and classified purchase-sum virtual share', () => {
  const report=buildGlovoReport(mapped(row(),row('2026-01','Synthetic B','Synthetic site',8,80)),['2026-01'],['2026-01']);
  const a=analyzeGlovo(report,{...filters,month:'2026-01'});
  assert.equal(a.selected.metrics.purchaseSum,100); assert.equal(a.selected.metrics.deliveredOrders,10);
  assert.equal(a.averageTicket,10); assert.equal(a.virtualShare,20);
  assert.equal(a.coverage.paired,2); assert.equal(a.locations.length,1); assert.equal(a.brands.length,2);
  assert.equal(a.matrix.length,2);
  assert.equal(analyzeGlovo(report,{...filters,month:'2026-01',ownership:'OWNED'}).selected.metrics.purchaseSum,20);
  assert.equal(analyzeGlovo(report,{...filters,month:'2026-01',identity:'VIRTUAL',physical:'Ахматова',mapping:'approved'}).selected.rows.length,1);
  const unknown=buildGlovoReport(contract(row()),['2026-01'],['2026-01']);
  assert.equal(analyzeGlovo(unknown,{...filters,month:'2026-01'}).virtualShare,null);
  const incomplete=mapped(row(),row('2026-01','Synthetic B','Synthetic site',null,80));
  assert.equal(glovoPairedTicket(incomplete.rows),10);
  assert.equal(analyzeGlovo(buildGlovoReport(incomplete,[],['2026-01']),{...filters,month:'2026-01'}).selected.metrics.deliveredOrders,null);
});

test('contiguous equal-length comparisons distinguish portfolio growth from stable normalized-brand × location cohort', () => {
  const report=buildGlovoReport(mapped(row('2026-01'),row('2026-02','Synthetic A','Synthetic site',3,30),row('2026-02','Synthetic B','Synthetic site',5,50)),['2026-01','2026-02'],['2026-01','2026-02']);
  const portfolio=analyzeGlovo(report,{...filters,month:'2026-02'});
  assert.equal(portfolio.comparison.absolute,60); assert.equal(portfolio.comparison.percent,300);
  assert.equal(portfolio.latest.absolute,60); assert.equal(portfolio.latest.percent,300);
  assert.deepEqual(portfolio.comparison.previousMonths,['2026-01']);
  const cohort=analyzeGlovo(report,{...filters,month:'2026-02',compare:'cohort'});
  assert.equal(cohort.comparison.absolute,10); assert.equal(cohort.comparison.percent,50); assert.equal(cohort.comparison.common,1);
  assert.equal(cohort.brands.find(b=>b.label==='Synthetic A').contribution,10/60*100);
  assert.equal(cohort.brands.find(b=>b.label==='Synthetic B').absolute,null,'absent is not silently zero');
  const range=analyzeGlovo(report,{...filters,from:'2026-01',to:'2026-02'});
  assert.deepEqual(range.comparison.previousMonths,['2025-11','2025-12']); assert.equal(range.comparison.absolute,null);
  for (const f of [{from:'2026-02',to:'2026-01'},{from:'2026-01'},{year:'bad'}]) assert.equal(analyzeGlovo(report,{...filters,...f}).selected.coverage,'PARTIAL');
  const absent=selectGlovoReport(report,{...filters,from:'2026-01',to:'2026-03'});
  assert.equal(absent.trend.length,3); assert.equal(absent.coverage,'PARTIAL'); assert.equal(absent.trend[2].purchaseSum,null);
  assert.equal(selectGlovoReport(report,{...filters,year:'2026'}).trend.length,12);
  const gap=buildGlovoReport(mapped(row('2026-01'),row('2026-03')),['2026-01','2026-03'],['2026-01','2026-03']);
  assert.equal(analyzeGlovo(gap,{...filters,month:'all'}).selected.coverage,'PARTIAL');
  assert.equal(analyzeGlovo(gap,{...filters,month:'all'}).selected.months.length,3);
  const partial=buildGlovoReport(mapped(row('2026-01'),row('2026-02')),['2026-01'],['2026-01','2026-02']);
  assert.equal(analyzeGlovo(partial,{...filters,month:'2026-02'}).trend[0].absolute,null);
});

test('reference parity exposes actual deltas and never substitutes reference figures', () => {
  const report=buildGlovoReport(mapped(...Array.from({length:10},(_,i)=>row(`2026-${String(i+1).padStart(2,'0')}`))),Object.keys(GLOVO_MONTH_DIGESTS));
  const parity=glovoReferenceParity(report);
  assert.equal(parity.assertions[0].observed,200); assert.equal(parity.assertions[0].delta,200-25887779.33);
  assert.ok(parity.assertions.every(a=>a.status==='DELTA'));
  const partial=glovoReferenceParity(buildGlovoReport(contract(row())));
  assert.ok(partial.assertions.every(a=>a.status==='UNVERIFIED'));
});

test('SSR v2 keeps active filters in drilldown, network default, captions and readable currency KPI', () => {
  const report=buildGlovoReport(mapped(row('2026-01','Synthetic A','Synthetic site',2,25887779.33)),['2026-01'],['2026-01']);
  const Presenter=load('app/aggregators/glovo/GlovoReportPresenter.tsx').GlovoReportPresenter;
  const f={...filters,month:'2026-01',identity:'VIRTUAL',ownership:'OWNED',compare:'cohort',sort:'amount-desc'};
  const html=renderToStaticMarkup(React.createElement(Presenter,{report:selectGlovoReport(report,f),sourceReport:report,filters:f}));
  assert.match(html,/25[^0-9]*887[^0-9]*779,33/);
  assert.match(html,/Відомі суми: 1\/1/); assert.match(html,/включає франчайзі/);
  assert.equal((html.match(/<caption>/g)??[]).length,5);
  assert.equal((html.match(/role="region"[^>]*tabindex="0"/g)??[]).length,5);
  const links=[...html.matchAll(/href="([^"#]*aggregators\/glovo\?[^\"]+)"/g)].map(m=>new URL(m[1].replaceAll('&amp;','&'),'https://test.invalid'));
  assert.ok(links.length>0);
  for (const url of links) {assert.equal(url.searchParams.get('ownership'),'OWNED');assert.equal(url.searchParams.get('identity'),'VIRTUAL');assert.equal(url.searchParams.get('compare'),'cohort');}
  const all=renderToStaticMarkup(React.createElement(Presenter,{report,filters:{...filters,month:'2026-01'}}));
  assert.match(all,/<option value="" selected="">Уся мережа<\/option>/);
});

test('actual page surfaces changed historical checksum and parity delta without replacing facts', async () => {
  const report=buildGlovoReport(mapped(row()),[],['2026-01']);
  const Page=moduleLoader({
    '@/lib/data/glovo-source':{loadGlovoSource:async()=>({status:'CONNECTED',reason:'Synthetic read only',report,
      latestEventMonth:'2026-01',lastReadAt:'2026-11-13T00:00:00Z',
      confirmations:[{month:'2026-01',status:'CHANGED',digest:'a'.repeat(64),expectedDigest:'b'.repeat(64)}],parity:glovoReferenceParity(report)})},
    '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
    'next/link':{default:({prefetch,children,...props})=>React.createElement('a',props,children)},
    './report.module.css':{default:{value:'value'}}
  })('app/aggregators/glovo/page.tsx').default;
  const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({month:'2026-01'})}));
  assert.match(html,/Підтвердження повноти втрачено/);
  assert.match(html,/2026-01 · CHANGED/);assert.ok(html.includes('a'.repeat(64)));assert.ok(html.includes('b'.repeat(64)));
  assert.match(html,/UNVERIFIED/);assert.match(html,/відхилення -25887759\.330000/);
  assert.match(html,/<strong class="value">20<\/strong>/);
  assert.match(html,/KPI · PARTIAL/);assert.doesNotMatch(html,/KPI · COMPLETE/);
});
