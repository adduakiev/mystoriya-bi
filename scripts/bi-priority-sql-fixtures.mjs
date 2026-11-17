// Disposable synthetic database only. No URL, password, or remote database input.
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const bin=process.env.SALES_TEST_PG_BIN;
if(!bin)throw Error('SALES_TEST_PG_BIN required; no reduced verification');
const dir=mkdtempSync(path.join(tmpdir(),'bi-priority-fixture-'));
const data=path.join(dir,'data'),socket=path.join(dir,'socket'),log=path.join(dir,'postgres.log');
mkdirSync(socket);let started=false;
function run(name,args){const r=spawnSync(path.join(bin,name),args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(`${name}: ${r.error??''} ${r.stdout??''} ${r.stderr??''}`);return r.stdout;}
try{
 run('initdb',['-D',data,'-A','trust','--no-locale','--encoding=UTF8','-U','fixture']);
 run('pg_ctl',['-D',data,'-l',log,'-o',`-h '' -k ${socket}`,'-w','start']);started=true;
 for(const name of ['aggregators-filters-v3-fixture-ISOLATED-ONLY.sql','iso-week-fixture-ISOLATED-ONLY.sql','gbp-valid-observations-fixture-ISOLATED-ONLY.sql']){
  run('psql',['-X','-h',socket,'-U','fixture','-d','postgres','-v','ON_ERROR_STOP=1','-f',`docs/sql/${name}`]);
  console.log(`PASS ${name} (synthetic transaction rolled back)`);
 }
} catch(error){try{console.error(readFileSync(log,'utf8'));}catch{}throw error;}
finally{if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);rmSync(dir,{recursive:true,force:true});}
