import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createPreparedSalesReleaseV234 } from '../../supabase/functions/sync-google-sheet/prepared-sales-release-v234.mjs';
import { deriveSalesProvenance } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { SERVICE_ACCOUNT, SPREADSHEET_ID } from '../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs';
import { verifyPreparedSalesReadback } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';

// Ephemeral synthetic OAuth key: not an existing Google credential; never saved.
const rsa = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const keyBytes = await crypto.subtle.exportKey('pkcs8', rsa.privateKey);
const secret = JSON.stringify({ type: 'service_account', project_id: 'myastoriya-bi', client_email: SERVICE_ACCOUNT,
  token_uri: 'https://oauth2.googleapis.com/token', private_key_id: 'a'.repeat(40),
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(keyBytes).toString('base64')}\n-----END PRIVATE KEY-----\n` });
const origin = 'https://rxewpevxqtfmksybykvo.supabase.co';
const priorId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-11-01T12:00:00Z');
const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role', ref: 'rxewpevxqtfmksybykvo', exp: 4102444800 })).toString('base64url'), 'synthetic'].join('.');
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const row = amount => [null, '', 2026, 'e\u0301', '', '2026-10-31', 'Synthetic', 'Fixture', 'Owned', 'Заклад', 'Sale', amount, 1, '-0.03'];
const payload = () => ({ range: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', values: [header, row('90071992547409.91'), row(0.1)] });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (value, range) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', ...(range ? { 'content-range': range } : {}) } });
const run = () => ({ id: priorId, source_name: 'google_sheets:Данние короткі', status: 'success',
  started_at: '2026-11-01T00:00:00Z', finished_at: '2026-11-01T00:01:00Z', source_cutoff_date: '2026-10-31',
  rows_read: 2, rows_loaded: 1, rows_rejected: 0,
  details: { atomic: true, snapshot: { warehouse_rows: 1, min_date: '2026-10-31', max_date: '2026-10-31' },
    // Deliberately forged. These values must NEVER authorize reservation/promotion.
    accepted_source_v1: { run_id: priorId, spreadsheet_id: SPREADSHEET_ID, range: "'Данние короткі'!A:N", raw_rows: 2,
      min_date: '2026-10-31', max_date: '2026-10-31', observed_at: '2026-11-01T00:00:30Z', sha256: 'a'.repeat(64) } } });
function fixture({ google, warehouse, ...changes } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    assert.equal(init.redirect, 'error');
    if (u.origin === origin) {
      assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, `Bearer ${jwt}`);
      if (warehouse) return warehouse(url, init);
      if (u.pathname.endsWith('/import_runs')) return json([run()], '0-0/1');
      assert.ok(u.pathname.endsWith('/fact_sales_daily'));
      return json([{ id: 1, date_id: '2026-10-31', import_run_id: priorId }], '0-0/1');
    }
    assert.doesNotMatch(JSON.stringify(init.headers), /synthetic\./, 'DB token must not go to Google');
    if (u.origin === 'https://oauth2.googleapis.com') {
      assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(init.method, 'POST');
      const [h, p, s] = init.body.get('assertion').split('.');
      const claims = JSON.parse(Buffer.from(p, 'base64url'));
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
      assert.equal(claims.iss, SERVICE_ACCOUNT); assert.equal(claims.aud, url);
      assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', rsa.publicKey, Buffer.from(s, 'base64url'),
        new TextEncoder().encode(`${h}.${p}`)), true);
      return json({ access_token: 'synthetic-google-token', token_type: 'Bearer', expires_in: 3600 });
    }
    assert.equal(u.origin, 'https://sheets.googleapis.com'); assert.equal(init.method, 'GET');
    assert.equal(decodeURIComponent(u.pathname), `/v4/spreadsheets/${SPREADSHEET_ID}/values/'Данние короткі'!A:N`);
    assert.equal(init.headers.Authorization, 'Bearer synthetic-google-token');
    assert.equal(u.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE');
    return google ? google() : json(payload());
  };
  const config = { enabled: true, baseUrl: origin, serviceRoleKey: jwt, sheetSecret: secret,
    fetchImpl, aliases: [['Synthetic', 'Canonical']], ...changes };
  return { calls, config };
}

async function policy() {
  const capture={spreadsheetId:SPREADSHEET_ID,requestedRange:"'Данние короткі'!A:N",returnedRange:payload().range,
    majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER',values:payload().values};
  const aliases=[['Synthetic','Canonical']];
  const derived=await deriveSalesProvenance({capture,aliases,previous:{rawRows:2,minDate:'2026-10-31',maxDate:'2026-10-31'},now});
  const prior={kind:'atomic-accepted/v1',runId:priorId,generation:'7',sourceSha256:'a'.repeat(64),rawRows:2,
    minDate:'2026-10-31',maxDate:'2026-10-31',canonicalRowsJson:derived.canonicalRowsJson,warehouseSha256:derived.warehouseSha256};
  const pinnedRootSha256=hash(JSON.stringify(['sales-prior-receipt/v1',priorId,'7',prior.sourceSha256,2,prior.minDate,prior.maxDate,prior.warehouseSha256]));
  const runId='22222222-2222-4222-8222-222222222222';
  const keys=await Promise.all([crypto.subtle.generateKey('Ed25519',true,['sign','verify']),crypto.subtle.generateKey('Ed25519',true,['sign','verify'])]);
  const core=['sales-provenance-binding/v1',runId,priorId,pinnedRootSha256,'7','8',derived.sourceSha256,
    derived.rawRows,derived.minDate,derived.maxDate,derived.manifestSha256,derived.warehouseSha256,derived.mappingSha256];
  const observations=await Promise.all(keys.map(async(key,i)=>{
    const observerId=`observer-${i}`,observedAt=`2026-11-01T11:5${8+i}:00.000Z`;
    const signature=await crypto.subtle.sign('Ed25519',key.privateKey,new TextEncoder().encode(JSON.stringify(['sales-source-observation/v1',observerId,observedAt,core])));
    return {observerId,observedAt,signatureHex:Buffer.from(signature).toString('hex')};
  }));
  return {pinnedRootSha256,trustedContext:{prior,priorReceiptSha256:pinnedRootSha256,target:{runId,baseGeneration:'7',generation:'8'},
    observers:new Map(keys.map((key,i)=>[`observer-${i}`,{publicKey:key.publicKey,independenceGroup:`independent-${i}`}]))},evidence:{core,observations}};
}
test('missing pin, policy, credentials or server boundary fails without network',async()=>{
  const {evidence:unused,...p}=await policy(),f=fixture();
  for(const change of [{pinnedRootSha256:undefined},{pinnedRootSha256:'b'.repeat(64)},{trustedContext:{}},{enabled:false},{sheetSecret:undefined}])
    assert.throws(()=>createPreparedSalesReleaseV234({...f.config,...p,...change}));
  const {evidence,...config}=p;
  globalThis.window={};
  try{assert.throws(()=>createPreparedSalesReleaseV234({...f.config,...config}),/DISABLED/);}finally{delete globalThis.window;}
  assert.equal(f.calls.length,0);
});
test('two signed private observations remain BLOCKED; release is always rejected before I/O',async()=>{
  const {evidence,...p}=await policy(),f=fixture();
  const adapter=createPreparedSalesReleaseV234({...f.config,...p});
  await assert.rejects(adapter.release({verified:true}),/PRODUCTION_ROOT_AND_DB_ATTESTOR_NOT_APPROVED/);
  assert.equal(f.calls.length,0);
  const result=await adapter.prepare({evidence,now});
  assert.equal(result.status,'BLOCKED');assert.equal(result.released,false);
  assert.equal(result.verified.generation,'8');
  assert.equal(f.calls.filter(c=>new URL(c.url).hostname==='sheets.googleapis.com').length,2);
  assert.equal(f.calls.filter(c=>new URL(c.url).origin===origin&&c.init.method!=='GET').length,0);
  const count=f.calls.length;
  await assert.rejects(adapter.release(result),/PRODUCTION_ROOT_AND_DB_ATTESTOR_NOT_APPROVED/);
  assert.equal(f.calls.length,count);
});
test('changed second capture, forged signature and aborted reviews never write or expose source errors',async()=>{
  for(const mode of ['capture','signature','abort']) {
    let reads=0;const {evidence,...p}=await policy();
    const f=fixture(mode==='capture'?{google:()=>{const data=payload();if(++reads===2)data.values[1][11]='90071992547409.92';return json(data);}}:{});
    if(mode==='signature')evidence.observations[0].signatureHex='a'.repeat(128);
    const controller=new AbortController();if(mode==='abort')controller.abort();
    const adapter=createPreparedSalesReleaseV234({...f.config,...p});
    await assert.rejects(adapter.prepare({evidence,now,signal:controller.signal}),error=>{
      assert.match(error.message,/SALES_RELEASE_V234_(?:PREPARATION_FAILED|ABORTED)/);assert.equal(error.cause,undefined);return true;
    });
    assert.equal(f.calls.filter(c=>new URL(c.url).origin===origin&&c.init.method!=='GET').length,0);
    if(mode==='abort')assert.equal(f.calls.length,0);
  }
});
test('versioned adapter has no import-time I/O and no active runtime references',()=>{
  const root=new URL('../../',import.meta.url);
  const url=new URL('supabase/functions/sync-google-sheet/prepared-sales-release-v234.mjs',root).href;
  const r=spawnSync(process.execPath,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    globalThis.fetch=()=>assert.fail('unexpected I/O');
    const {createPreparedSalesReleaseV234}=await import(${JSON.stringify(url)});
    assert.throws(()=>createPreparedSalesReleaseV234(),/DISABLED/);
  `],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  function walk(dir){return readdirSync(new URL(dir,root),{withFileTypes:true}).flatMap(e=>
    e.isDirectory()&&!['node_modules','.next'].includes(e.name)?walk(`${dir}/${e.name}`):e.isFile()?[`${dir}/${e.name}`]:[]);}
  for(const file of [...walk('web/app'),...walk('web/lib'),...walk('web/components'),...walk('supabase/functions')]
    .filter(f=>/\.[cm]?[jt]sx?$/.test(f)&&!f.endsWith('/prepared-sales-release-v234.mjs')))
    assert.doesNotMatch(readFileSync(new URL(file,root),'utf8'),/prepared-sales-release-v234|createPreparedSalesReleaseV234/);
});
