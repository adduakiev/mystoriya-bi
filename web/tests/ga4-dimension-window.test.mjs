import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensionWindowEvidence} from '../lib/digital-quality.ts';
import {moduleLoader, renderToStaticMarkup} from './support/bi-preview-harness.mjs';

test('GA4 dimension window only establishes an upper bound, never a complete-day claim', () => {
  const partial=dimensionWindowEvidence('2026-09-26','2026-10-25','2026-04-01','2026-10-14');
  assert.deepEqual(partial,{selectedDays:30,maximumPossibleDays:19,status:'PARTIAL',shareComparable:false});
  assert.deepEqual(dimensionWindowEvidence('2026-09-26','2026-10-25','2026-04-01','2026-10-27'),
    {selectedDays:30,maximumPossibleDays:30,status:'UNKNOWN',shareComparable:false});
  assert.deepEqual(dimensionWindowEvidence('2026-09-26','2026-10-25','2026-04-01',undefined),
    {selectedDays:30,maximumPossibleDays:null,status:'UNKNOWN',shareComparable:false});
  assert.deepEqual(dimensionWindowEvidence('2026-09-26','2026-10-25','2026-04-01','2026-04-02'),
    {selectedDays:30,maximumPossibleDays:0,status:'PARTIAL',shareComparable:false});
  assert.deepEqual(dimensionWindowEvidence('2026-02-30','2026-03-31','2026-01-01','2026-03-31'),
    {selectedDays:null,maximumPossibleDays:null,status:'UNKNOWN',shareComparable:false});
});

test('synthetic channels and devices SSR never present partial-period data as complete traffic share',async t=>{
  t.mock.method(globalThis,'fetch',()=>assert.fail('No external fetch permitted in synthetic QA'));
  const data={
    meta:{from:'2026-09-26',to:'2026-10-25',ga4Latest:'2026-10-27'},
    current:{sessions:97151},
    channels:[{channel:'Organic Search',sessions:40179,purchases:120,purchaseRevenue:500000,conversionRate:120/40179}],
    devices:[{device:'mobile',sessions:40000,purchases:200,purchaseRevenue:600000,conversionRate:0.005}]
  };
  const history={quality:{
    channels:{from:'2026-04-01',to:'2026-10-14',coverage:'UNKNOWN'},
    devices:{from:'2026-04-01',to:'2026-10-14',coverage:'UNKNOWN'}
  }};
  const load=moduleLoader({
    '@/components/DashboardSidebar':{DashboardSidebar:()=>null},
    '@/components/DigitalReportShell':{DigitalTabs:()=>null},
    '@/lib/data/digital':{
      loadDigitalData:async()=>data,
      loadDigitalHistory:async()=>history,
      loadSeoSnapshots:async()=>({landings:[],landingPeriod:null})
    },
    '@/lib/data/digital-sources':{loadDigitalLocalData:async()=>({pageSpeed:null})}
  });
  const channels=renderToStaticMarkup(await load('app/digital/channels/page.tsx').default());
  assert.match(channels,/не більше 19 із 30 днів/);
  assert.match(channels,/фактична кількість днів UNKNOWN/);
  assert.match(channels,/Частка трафіку \(UNKNOWN\)/);
  assert.match(channels,/— трафіку/);
  assert.doesNotMatch(channels,/41[.,]36%/);
  assert.match(channels,/Organic Search/);
  const audience=renderToStaticMarkup(await load('app/digital/audience/page.tsx').default());
  assert.match(audience,/не більше 19 із 30 днів/);
  assert.match(audience,/фактична кількість днів UNKNOWN, статус PARTIAL/);
  assert.match(audience,/не повний період GA4/);
  assert.match(audience,/mobile/);
  const site=renderToStaticMarkup(await load('app/digital/site/page.tsx').default());
  assert.match(site,/не більше 19 із 30 днів/);
  assert.match(site,/наявний зріз/);
  assert.match(site,/не зіставні з повним періодом GA4/);
  assert.match(site,/mobile/);
});
