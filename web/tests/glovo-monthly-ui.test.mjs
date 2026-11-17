import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleLoader,React,renderToStaticMarkup} from './support/bi-preview-harness.mjs';

const load=moduleLoader({"./monthly.module.css":{__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})}});
const {GlovoMonthlyDashboard}=load('app/aggregators/glovo/GlovoMonthlyDashboard.tsx');
const make=(month,brand,site,amount,orders,extra={})=>({
  key:`${month}/${brand}/${site}`,month,rawBrand:brand,sourceLocation:site,sourceName:'Synthetic source',sourceAddress:'Synthetic address',sourceRow:1,
  normalizedGroup:null,physicalLocation:null,physicalId:null,ownership:'Власні',identity:'Реальний',mappingReason:'SYNTHETIC',
  purchaseSum:amount,deliveredOrders:orders,sourceHasNumeric:amount!==null||orders!==null,openingMonth:null,...extra,
});
const rows=[
  make('2026-01','Alpha','North',2000,2),make('2026-02','Alpha','North',1000,1),make('2026-03','Alpha','North',500,1),
  make('2026-01','Alpha','South',4000,8,{identity:'Віртуальний'}),make('2026-02','Alpha','South',9000,9,{identity:'Віртуальний'}),make('2026-03','Alpha','South',0,0,{identity:'Віртуальний'}),
  make('2026-01','Beta','East',1000,5,{ownership:'Франчайзі',identity:'Віртуальний'}),make('2026-02','Beta','East',500,10,{ownership:'Франчайзі',identity:'Віртуальний'}),make('2026-03','Beta','East',null,null,{ownership:'Франчайзі',identity:'Віртуальний'}),
];
const render=(props={})=>renderToStaticMarkup(React.createElement(GlovoMonthlyDashboard,{rows,incompleteMonths:['2026-03'],...props}));
const group=(html,key)=>html.match(new RegExp(`<tr[^>]*data-group="${key}"[^>]*>([\\s\\S]*?)</tr>`))?.[1]||'';
const normalized=html=>html.replaceAll('\u00a0',' ').replaceAll('\u202f',' ');

test('monthly SSR exposes requested controls, Jan→latest axes and weighted AOV with real totals',t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No network permitted'));
  const html=normalized(render());
  for(const label of ['Власність','Заклад','Бренд','Тип вітрини','Фокус показників','Сума, грн*','Замовлення','Скинути фільтри'])assert.ok(html.includes(label));
  assert.match(html,/aria-pressed="true"[^>]*>Сума, грн\*/);
  assert.match(html,/role="region"[^>]*tabindex="0"/);
  for(const m of ['2026-01','2026-02','2026-03'])assert.ok(html.includes(`data-month="${m}"`));
  assert.ok(!html.includes('data-month="2026-04"'));
  assert.ok(html.includes('10 500 грн*'));
  assert.ok(html.includes('>20</strong>'));
  assert.ok(html.includes('<strong>525 грн*</strong>'),'sum 10500 / orders20, not mean of ticket averages');
  assert.ok(html.includes('<strong>90,5%</strong>'));
  assert.match(html,/Березень 2026 — неповний період/);
  assert.match(html,/конвертація не виконувалась/);
  assert.match(group(html,'Alpha'),/data-month="2026-02" data-value="10000"/);
  assert.match(group(html,'Beta'),/data-total-value="1500"[^>]*>~1,5/);
  assert.match(html,/Alpha → заклади/);
  assert.match(group(html,'North'),/data-month="2026-02" data-value="1000"/);
});

test('orders mode and selected brand share the same monthly/detail controls',()=>{
  const html=render({initialFilters:{metric:'deliveredOrders',selectedBrand:'Beta',focusMonth:'2026-02',secondary:'share'}});
  assert.match(html,/aria-pressed="true"[^>]*>Замовлення/);
  assert.match(html,/Beta → заклади/);
  assert.match(group(html,'Beta'),/data-month="2026-02" data-value="10"/);
  assert.match(group(html,'East'),/data-month="2026-02" data-value="10"/);
  assert.match(group(html,'Beta'),/>50%<\/span>/);
  assert.match(group(html,'East'),/>100%<\/span>/);
  assert.match(html,/Частки закладів — усередині обраного бренду/);
});

test('every exact filter updates KPI, brand table and site detail together',()=>{
  for(const filters of [{ownership:'Франчайзі'},{brand:'Beta'},{location:'East'},{ownership:'Франчайзі',identity:'Віртуальний'}]){
    const html=normalized(render({initialFilters:{...filters,focusMonth:'2026-02'}}));
    assert.ok(!html.includes('data-group="Alpha"'));
    assert.ok(html.includes('data-group="Beta"'));
    assert.ok(html.includes('data-group="East"'));
    assert.ok(html.includes('>500 грн*</strong>'));
    assert.ok(html.includes('>10</strong>'));
    assert.ok(html.includes('<strong>50 грн*</strong>'));
  }
  const real=normalized(render({initialFilters:{identity:'Реальний',focusMonth:'2026-02'}}));
  assert.ok(!real.includes('data-group="Beta"'));
  assert.ok(!real.includes('data-group="South"'));
  assert.ok(real.includes('>1 000 грн*</strong>'));
  assert.ok(real.includes('<strong>0%</strong>'),'confirmed all-real cohort has zero virtual share');
});

test('unknown, measured zero and confirmed before-opening stay distinct in table cells',()=>{
  const custom=[make('2026-01','Case','Unknown',null,null),make('2026-03','Case','Unknown',10,1),
    make('2026-01','Case','Zero',0,0),make('2026-03','Case','Zero',20,2),
    make('2026-03','Case','New',30,3,{openingMonth:'2026-03'})];
  const html=render({rows:custom,initialFilters:{selectedBrand:'Case',focusMonth:'2026-03'}});
  assert.match(group(html,'Unknown'),/data-month="2026-01" data-value="unknown"[\s\S]*?<span[^>]*>\?<\/span>/);
  assert.match(group(html,'Zero'),/data-month="2026-01" data-value="0"[\s\S]*?<span[^>]*>0<\/span>/);
  assert.match(group(html,'New'),/data-month="2026-01" data-value="0"[\s\S]*?<span[^>]*>До відкриття<\/span>/);
  assert.match(group(html,'Unknown'),/дата відкриття невідома/);
  assert.match(group(html,'New'),/відкриття: 2026-03/);
  assert.match(html,/~0,1/,'partially observed annual total is visibly partial');
});

test('incomplete month disables MoM while loaded values remain, missing data suppresses AOV/share',()=>{
  const html=normalized(render({initialFilters:{focusMonth:'2026-03'}}));
  assert.match(html,/MoM недоступний: Місяць неповний/);
  assert.match(html,/<strong[^>]*>~500 грн\*<\/strong>/);
  assert.match(html,/<h3>Середній чек · Березень 2026<\/h3><strong>—<\/strong>/);
  assert.match(html,/<h3>Частка віртуальних · Березень 2026<\/h3><strong>—<\/strong>/);
  assert.match(group(html,'Beta'),/data-month="2026-03" data-value="unknown"/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});

test('empty filter and empty source never invent KPI zeros or charts',()=>{
  for(const html of [render({initialFilters:{brand:'not-a-brand'}}),render({rows:[]})]){
    assert.match(html,/Немає даних за вибраними фільтрами/);
    assert.doesNotMatch(html,/data-group=|data-total-value=|<strong>0 грн/);
  }
});

test('long labels are escaped and mapped IDs remain exact filter keys',()=>{
  const custom=[make('2026-02','<img src=x>','source-key',100,1,{physicalId:'id-123',physicalLocation:'Mapped site <x>'})];
  const html=render({rows:custom,initialFilters:{location:'id-123'}});
  assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x>/);
  assert.match(html,/value="id-123"[^>]*>Mapped site &lt;x&gt;/);
  assert.match(html,/data-group="id-123"/);
  assert.match(render({rows:custom,initialFilters:{location:'Mapped site <x>'}}),/Немає даних/);
});

test('monthly CSS is scoped with sticky names, horizontal scroll and keyboard focus',()=>{
  const css=readFileSync(new URL('../app/aggregators/glovo/monthly.module.css',import.meta.url),'utf8');
  assert.match(css,/\.scroll\{[^}]*overflow:auto/);
  assert.match(css,/\.table th:first-child\{[^}]*position:sticky;left:0/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.doesNotMatch(css,/(?:^|\})\s*(?:body|html|:root)\s*\{/);
});
