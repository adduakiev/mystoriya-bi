// Static source inventory only. No network, credentials, runtime files or business writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../web/node_modules/typescript/lib/typescript.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'docs/audit/2026-10-24');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]).sort();
const files=walk('web/app');
const pages=files.filter(p=>p.endsWith('/page.tsx'));
const APIs=files.filter(p=>p.endsWith('/route.ts'));
const cache=new Map();
function parse(file){
  if(cache.has(file))return cache.get(file);
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const imports=[];
  for(const node of source.statements){
    if(!ts.isImportDeclaration(node)||!ts.isStringLiteral(node.moduleSpecifier))continue;
    const spec=node.moduleSpecifier.text;
    const base=spec.startsWith('@/')?`web/${spec.slice(2)}`:spec.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)):null;
    if(!base)continue;
    const target=[base,`${base}.tsx`,`${base}.ts`,`${base}/index.tsx`].find(p=>fs.existsSync(path.join(root,p))&&fs.statSync(path.join(root,p)).isFile());
    if(target)imports.push(target);
  }
  const value={source,imports};cache.set(file,value);return value;
}
function closure(file,result=new Set()){
  if(result.has(file))return result;
  result.add(file);for(const child of parse(file).imports)closure(child,result);return result;
}
const rpcByRoute={
  '/':['bi_overview_payload'],'/aggregators':['bi_aggregators_payload_v2'],'/delivery':['bi_delivery_payload'],
  '/locations':['bi_locations_payload'],'/dynamics':['bi_dynamics_payload'],'/explorer':['bi_explorer_payload'],
  '/insights':['bi_insights_payload'],'/pnl':[], '/login':[],
  '/digital':['bi_digital_payload','bi_digital_history_payload','bi_digital_ads_payload','bi_digital_local_payload'],
  '/digital/ads':['bi_digital_ads_payload','bi_digital_meta_ads_payload'],
  '/digital/app':['bi_digital_app_payload'],'/digital/commerce':['bi_digital_merchant_payload'],
  '/digital/social':['bi_digital_social_payload'],'/digital/local':['bi_digital_local_payload'],
  '/digital/tracking':['bi_digital_history_payload','bi_digital_ads_payload','bi_digital_local_payload'],
  '/digital/funnel':['bi_digital_payload'],
  '/digital/channels':['bi_digital_payload','bi_digital_history_payload'],
  '/digital/audience':['bi_digital_payload','bi_digital_history_payload'],
  '/digital/site':['bi_digital_payload','bi_digital_history_payload'],
  '/digital/seo':['bi_digital_payload','bi_digital_history_payload'],
  '/operating':['bi_digital_payload','bi_digital_history_payload','bi_digital_ads_payload']
};
const sqlDefinitions={};
for(const file of ['supabase/schema.sql',...walk('supabase/migrations').filter(p=>p.endsWith('.sql'))]){
  const text=read(file);
  const regex=/create\s+(?:or\s+replace\s+)?(?:function|view|materialized\s+view)\s+(?:public\.)?(\w+)/gi;
  const matches=[...text.matchAll(regex)];
  matches.forEach((m,i)=>{
    const body=text.slice(m.index,matches[i+1]?.index??text.length);
    // Functions end at their matching dollar quote; do not attribute following grants/tables.
    const delimiter=body.match(/\bas\s+(\$\w*\$)/i);
    const definition=delimiter?body.slice(0,body.indexOf(delimiter[1],delimiter.index+delimiter[0].length)+delimiter[1].length):body.split(';')[0];
    sqlDefinitions[m[1]]={file,line:text.slice(0,m.index).split('\n').length,
      relations:[...new Set([...definition.matchAll(/\b(?:from|join)\s+public\.(\w+)/gi)].map(x=>x[1]))].filter(n=>n!=='bi_runtime_config'),
      calls:[...new Set([...definition.matchAll(/\bpublic\.(bi_\w+)\s*\(/g)].map(x=>x[1]))].filter(n=>n!==m[1])};
  });
}
function lineage(name,seen=new Set()){
  if(seen.has(name))return [];seen.add(name);
  const def=sqlDefinitions[name];if(!def)return [];
  return [...new Set([...def.relations,...def.calls.flatMap(n=>lineage(n,seen)),...def.relations.flatMap(n=>lineage(n,seen))])].sort();
}
const compact=s=>s.replace(/\s+/g,' ').trim();
const routeFor=p=>p.replace(/^web\/app/,'').replace(/\/(page\.tsx|route\.ts)$/,'')||'/';
const items=[],routes=[];
const itemById=new Map();
for(const page of pages){
  const route=routeFor(page);const tree=closure(page);
  let dir=path.posix.dirname(page);
  while(dir.startsWith('web/app')){
    for(const name of ['layout.tsx','loading.tsx']){const file=`${dir}/${name}`;if(fs.existsSync(path.join(root,file)))closure(file,tree);}
    dir=path.posix.dirname(dir);
  }
  const dependencies=[...tree].sort();
  const sources=rpcByRoute[route];if(!sources)throw Error(`Missing reviewed route contract: ${route}`);
  const sales=['/','/delivery','/aggregators','/locations','/dynamics','/explorer','/insights'].includes(route);
  const contract={path:route,page,component_tree:dependencies.filter(p=>p.endsWith('.tsx')),
    rpc:sources,warehouse_relations:[...new Set(sources.flatMap(n=>lineage(n)))].sort(),
    grain:route==='/pnl'?'month × workbook metric × fact/plan/year':sales?'date × location × brand × ownership × channel × order_type':route==='/operating'?'current-run evidence_id; source aggregate periods':'source-specific daily aggregates or snapshots; see source-register and SQL definitions',
    filters:route==='/digital'?'GET from/to/year/month/period; Ads/GBP retain their own RPC windows':sales?'GET year/month/brand/ownership/lfl; route-specific channel/orderType/location/metric/grain/compare (see individual controls)':route==='/pnl'?'GET month/mode/view; eight imported months':route.startsWith('/digital')?'RPC-selected default windows; most submodules have no arbitrary date selector':'see individual controls',
    timezone:sales?'UTC date arithmetic; source business timezone UNKNOWN':route==='/pnl'?'monthly workbook; source timezone UNKNOWN':'RPC date boundaries; account/property timezone UNKNOWN',
    freshness:'UNKNOWN (no authenticated data observation in this audit)',status:route==='/login'?'PREPARED':route==='/pnl'?'PARTIAL':route==='/digital/app'||route==='/digital/commerce'?'WAITING':'PARTIAL',
    evidence_basis:'STATIC_REPOSITORY_ONLY',runtime_parity:'UNKNOWN',
    fallback:sales?'bi_sales_snapshot → Google Sheets CSV → JS analytics; 600s dataset cache, not reconciled':route==='/pnl'?'versioned PNL_SOURCE workbook import; no warehouse RPC':'none asserted; inspect loader errors',
    evidence:[page,...dependencies.filter(p=>p.startsWith('web/lib/data/')||p==='web/lib/operating-data.ts')],
  };
  routes.push(contract);
  for(const component of contract.component_tree){
    const {source}=parse(component);
    function visit(node){
      if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
        const opening=ts.isJsxElement(node)?node.openingElement:node;
        const tag=opening.tagName.getText(source);
        const attrs=Object.fromEntries(opening.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(source),a.initializer?compact(a.initializer.getText(source)):'true']));
        const block=['article','nav','form','details','table','input','select','button','a','Link'].includes(tag)||/^[A-Z]/.test(tag)||/card|table|filter|chart|banner|source|context|status|quality|kpi|list|navigation|loading/.test(attrs.className??'');
        if(block){
          const line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
          const text=[],expressions=[];
          function content(n){if(ts.isJsxText(n)&&compact(n.text))text.push(compact(n.text));if(ts.isJsxExpression(n)&&n.expression)expressions.push(compact(n.expression.getText(source)));if(n!==node&&(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n))){const child=(ts.isJsxElement(n)?n.openingElement:n).tagName.getText(source);if(['article','section','table','nav','form','details'].includes(child)||/^[A-Z]/.test(child))return;}ts.forEachChild(n,content);}
          content(node);
          let template=null;
          for(let parent=node.parent;parent;parent=parent.parent){
            if(ts.isCallExpression(parent)&&ts.isPropertyAccessExpression(parent.expression)&&parent.expression.name.text==='map'){
              template=compact(parent.expression.expression.getText(source));break;
            }
          }
          const id=`${component}:${node.getStart(source)}`;
          if(!itemById.has(id)){
            const item={id,paths:[],component,line,kind:tag,
              displayed_kpi_definition:(text.join(' ')||attrs.label||attrs.title||tag).slice(0,180),
              props:Object.fromEntries(Object.entries(attrs).filter(([key])=>['label','title','name','value','metric','href','action','method','type','aria-label'].includes(key)).map(([key,value])=>[key,value.slice(0,180)])),
              bindings:[...new Set([...expressions,...Object.values(attrs).filter(value=>value.startsWith('{'))])].slice(0,6).map(s=>s.slice(0,180)),
              repeat_template:template?.slice(0,180)??null,
              lineage_scope:'INHERIT_ROUTE_CANDIDATES_NOT_PROVEN_PER_METRIC',
              evidence:`${component}:${line}`};
            items.push(item);itemById.set(id,item);
          }
          const item=itemById.get(id);if(!item.paths.includes(route))item.paths.push(route);

        }
      }
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
}
const api=APIs.map(file=>({path:routeFor(file),file,methods:[...read(file).matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/g)].map(m=>m[1]),
  evidence_basis:'STATIC_ONLY',audit_execution:'NOT_INVOKED',reason:'Do not exercise sync/task/manual-run mutations during read-only audit'}));
const inventory={schema_version:2,audit_date:'2026-10-24',basis:'Repository source; not a production UI/data observation',
  limitations:['Repeated cards/rows are templates; runtime cardinality UNKNOWN.','RPC/table lineage is route-level candidate lineage, not per-field proof.','Conditional/unreachable component branches are retained for review.','Shared blocks occur once with paths; grain/filters/period/timezone/freshness/status/source candidates inherit from each route.','Headings, option entries, strong values and table cells belong to their enclosing visual/control template.','No LIVE status inferred from source code, counts, labels, migrations or successful build.'],routes,api,sql_definitions:sqlDefinitions,items};
const csv=v=>'"'+String(v??'UNKNOWN').replaceAll('"','""')+'"';
const columns=['path','id','component','line','kind','displayed_kpi_definition','repeat_template','route_contract','evidence'];
const artifacts={
  'inventory.json':JSON.stringify(inventory,null,2)+'\n',
  'tab-block-matrix.csv':columns.join(',')+'\n'+items.flatMap(item=>item.paths.map(route=>({...item,path:route,route_contract:`inventory.json#/routes/${routes.findIndex(r=>r.path===route)}`}))).map(item=>columns.map(k=>csv(item[k])).join(',')).join('\n')+'\n'
};
if(process.argv.includes('--check')){
  for(const [name,text] of Object.entries(artifacts))if(!fs.existsSync(path.join(out,name))||fs.readFileSync(path.join(out,name),'utf8')!==text)throw Error(`${name} is stale; run node scripts/bi-audit-inventory.mjs`);
}else{
  fs.mkdirSync(out,{recursive:true});for(const [name,text] of Object.entries(artifacts))fs.writeFileSync(path.join(out,name),text);
}
console.log(`${routes.length} pages, ${api.length} API routes, ${items.length} static visual/control templates; production parity UNKNOWN`);
