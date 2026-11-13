// Offline actual SSR components + production CSS. Synthetic rows only; no authenticated/live parity claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {moduleLoader,React,renderToStaticMarkup} from '../web/tests/support/bi-preview-harness.mjs';
const css=fs.readFileSync(new URL('../web/app/aggregators/glovo/report.module.css',import.meta.url),'utf8');
const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z]\w*)/g)].map(m=>[m[1],m[1]]));
const load=moduleLoader({'./report.module.css':{default:classes}});
const {GLOVO_HEADERS,normalizeGlovoSheet,buildGlovoReport}=load('lib/data/glovo-contract.ts');
const {applyGlovoMappings,GLOVO_SITE_HEADERS,GLOVO_BRAND_HEADERS}=load('lib/data/glovo-mapping.ts');
const contract=applyGlovoMappings(normalizeGlovoSheet([GLOVO_HEADERS,...['2026-09','2026-10'].map(month=>
  [month,'Synthetic long virtual storefront name for responsive coverage','Synthetic source site','Synthetic name','Synthetic address',25533,25887779.33,7,1])]),
  [GLOVO_SITE_HEADERS,['Synthetic source site','Synthetic address','Synthetic physical location','Погоджено','']],
  [GLOVO_BRAND_HEADERS,[7,'Synthetic long virtual storefront name for responsive coverage','Synthetic source site','Віртуальний','Власні','Погоджено','']]);
const report=buildGlovoReport(contract,['2026-09','2026-10'],['2026-09','2026-10']);
const Presenter=load('app/aggregators/glovo/GlovoReportPresenter.tsx').GlovoReportPresenter;
const markup=renderToStaticMarkup(React.createElement(Presenter,{report,filters:{month:'all',brand:'',group:'',location:'',mapping:'',sort:'source'}}));
const globals=fs.readFileSync(new URL('../web/app/globals.css',import.meta.url),'utf8');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'glovo-v2-browser-'));
const results=[];
for(const width of [360,768,1440]) {
  const file=path.join(dir,`${width}.html`);
  fs.writeFileSync(file,`<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${globals}\n${css}</style></head><body><main class="shell"><aside class="sidebar">Synthetic navigation</aside><section class="workspace report">${markup}</section></main><script>
    const scrollers=[...document.querySelectorAll('[role="region"]')];
    const kpis=[...document.querySelectorAll('strong')];
    const metrics={viewport:innerWidth,document:document.documentElement.scrollWidth,scrollers:scrollers.map(el=>{el.scrollLeft=el.scrollWidth;return {client:el.clientWidth,scroll:el.scrollWidth,moved:el.scrollLeft>0,focusable:el.tabIndex===0}}),kpis:kpis.map(el=>({client:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,text:el.textContent}))};
    const output=document.createElement('script');output.id='glovo-metrics';output.type='application/json';output.textContent=JSON.stringify(metrics);document.body.append(output);
  </script></body></html>`);
  const run=spawnSync('chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-breakpad','--disable-crash-reporter','--no-first-run',`--user-data-dir=${dir}/${width}-profile`,`--window-size=${width},900`,'--force-device-scale-factor=1','--dump-dom',pathToFileURL(file).href],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  const match=run.stdout?.match(/<script id="glovo-metrics" type="application\/json">(.*?)<\/script>/s);
  if(run.status!==0 || !match) {
    fs.writeFileSync(path.join(dir,`${width}.stderr`),run.stderr??'');
    console.log(JSON.stringify({status:'BLOCKED_BROWSER_STARTUP',width,exit:run.status,error:run.error?.code??null,artifacts:dir}));
    process.exit(1);
  }
  const metrics=JSON.parse(match[1]);
  assert.equal(metrics.viewport,width);assert.ok(metrics.document<=width,`${width}: document overflow`);
  assert.equal(metrics.scrollers.length,5);assert.ok(metrics.scrollers.every(s=>s.focusable && (s.scroll<=s.client || s.moved)));
  assert.ok(metrics.kpis.every(k=>k.scroll<=k.client && k.height>0),`${width}: KPI clipping`);
  results.push({width,...metrics});
}
console.log(JSON.stringify({status:'PASS',scope:'OFFLINE_SYNTHETIC_ACTUAL_SSR_AND_CSS',results},null,2));
