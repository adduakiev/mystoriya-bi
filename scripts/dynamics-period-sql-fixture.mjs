// Disposable local PostgreSQL only. No database URL, password or remote target accepted.
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:net';

const bin=process.env.SALES_TEST_PG_BIN;
if(!bin||!path.isAbsolute(bin))throw Error('Absolute SALES_TEST_PG_BIN required; no reduced verification');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=mkdtempSync(path.join(tmpdir(),'bi-dynamics-period-fixture-'));
const data=path.join(dir,'data'),log=path.join(dir,'postgres.log');
let started=false;
function run(name,args){
 const r=spawnSync(path.join(bin,name),args,{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 if(r.status!==0)throw Error(`${name}: ${r.error??''} ${r.stdout??''} ${r.stderr??''}`);
 return r.stdout;
}
try{
 const port=await new Promise((resolve,reject)=>{
   const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{
     const port=server.address().port;server.close(error=>error?reject(error):resolve(port));
   });
 });
 run('initdb',['-D',data,'-A','trust','--no-locale','--encoding=UTF8','-U','fixture']);
 run('pg_ctl',['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${port} -k ''`,'-w','start']);started=true;
 const args=['-X','-h','127.0.0.1','-p',String(port),'-U','fixture','-v','ON_ERROR_STOP=1'];
 run('psql',[...args,'-d','postgres','-c','CREATE DATABASE bi_fixture_dynamics_period_comparison']);
 const database=[...args,'-d','bi_fixture_dynamics_period_comparison'];
 const output=run('psql',[...database,'-At','-f','docs/sql/dynamics-period-comparison-fixture-ISOLATED-ONLY.sql']);
 const sampleLine=output.split('\n').find(line=>line.startsWith('{"fixtureSamples":'));
 if(!sampleLine)throw Error('Missing fixture sample output');
 const {fixtureSamples}=JSON.parse(sampleLine);
 const {moduleLoader}=await import('../web/tests/support/bi-preview-harness.mjs');
 const {validatePeriodComparison}=moduleLoader()('lib/dynamics-comparison.ts');
 if(fixtureSamples.length!==11)throw Error('Expected eleven native SQL integration samples');
 for(const sample of fixtureSamples){
  const {latestYear,cutoff,grain,metric,filters}=sample;
  if(!validatePeriodComparison(sample,{latestYear,cutoff,grain,metric,filters})){
   throw Error(`Native SQL failed actual TypeScript contract: ${grain}/${metric}/${cutoff}/${JSON.stringify(filters)}`);
  }
 }
 console.error('PASS 11 native SQL payloads through actual TypeScript validator');
 const remaining=run('psql',[...database,'-Atc',"SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='bi_dynamics_period_comparison'"]).trim();
 if(remaining!=='0')throw Error('Fixture rollback left a function installed');
 if(process.argv.includes('--json'))console.log(JSON.stringify({status:'PASS',fixtureSamples}));
 else console.log('PASS dynamics-period-comparison PostgreSQL fixture; rollback verified; no external database contacted');
}catch(error){try{console.error(readFileSync(log,'utf8').split('\n').slice(-12).join('\n'));}catch{}throw error;}
finally{
 try{if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);}
 finally{rmSync(dir,{recursive:true,force:true});}
}
