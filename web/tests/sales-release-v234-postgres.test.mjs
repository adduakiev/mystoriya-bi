import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { canonicalSalesSourceBytes, verifyPreparedSalesProvenance } from '../../supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs';
import { createPreparedSalesAttestorHandoff } from '../../supabase/functions/sync-google-sheet/prepared-sales-attestor-handoff.mjs';
import { createPreparedSalesAttestorVerifier } from '../../supabase/functions/sync-google-sheet/prepared-sales-attestor-verify.mjs';
import { syntheticCaptureCustodian } from './fixtures/sales-capture-contract.mjs';
import { catalogSQL as rehearsalCatalogSQL } from './fixtures/sales-rehearsal-catalog.mjs';

const catalogSQL = rehearsalCatalogSQL.replaceAll("'sales_rehearsal_private'", "'sales_release_v234_private'");
const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const draft = read('docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql');
const rollback = 'rollback; -- Review-safe default. Only the disposable fixture explicitly commits its copy.';
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const j = value => `${q(JSON.stringify(value))}::jsonb`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewers = ['sales_reviewer_a', 'sales_reviewer_b'];
const caller = 'sales_release_v234_caller';
const db = 'sales_attestor_synthetic';
const schemas = "'public','bi_import_private','extensions','sales_attestor_private','sales_release_v234_private'";
const parseError = (result, state, message) => {
  assert.equal(result.status, 3, `Expected native SQL error, not client/startup failure: ${result.stderr}`);
  const error = result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]*)/);
  assert.ok(error, result.stderr);
  assert.equal(error[1], state, result.stderr);
  if (message) assert.equal(error[2], message);
};
const header = ['', '', '', '', '', 'Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка', 'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
const payload = () => ({ range: "'Данние короткі'!A1:N1000", majorDimension: 'ROWS', values: [header,
  ['', '', '', '', '', '2026-10-25', 'Synthetic alias', 'Historical fixture', 'Owned', 'Заклад', 'Sale', '90071992547409.91', '1', '-0.03'],
  [null, '', 2026, 'e\u0301', '', '2026-10-26', 'Synthetic alias', 'Rebrand fixture', 'Owned', 'Заклад', 'Sale', 0.10, 2, 0.01],
  ['', '', '', '', '', '2026-10-26', 'Synthetic alias', 'Rebrand fixture', 'Owned', 'Заклад', 'Sale', '0.10', '1', '0.00']
] });
const aliases = [['Synthetic alias', 'Synthetic location']];
const previous = { rawRows: 1, minDate: '2026-10-25', maxDate: '2026-10-25' };
const rejectSyntheticPrior = (provenance, receiptSha256, now) => assert.rejects(verifyPreparedSalesProvenance({
  now, trustedContext: { priorReceiptSha256:receiptSha256, prior: {
    kind:'atomic-accepted/v1',runId:'11111111-1111-4111-8111-111111111111',generation:'0',
    sourceSha256:provenance.sourceSha256,warehouseSha256:provenance.warehouseSha256,
    canonicalRowsJson:provenance.canonicalRowsJson,rawRows:provenance.rawRows,
    minDate:provenance.minDate,maxDate:provenance.maxDate
  } }
}),/SALES_PROVENANCE_PRIOR_RECEIPT/);
const captureDefects = (today, abortBody = new AbortController()) => [
  [()=>{},{missingAuth:true},/SALES_CAPTURE_FAILED/],
  [()=>{},{status:401},/SALES_CAPTURE_FAILED/],
  [()=>{},{abortBody,signal:abortBody.signal},/SALES_CAPTURE_ABORTED/],
  [p=>{p.values[2][11]='0.001';},{},/SALES_CAPTURE_FAILED/],
  [p=>{p.values[2][13]='-0.001';},{},/SALES_CAPTURE_FAILED/],
  [p=>{p.values[2][12]='1.5';},{},/SALES_CAPTURE_FAILED/],
  [p=>{p.values[2][11]=null;},{},/SALES_CAPTURE_FAILED/],
  [p=>{p.values[2][6]='Unmapped alias';},{},/UNRESOLVED_ALIAS/],
  [p=>{p.values[2][5]=p.values[3][5]='2026-10-25';},{},/STALE_OR_PARTIAL_CUTOFF/],
  [p=>{p.values.splice(1);},{},/SALES_CAPTURE_FAILED/],
  [p=>{p.values[2][5]=today;},{},/INCOMPLETE_OR_FUTURE_DATE/],
  [()=>{},{rawBody:JSON.stringify(payload()).replace('"90071992547409.91"','0.10000000000000001')},/SALES_CAPTURE_FAILED/]
];

test('hermetic private capture contract uses signed immutable bytes and exact cents before SQL',async()=>{
  const custodian=await syntheticCaptureCustodian(),now=new Date('2026-10-27T12:00:00Z');
  const p=payload(),observation=await custodian.observe(p),signature=await custodian.seal(observation);
  const options={aliases,previous,now};
  const {provenance,prepared}=await custodian.contract(observation,signature,options);
  assert.equal(hash(canonicalSalesSourceBytes(observation.capture)),provenance.sourceSha256);
  assert.equal(hash(prepared.manifestJson),provenance.manifestSha256);
  assert.match(prepared.manifestJson,/"revenue":90071992547410\.11,"checks":4,"markup":-0\.02/);
  assert.equal(provenance.maxDate,'2026-10-26');
  await rejectSyntheticPrior(provenance,hash('OFFLINE SYNTHETIC GENESIS ONLY'),now);
  p.values[1][11]='1.00';
  const changed=await custodian.observe(p);
  await assert.rejects(custodian.contract(changed,signature,options),/CAPTURE_SIGNATURE_MISMATCH/);
  for(const [mutate,captureOptions,error] of captureDefects('2026-10-27')) {
    const p=payload();mutate(p);
    await assert.rejects((async()=>{
      const o=await custodian.observe(p,captureOptions);
      return custodian.contract(o,await custodian.seal(o),options);
    })(),error);
  }
});

// Independent synthetic signer policy is pinned outside the handoff invocation.
async function signedHandoff(now, overrides = {}, mutateSource = () => {}) {
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`)-86400000).toISOString().slice(0,10);
  const custodian = await syntheticCaptureCustodian(), data = payload();
  data.values[2][5]=data.values[3][5]=cutoff;
  mutateSource(data);
  const {capture}=await custodian.observe(data);
  const context=structuredClone({kind:'sales-attestor-handoff/v1/OFFLINE_SYNTHETIC_ONLY',project:'OFFLINE_SYNTHETIC_ONLY',
    source:capture.spreadsheetId,range:capture.requestedRange,runId:crypto.randomUUID(),
    priorReceiptSha256:hash('OFFLINE SYNTHETIC GENESIS ONLY'),baseGeneration:'0',generation:'1',
    cutoff,expiresAt:new Date(now.getTime()+120000).toISOString(),previous,aliases,...overrides});
  const keys=await Promise.all(reviewers.map(()=>crypto.subtle.generateKey('Ed25519',false,['sign','verify'])));
  const observers=keys.map((key,i)=>({id:`observer-${i?'b':'a'}`,login:reviewers[i],
    independenceGroup:`independent-${i?'B':'A'}`,publicKey:key.publicKey}));
  const roster=await Promise.all(observers.map(async o=>({id:o.id,login:o.login,independenceGroup:o.independenceGroup,
    fingerprint:hash(Buffer.from(await crypto.subtle.exportKey('spki',o.publicKey)))})));
  const source=new TextDecoder().decode(canonicalSalesSourceBytes(capture));
  const observations=await Promise.all(observers.map(async(o,i)=>{
    const observedAt=new Date(now.getTime()-2000+i*1000).toISOString();
    const bytes=new TextEncoder().encode(JSON.stringify(['sales-signed-handoff-observation/v1',context,roster,source,o.id,observedAt]));
    return {id:o.id,observedAt,signatureHex:Buffer.from(await crypto.subtle.sign('Ed25519',keys[i].privateKey,bytes)).toString('hex')};
  }));
  return {context,observers,request:{capture,observations,now},
    // Fixture-only signing oracle for independently testing authenticated BAD
    // packets the builder refuses to produce. Never export/log private keys.
    async signPacket(p) {
      for(let i=0;i<2;i++) {
        const o=p[8][i],bytes=new TextEncoder().encode(JSON.stringify([
          'sales-signed-handoff-observation/v1',p[1],p[2],p[3],o.id,o.observedAt]));
        o.signatureHex=Buffer.from(await crypto.subtle.sign('Ed25519',keys[i].privateKey,bytes)).toString('hex');
      }
      const packetJson=JSON.stringify(p);
      return {packetJson,packetSha256:hash(packetJson)};
    }};
}

// Pin from the fixture custodian/configuration, NEVER from the packet's roster,
// binding, verified flag or builder result. No real genesis/provisioning is implied.
async function verifierPolicy(f) {
  return {kind:'sales-attestor-verifier/v1/OFFLINE_SYNTHETIC_ONLY',context:structuredClone(f.context),
    sourceSha256:hash(canonicalSalesSourceBytes(f.request.capture)),
    actors:await Promise.all(f.observers.map(async a=>({...a,
      fingerprint:hash(Buffer.from(await crypto.subtle.exportKey('spki',a.publicKey)))})))};
}
const login = role => ({sessionUser:role,currentUser:role});
const verifyInput = (packet, now) => ({packetBytes:new TextEncoder().encode(packet.packetJson),packetSha256:packet.packetSha256,now});
// Assert before invoking the verifier, without printing private packet contents.
// Each predicate proves the intended defect independently of verifier rejection.
function assertNegativePacket(original, text, reason, malformed) {
  assert.ok(!Buffer.from(text).equals(Buffer.from(original)), `${reason}: no-op negative packet`);
  assert.ok(malformed, `${reason}: intended defect absent`);
}
function verifierDefects(packet) {
  const original=JSON.parse(packet.packetJson),texts=[];
  for(const [reason,mutate,malformed] of [
    ['unsupported version',p=>{p[0]='sales-attestor-packet/v2';},p=>p[0]!=='sales-attestor-packet/v1'],
    ['extra packet field',p=>{p.push({verified:true});},p=>p.length!==9],
    ['wrong project',p=>{p[1].project='production';},p=>p[1].project!=='OFFLINE_SYNTHETIC_ONLY'],
    ['wrong source',p=>{p[1].source+='x';},p=>p[1].source!==original[1].source],
    ['wrong range',p=>{p[1].range+=' ';},p=>p[1].range!==original[1].range],
    ['wrong run',p=>{p[1].runId=crypto.randomUUID();},p=>p[1].runId!==original[1].runId],
    ['wrong prior root',p=>{p[1].priorReceiptSha256='a'.repeat(64);},p=>p[1].priorReceiptSha256!==original[1].priorReceiptSha256],
    ['wrong generation',p=>{p[1].generation=p[1].generation==='2'?'3':'2';},
      p=>p[1].generation!==original[1].generation && BigInt(p[1].generation)!==BigInt(p[1].baseGeneration)+1n],
    ['noncanonical base generation',p=>{p[1].baseGeneration='01';},p=>!/^(0|[1-9]\d*)$/.test(p[1].baseGeneration)],
    ['wrong cutoff',p=>{p[1].cutoff='2026-10-25';},p=>p[1].cutoff!==original[1].cutoff],
    ['wrong alias mapping',p=>{p[1].aliases[0][1]+='x';},p=>p[1].aliases[0][1]!==original[1].aliases[0][1]],
    ['wrong expiry',p=>{p[1].expiresAt='2099-01-01T00:00:00.000Z';},p=>p[1].expiresAt!==original[1].expiresAt],
    ['unauthorized LOGIN',p=>{p[2][0].login='sales_release_v234_caller';},p=>!reviewers.includes(p[2][0].login)],
    ['swapped LOGIN mapping',p=>{[p[2][0].login,p[2][1].login]=[p[2][1].login,p[2][0].login];},
      p=>p[2].every((a,i)=>a.login!==original[2][i].login)],
    ['case-confusable LOGIN',p=>{p[2][0].login='Sales_reviewer_a';},p=>!reviewers.includes(p[2][0].login)],
    ['Unicode-confusable observer',p=>{p[2][0].id='observer-\u0430';},p=>!/^observer-[ab]$/.test(p[2][0].id)],
    ['duplicate fingerprint',p=>{p[2][1].fingerprint=p[2][0].fingerprint;},p=>p[2][1].fingerprint===p[2][0].fingerprint],
    ['duplicate independence group',p=>{p[2][1].independenceGroup=p[2][0].independenceGroup;},
      p=>p[2][1].independenceGroup===p[2][0].independenceGroup],
    ['changed source cents',p=>{p[3]=p[3].replace('90071992547409.91','90071992547409.92');},
      p=>JSON.parse(p[3])[8][1][11][1]==='90071992547409.92'],
    ['normalized source Unicode',p=>{p[3]=p[3].replace('e\u0301','é');},p=>JSON.parse(p[3])[8][2][3][1]==='é'],
    ['wrong source digest',p=>{p[4].source_sha256='a'.repeat(64);},p=>p[4].source_sha256!==hash(p[3])],
    ['wrong mapping digest',p=>{p[4].mapping_sha256='a'.repeat(64);},p=>p[4].mapping_sha256!==original[4].mapping_sha256],
    ['wrong warehouse digest',p=>{p[4].warehouse_sha256='a'.repeat(64);},p=>p[4].warehouse_sha256!==original[4].warehouse_sha256],
    ['wrong canonical cents',p=>{p[4].canonical_rows[0][7]='1';},p=>p[4].canonical_rows[0][7]!==original[4].canonical_rows[0][7]],
    ['changed manifest bytes',p=>{p[5]+=' ';},p=>p[5]!==original[5] && p[5].endsWith(' ')],
    ['changed payload with matching transport digest',p=>{p[6]=p[6].replace('90071992547409.91','90071992547409.92');p[7]=hash(p[6]);},
      p=>p[6]!==original[6] && p[6].includes('90071992547409.92') && p[7]===hash(p[6])],
    ['wrong payload digest',p=>{p[7]='a'.repeat(64);},p=>p[7]!==hash(p[6])],
    ['substituted signature',p=>{p[8][0].signatureHex='a'.repeat(128);},p=>p[8][0].signatureHex!==original[8][0].signatureHex],
    ['duplicate observation',p=>{p[8][1]=p[8][0];},p=>p[8][1].id===p[8][0].id],
    ['reversed observations',p=>{[p[8][0],p[8][1]]=[p[8][1],p[8][0]];},p=>p[8].every((o,i)=>o.id!==p[2][i].id)],
    ['stale observation',p=>{p[8][0].observedAt='2026-01-01T00:00:00.000Z';},
      p=>Date.parse(original[8][0].observedAt)-Date.parse(p[8][0].observedAt)>15*60*1000],
    ['copied signature',p=>{p[8][1].signatureHex=p[8][0].signatureHex;},p=>p[8][1].signatureHex===p[8][0].signatureHex],
    ['untrusted verified flag',p=>{p[8][0].verified=true;},p=>Object.hasOwn(p[8][0],'verified')]
  ]) {
    const p=JSON.parse(packet.packetJson);mutate(p);
    const text=JSON.stringify(p);
    assertNegativePacket(packet.packetJson,text,reason,malformed(p));
    texts.push(text);
  }
  for(const [reason,text,malformed] of [
    ['trailing newline',packet.packetJson+'\n',t=>t.endsWith('\n') && JSON.stringify(JSON.parse(t))!==t],
    ['UTF-8 BOM','\ufeff'+packet.packetJson,t=>t.charCodeAt(0)===0xfeff],
    ['duplicate JSON key',packet.packetJson.replace('"project":','"project":"ignored","project":'),
      t=>t.includes('"project":"ignored","project":')],
    ['alternate key escape',packet.packetJson.replace('"project"','"\\u0070roject"'),
      t=>t.includes('"\\u0070roject"') && JSON.stringify(JSON.parse(t))!==t],
    ['unpaired surrogate',packet.packetJson.replace('observer-a','observer-\\ud800'),
      t=>JSON.parse(t)[2][0].id.endsWith('\ud800')]
  ]) {
    assertNegativePacket(packet.packetJson,text,reason,malformed(text));
    texts.push(text);
  }
  return texts.map(text=>({packetBytes:new TextEncoder().encode(text),packetSha256:hash(text)}));
}

async function authenticatedVerifierDefects(f,packet,policy) {
  const defects=[];
  for(const [reason,mutate,malformed] of [
    ['authenticated stale cutoff',p=>{const s=JSON.parse(p[3]);s[8][2][5][1]=s[8][3][5][1]='2026-10-25';p[3]=JSON.stringify(s);},
      p=>JSON.parse(p[3])[8].slice(1).every(row=>row[5][1]<f.context.cutoff)],
    ['authenticated unmapped alias',p=>{const s=JSON.parse(p[3]);s[8][2][6][1]='Unmapped';p[3]=JSON.stringify(s);},
      p=>!policy.context.aliases.some(([alias])=>alias===JSON.parse(p[3])[8][2][6][1])],
    ['authenticated sub-cent amount',p=>{const s=JSON.parse(p[3]);s[8][2][11]=['string','0.001'];p[3]=JSON.stringify(s);},
      p=>JSON.parse(p[3])[8][2][11][1]==='0.001'],
    ['authenticated stale observation',p=>{p[8][0].observedAt=new Date(f.request.now.getTime()-16*60*1000).toISOString();},
      p=>f.request.now.getTime()-Date.parse(p[8][0].observedAt)>15*60*1000],
    ['authenticated future observation',p=>{p[8][1].observedAt=new Date(f.request.now.getTime()+1).toISOString();},
      p=>Date.parse(p[8][1].observedAt)>f.request.now.getTime()],
    ['authenticated unordered observations',p=>{p[8][1].observedAt=p[8][0].observedAt;},
      p=>Date.parse(p[8][1].observedAt)<=Date.parse(p[8][0].observedAt)]
  ]) {
    const p=JSON.parse(packet.packetJson),pin=structuredClone(policy);mutate(p);
    assertNegativePacket(packet.packetJson,JSON.stringify(p),reason,malformed(p));
    // Deliberately pin each known-invalid synthetic capture to reach derivation,
    // rather than accidentally testing only a digest mismatch or builder failure.
    pin.sourceSha256=hash(p[3]);
    const signed=await f.signPacket(p);
    assertNegativePacket(packet.packetJson,signed.packetJson,reason,malformed(JSON.parse(signed.packetJson)));
    defects.push({policy:pin,packet:signed});
  }
  return defects;
}

test('independent offline verifier pins keys, LOGINs and immutable bytes without trusting the builder',async()=>{
  // Match the native fixture's generation 2, which exposed the original no-op.
  const now=new Date('2026-11-05T12:00:00Z'), f=await signedHandoff(now,{baseGeneration:'1',generation:'2'}),policy=await verifierPolicy(f);
  const packet=await createPreparedSalesAttestorHandoff(f).prepare(f.request);
  const verifier=createPreparedSalesAttestorVerifier({policy,authenticatedLogin:login(reviewers[0])});
  const input=verifyInput(packet,now), result=await verifier.verify(input);
  assert.equal(result.status,'BLOCKED');assert.equal(result.reviewer,reviewers[0]);
  assert.ok(result.bindingJson===packet.bindingJson);assert.equal(result.packetSha256,packet.packetSha256);
  assert.equal(verifier.release,undefined);assert.equal(verifier.review,undefined);
  for(const bad of verifierDefects(packet)) await assert.rejects(verifier.verify({...bad,now}),/VERIFY_SEALED_OR_INVALID/);
  for(const bad of await authenticatedVerifierDefects(f,packet,policy))
    await assert.rejects(createPreparedSalesAttestorVerifier({policy:bad.policy,authenticatedLogin:login(reviewers[0])})
      .verify(verifyInput(bad.packet,now)),/VERIFY_SEALED_OR_INVALID/);
  await assert.rejects(verifier.verify({...input,packetSha256:'a'.repeat(64)}),/VERIFY_SEALED_OR_INVALID/);
  await assert.rejects(verifier.verify({...input,packetBytes:Uint8Array.of(0xc3,0x28)}),/VERIFY_SEALED_OR_INVALID/);
  for(const clock of [new Date(now.getTime()+120000),new Date(now.getTime()-10000),new Date('invalid')])
    await assert.rejects(verifier.verify({...input,now:clock}),/VERIFY_SEALED_OR_INVALID/);
  const old=await signedHandoff(now),replay=await createPreparedSalesAttestorHandoff(old).prepare(old.request);
  await assert.rejects(verifier.verify(verifyInput(replay,now)),/VERIFY_SEALED_OR_INVALID/);
  const mixed=JSON.parse(packet.packetJson);mixed[8][1]=JSON.parse(replay.packetJson)[8][1];
  const mixedText=JSON.stringify(mixed);
  assertNegativePacket(packet.packetJson,mixedText,'observation from another roster',
    mixed[8][1].signatureHex!==JSON.parse(packet.packetJson)[8][1].signatureHex);
  await assert.rejects(verifier.verify({packetBytes:new TextEncoder().encode(mixedText),packetSha256:hash(mixedText),now}),/VERIFY_SEALED_OR_INVALID/);
  for(const receipt of [login(caller),login('Sales_reviewer_a'),login('sales_reviewer_\u0430'),
    {sessionUser:reviewers[0],currentUser:reviewers[1]}])
    assert.throws(()=>createPreparedSalesAttestorVerifier({policy,authenticatedLogin:receipt}),/VERIFY_SEALED_OR_INVALID/);
  for(const field of ['login','id','independenceGroup','fingerprint']) {
    const p=structuredClone(policy);p.actors[1][field]=p.actors[0][field];
    assert.throws(()=>createPreparedSalesAttestorVerifier({policy:p,authenticatedLogin:login(reviewers[0])}),/VERIFY_SEALED_OR_INVALID/);
  }
  const numericGroups=structuredClone(policy);numericGroups.actors.forEach((a,i)=>{a.independenceGroup=i+1;});
  assert.throws(()=>createPreparedSalesAttestorVerifier({policy:numericGroups,authenticatedLogin:login(reviewers[0])}),/VERIFY_SEALED_OR_INVALID/);
  const other=await verifierPolicy(old),wrong=structuredClone(policy);wrong.actors[0].publicKey=other.actors[0].publicKey;
  await assert.rejects(createPreparedSalesAttestorVerifier({policy:wrong,authenticatedLogin:login(reviewers[0])}).verify(input),/VERIFY_SEALED_OR_INVALID/);
  // Key and fingerprint changed together still cannot validate the original signatures.
  wrong.actors[0]=other.actors[0];
  const changed=JSON.parse(packet.packetJson);changed[2][0].fingerprint=other.actors[0].fingerprint;
  const changedText=JSON.stringify(changed);
  assertNegativePacket(packet.packetJson,changedText,'substituted key fingerprint',
    changed[2][0].fingerprint!==JSON.parse(packet.packetJson)[2][0].fingerprint);
  await assert.rejects(createPreparedSalesAttestorVerifier({policy:wrong,authenticatedLogin:login(reviewers[0])})
    .verify({packetBytes:new TextEncoder().encode(changedText),packetSha256:hash(changedText),now}),/VERIFY_SEALED_OR_INVALID/);
  const early=new AbortController();early.abort();
  await assert.rejects(verifier.verify({...input,signal:early.signal}),/VERIFY_SEALED_OR_INVALID/);
  const late=new AbortController(),pending=verifier.verify({...input,signal:late.signal});late.abort();
  await assert.rejects(pending,/VERIFY_SEALED_OR_INVALID/);
  const mutable=verifyInput(packet,now),stable=verifier.verify(mutable);mutable.packetBytes.fill(0);
  policy.context.project='changed';policy.actors[0].login=caller;
  assert.ok((await stable).bindingJson===result.bindingJson);
  globalThis.window={};
  try{assert.throws(()=>createPreparedSalesAttestorVerifier({policy}),/VERIFY_SEALED_OR_INVALID/);}finally{delete globalThis.window;}
});

test('sealed handoff binds one frozen signed capture and rejects substituted policy before any SQL',async()=>{
  const now=new Date('2026-11-05T12:00:00Z'), f=await signedHandoff(now);
  const builder=createPreparedSalesAttestorHandoff(f);
  const packet=await builder.prepare(f.request);
  assert.equal(packet.status,'BLOCKED');assert.equal(hash(packet.packetJson),packet.packetSha256);
  assert.equal(JSON.parse(packet.bindingJson).source_sha256,hash(canonicalSalesSourceBytes(f.request.capture)));
  assert.match(packet.payloadJson,/90071992547409\.91/);
  assert.equal(builder.release,undefined);
  assert.throws(()=>createPreparedSalesAttestorHandoff(),/SEALED_OR_INVALID/);
  assert.throws(()=>createPreparedSalesAttestorHandoff({...f,context:{...f.context,project:'production'}}),/SEALED_OR_INVALID/);
  globalThis.window={};
  try{assert.throws(()=>createPreparedSalesAttestorHandoff(f),/SEALED_OR_INVALID/);}finally{delete globalThis.window;}
  for(const change of [
    r=>{r.capture.values[1][11]='9.99';},
    r=>{r.observations[0].signatureHex='a'.repeat(128);},
    r=>{r.observations[1]=r.observations[0];},
    r=>{r.observations[0].observedAt=new Date(now.getTime()-1000000).toISOString();},
    r=>{r.now=new Date(now.getTime()+120001);},
    r=>{r.capture.requestedRange='other';},
    r=>{r.capture.values[2][5]='2026-11-03';},
    r=>{r.capture.values[2][11]='0.001';}
  ]) {
    const request=structuredClone(f.request);change(request);
    await assert.rejects(builder.prepare(request),/SEALED_OR_INVALID/);
  }
  for(const change of [
    c=>{c.priorReceiptSha256=hash('substitution');},c=>{c.generation='2';},
    c=>{c.source='other';},c=>{c.range='other';},c=>{c.cutoff='2026-11-03';},
    c=>{c.aliases[0][1]='Changed';},c=>{c.expiresAt=new Date(now.getTime()+60000).toISOString();}
  ]) {
    const context=structuredClone(f.context);change(context);
    await assert.rejects(async()=>createPreparedSalesAttestorHandoff({...f,context}).prepare(f.request),/SEALED_OR_INVALID/);
  }
  for(const field of ['login','independenceGroup','publicKey']) {
    const observers=structuredClone(f.observers);observers[1][field]=observers[0][field];
    await assert.rejects(createPreparedSalesAttestorHandoff({...f,observers}).prepare(f.request),/SEALED_OR_INVALID/);
  }
  // Re-sign defective source snapshots: rejection must come from derivation,
  // even when both signatures authenticate those exact immutable source bytes.
  for(const mutate of [
    p=>{p.values[2][5]=p.values[3][5]='2026-10-25';},
    p=>{p.values[2][6]='Unmapped';}
  ]) {
    const invalid=await signedHandoff(now,{},mutate);
    await assert.rejects(createPreparedSalesAttestorHandoff(invalid).prepare(invalid.request),/SEALED_OR_INVALID/);
  }
  const swapped=structuredClone(f.observers);
  [swapped[0].login,swapped[1].login]=[swapped[1].login,swapped[0].login];
  await assert.rejects(createPreparedSalesAttestorHandoff({...f,observers:swapped}).prepare(f.request),/SEALED_OR_INVALID/);
  const substituted=await signedHandoff(now);
  await assert.rejects(createPreparedSalesAttestorHandoff({...f,observers:substituted.observers}).prepare(f.request),/SEALED_OR_INVALID/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(builder.prepare({...f.request,signal:controller.signal}),/SEALED_OR_INVALID/);
  const pending=builder.prepare({...f.request,signal:new AbortController().signal});
  f.request.capture={};f.context.aliases[0][1]='Mutated caller';
  assert.ok(JSON.stringify(await pending)===JSON.stringify(packet),'No mutable re-read after signature awaits');
  const cancel=new AbortController(), cancelled=builder.prepare({...substituted.request,signal:cancel.signal});cancel.abort();
  await assert.rejects(cancelled,/SEALED_OR_INVALID/);
});

// This is a NEW bounded reconstruction, not recovery of the absent failed files.
// No native skip, socket substitute, single-user acceptance, inherited PG URL,
// credential lookup, real HTTP call, or production path is available here.
test('v234 draft remains rollback-default, private and disconnected', () => {
  assert.ok(draft.endsWith(`${rollback}\n`));
  assert.doesNotMatch(draft, /create\s+(?:or replace\s+)?function\s+public\.|\b(?:create|alter)\s+role\b/i);
  assert.doesNotMatch(draft, /perform\s+public\.(?:sync_sales_batch|finalize_sales_snapshot)|delete from public\.fact_sales_daily/i);
  assert.doesNotMatch(draft, /set\s+generated\s+by\s+default/i);
  for (const file of ['supabase/functions/sync-google-sheet/index.ts','web/app/api/data-sync/route.ts',
    '.github/workflows/astra-runner.yml']) assert.doesNotMatch(read(file), /sales.release.v234|prepared-sales-attestor-(?:handoff|verify)|createPreparedSalesAttestor(?:Handoff|Verifier)/i);
  assert.doesNotMatch(read('supabase/functions/sync-google-sheet/prepared-sales-attestor-verify.mjs'),
    /import.*prepared-sales-attestor-handoff|\bfetch\s*\(|process\.env|Deno\.env/);
  assert.throws(() => parseError({status:0,stderr:''},'42501'),assert.AssertionError);
});

test('v234 native prewrite, atomic transaction, independent LOGIN and protected restore', {
  timeout: 300000
}, async t => {
  // A configured PG17 runner must never silently fall back to PG16.
  const bin = process.env.SALES_TEST_PG_BIN || '/usr/lib/postgresql/16/bin';
  assert.ok(fs.existsSync(path.join(bin, 'initdb')), 'Configured native PostgreSQL 16/17 required; no fallback or skip');
  for (const tool of ['initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore', 'pg_config']) assert.ok(fs.existsSync(path.join(bin, tool)), tool);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-release-v234-pg-'));
  const clusters = ['source', 'restored'].map(name => ({ data: path.join(dir, name), socket: path.join(dir, `${name}-socket`), started: false }));
  const [source, restored] = clusters;
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', PGCLIENTENCODING: 'UTF8', PGTZ: 'UTC' };
  // Ephemeral FIXTURE passwords only. Never logged, arguments or artifacts.
  const passwords = Object.fromEntries([...reviewers, caller].map(role => [role, randomBytes(32).toString('hex')]));
  const redact = message => Object.values(passwords).reduce((text, password) => text.replaceAll(password, '[REDACTED]'), String(message ?? ''));
  const invoke = (tool, args, input, role) => spawnSync(path.join(bin, tool), args, {
    env: { ...env, ...(role ? { PGPASSWORD: passwords[role] } : {}) }, input, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024
  });
  const ok = (tool, args, input, role) => {
    const result = invoke(tool, args, input, role);
    assert.equal(result.status, 0, `${tool}: ${result.error?.code ?? result.status}; ${redact(result.stderr).slice(-1800)}`);
    return result.stdout.trim();
  };
  // Trust only the selected binary's native server, with an allowed PG16/17 major.
  const testedPgVersion = /^PostgreSQL ((?:16|17)\.\d+)(?:\s|$)/.exec(ok('pg_config', ['--version']))?.[1];
  assert.ok(testedPgVersion, 'Unsupported native PostgreSQL version; never substitute another major');
  const args = (c, role = 'release_v234_fixture') => ['-X', '-h', c.socket, '-p', '5432', '-U', role, '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-Atq'];
  const sql = (c, input, role) => ok('psql', args(c, role), input, role);
  const denied = (c, input, role, state = '42501', message) => parseError(invoke('psql', args(c, role), input, role), state, message);
  const asyncSQL = (c, input, role) => new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, 'psql'), args(c, role), { env: { ...env, PGPASSWORD: passwords[role] }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.on('error', reject); child.on('close', status => { clearTimeout(timer); resolve({ status, stdout: stdout.trim(), stderr }); });
    child.stdin.end(input);
  });
  const lockedRace = async (c, inputs) => {
    const holder = spawn(path.join(bin, 'psql'), args(c), { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', diagnostics = '';
    let ready, rejectReady;
    const locked = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
    const timer = setTimeout(() => { holder.kill('SIGKILL'); rejectReady(Error('Fixture lock rendezvous timeout')); }, 15000);
    holder.stdout.on('data', bytes => { output += bytes; if (output.includes('LOCKED')) ready(); });
    holder.stderr.on('data', bytes => { diagnostics += bytes; });
    holder.on('error', rejectReady);
    const finished = new Promise(resolve => holder.on('close', status => {
      clearTimeout(timer); if (!output.includes('LOCKED')) rejectReady(Error('Fixture lock unavailable')); resolve(status);
    }));
    let attempts = [];
    try {
      holder.stdin.write("begin; select version from bi_import_private.generation where singleton for update; select 'LOCKED';\n");
      await locked;
      attempts = inputs.map(input => asyncSQL(c, input, caller));
      let waiting = 0;
      for (let tries = 0; tries < 100; tries++) {
        waiting = Number(sql(c, `select count(*) from pg_stat_activity where usename='${caller}' and wait_event_type='Lock';`));
        if (waiting === inputs.length) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(waiting, inputs.length, 'Both independent commit sessions must actually contend on the held generation lock');
      holder.stdin.end('commit;\n');
      assert.equal(await finished, 0, diagnostics);
      return await Promise.all(attempts);
    } finally {
      if (holder.exitCode === null) holder.kill('SIGKILL');
      await finished; await Promise.allSettled(attempts);
    }
  };
  const catalog = c => JSON.parse(sql(c, catalogSQL));
  const rows = c => {
    const names = JSON.parse(sql(c, `select coalesce(json_agg(w order by name),'[]') from (
      select format('%I.%I',n.nspname,cl.relname) name,cl.relkind kind from pg_class cl
        join pg_namespace n on n.oid=cl.relnamespace where n.nspname in (${schemas}) and cl.relkind in ('r','v','m','S')) w;`));
    return names.map(({ name, kind }) => ({ name, kind, ...JSON.parse(sql(c, `select json_build_object('count',count(*)::text,
      'sha256',encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex')) from (
        select encode(sha256(convert_to(to_jsonb(w)::text,'UTF8')),'hex') h from
        ${kind === 'S' ? `(select last_value,is_called from ${name})` : name} w) hashed;`)) }));
  };
  const exact = c => ({ catalog: catalog(c), rows: rows(c) });
  const start = c => {
    fs.mkdirSync(c.socket, { mode: 0o700 });
    ok('initdb', ['-D', c.data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync', '-U', 'release_v234_fixture']);
    const hba = path.join(c.data, 'pg_hba.conf');
    fs.writeFileSync(hba, `local ${db} ${[...reviewers, caller].join(',')} scram-sha-256\n${fs.readFileSync(hba, 'utf8')}`);
    const log = path.join(c.data, 'fixture.log');
    try {
      ok('pg_ctl', ['-D', c.data, '-l', log, '-o', `-h '' -p 5432 -k ${c.socket}`, '-w', 'start']); c.started = true;
    } catch (error) {
      c.started = fs.existsSync(path.join(c.data, 'postmaster.pid'));
      throw Error(`${error.message}; local PostgreSQL: ${fs.readFileSync(log, 'utf8').slice(-1800)}`, { cause: error });
    }
    ok('psql', ['-X', '-h', c.socket, '-U', 'release_v234_fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], `create database ${db};`);
    assert.equal(fs.realpathSync(sql(c, 'show data_directory;')), fs.realpathSync(c.data));
    assert.equal(sql(c, 'show listen_addresses;'), '');
    assert.equal(sql(c, 'show server_version;').split(' ')[0], testedPgVersion, 'server and selected native pg_config version must agree');
    sql(c, `create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role sales_attestor_owner nologin;
      create role sales_restore_operator nologin bypassrls;
      ${[...reviewers, caller].map(role => `create role ${role} login noinherit password ${q(passwords[role])};`).join('\n')}`);
    assert.equal(sql(c, `select count(*) from pg_hba_file_rules where line_number=1 and auth_method='scram-sha-256' and error is null;`), '1');
    for (const role of [...reviewers, caller]) {
      assert.equal(sql(c, 'select session_user||\'|\'||current_user;', role), `${role}|${role}`);
      const bad = spawnSync(path.join(bin, 'psql'), args(c, role), { env: { ...env, PGPASSWORD: 'wrong-synthetic-only' }, encoding: 'utf8', input: 'select 1;', timeout: 10000 });
      assert.equal(bad.status, 2); assert.match(bad.stderr, /password authentication failed/);
      assert.equal(sql(c, `select rolpassword like 'SCRAM-SHA-256$%' from pg_authid where rolname=${q(role)};`), 't');
    }
  };
  const install = (c, file) => sql(c, read(file).replace(rollback, 'commit;'));
  const commit = run => `select sales_release_v234_private.commit('${run}');`;
  const deny = (c, a, message, state = '55000') => {
    const before = exact(c);
    denied(c, commit(a.run), caller, state, message);
    assert.deepEqual(exact(c), before, 'Rejected call changed rows, sequences, RLS, roles or ACLs');
  };
  const both = (c, a) => reviewers.map(role => sql(c,
    `select sales_attestor_private.review('${a.run}',${j(a.binding)});`, role));
  // One immutable fake-OAuth capture crosses both existing prepared boundaries.
  // The custodian signature is TEST ONLY, never a production source authority.
  const custodian = await syntheticCaptureCustodian();
  const clock = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit' }).format(clock);
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`)-86400000).toISOString().slice(0,10);
  const candidate = async (c, change = () => {}, omitAuthority = false, changeSource = () => {}, captureOptions = {}) => {
    const { expiresInSeconds = 3600, ...observationOptions } = captureOptions;
    const source = payload(); source.values[2][5]=cutoff; source.values[3][5]=cutoff; changeSource(source);
    const observation = await custodian.observe(source, observationOptions);
    const signature = await custodian.seal(observation);
    const { provenance, prepared } = await custodian.contract(observation, signature, { aliases, previous, now:clock });
    assert.equal(hash(observation.copyResponseBodyBytes()), observation.responseBodySha256);
    assert.equal(hash(canonicalSalesSourceBytes(observation.capture)), provenance.sourceSha256);
    assert.equal(hash(prepared.manifestJson), provenance.manifestSha256);
    assert.equal(hash(JSON.stringify(['sales-alias-resolution/v1', aliases])), provenance.mappingSha256);
    assert.equal(hash(JSON.stringify(['sales-warehouse-cents/v1', JSON.parse(provenance.canonicalRowsJson)])), provenance.warehouseSha256);
    const gen = sql(c,'select version from bi_import_private.generation;');
    const priorHash = sql(c,`select receipt_sha256 from sales_release_v234_private.history where generation=${gen};`) || hash('OFFLINE SYNTHETIC GENESIS ONLY');
    sql(c,`insert into sales_release_v234_private.roots select ${q(priorHash)},${gen},
      sales_release_v234_private.warehouse_rows(),
      (select coalesce(max(rows_read),1) from public.import_runs where status='success'),
      '2026-10-25',(select coalesce(max(date_id),'2026-10-25'::date) from public.fact_sales_daily),'OFFLINE_SYNTHETIC_ONLY' on conflict do nothing;`);
    const run = crypto.randomUUID();
    const binding = {kind:'sales-release/v234/OFFLINE_SYNTHETIC_ONLY',project:'OFFLINE_SYNTHETIC_ONLY',run_id:run,
      prior_receipt_sha256:priorHash,base_generation:gen,generation:String(BigInt(gen)+1n),source_sha256:provenance.sourceSha256,
      raw_rows:String(provenance.rawRows),min_date:provenance.minDate,max_date:provenance.maxDate,
      manifest_sha256:provenance.manifestSha256,warehouse_sha256:provenance.warehouseSha256,
      mapping_sha256:provenance.mappingSha256,canonical_rows:JSON.parse(provenance.canonicalRowsJson),aliases};
    const a = {run,binding,manifest:prepared.manifestJson,payload:prepared.batches[0].json,observation,signature};
    change(a);
    sql(c,`insert into sales_attestor_private.targets values('${run}',${j(binding)},
      encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'),clock_timestamp()+${Number(expiresInSeconds)}*interval '1 second');`);
    if (!omitAuthority) sql(c,`insert into sales_release_v234_private.authorities values('${run}',${q(priorHash)},${q(a.manifest)},
      ${q(a.payload)}::jsonb,encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'));`);
    return a;
  };
  const guards = c => {
    const before = exact(c);
    for (const role of [...reviewers,caller]) {
      denied(c,'update public.fact_sales_daily set revenue=revenue+0.01;',role);
      denied(c,'set role release_v234_fixture;',role);
      denied(c,'set role sales_restore_operator;',role);
      denied(c,'set session authorization release_v234_fixture;',role);
      for (const table of ['roots','authorities','history','staged','identity_high_water']) {
        denied(c,`insert into sales_release_v234_private.${table} select * from sales_release_v234_private.${table};`,role);
        denied(c,`truncate sales_release_v234_private.${table} cascade;`,role);
      }
    }
    denied(c,`begin;set local role sales_reviewer_a;select sales_attestor_private.review(null,'{}');`,undefined,'42501','SALES_ATTESTOR_INDEPENDENT_LOGIN_REQUIRED');
    for (const fn of ['begin_sales_snapshot_v2(null::jsonb)','stage_sales_batch_v2(null,0,null)',
      'commit_sales_snapshot_v2(null)','commit_sales_snapshot_with_evidence_v1(null,null)']) {
      denied(c,`set role service_role;select public.${fn};`,undefined,'55000',
        'SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE');
    }
    for (const fn of ['sync_sales_batch(null::jsonb,null::uuid)','finalize_sales_snapshot(null::uuid)'])
      denied(c,`set role service_role;select public.${fn};`);
    assert.deepEqual(exact(c),before);
  };
  try {
    start(source);
    sql(source,'create schema extensions;');
    const schema=read('supabase/schema.sql');
    sql(source,schema.split('insert into map_location_source')[0]);
    sql(source,schema.match(/create table if not exists location_lifecycle_registry[\s\S]*?\);/)[0]);
    sql(source,'alter table public.location_lifecycle_registry enable row level security;');
    sql(source,read('supabase/migrations/20261008_warehouse_runtime.sql').split('create or replace function public.bi_sales_snapshot')[0]);
    sql(source,'create materialized view public.bi_sales_flat_mv as select * from public.bi_sales_flat;');
    // Define the existing trigger for ACL checks; never execute it.
    sql(source,read('supabase/migrations/20261012_dashboard_manual_sync.sql').split('create or replace function public.bi_sync_progress')[0]);
    install(source,'docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-attestor-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-role-hardening-NOT-APPLIED.sql');
    install(source,'docs/sql/issue-43-sales-prewrite-gate-NOT-APPLIED.sql');
    sql(source,`insert into public.map_location_source values('Synthetic alias','Synthetic location',true,null);
      insert into sales_attestor_private.reviewers values('sales_reviewer_a','independent-A'),('sales_reviewer_b','independent-B');
      grant usage on schema public to sales_restore_operator;
      grant select on all tables in schema public to sales_restore_operator;
      alter materialized view public.bi_sales_flat_mv owner to sales_restore_operator;
      alter materialized view public.agg_sales_monthly owner to sales_restore_operator;
      alter materialized view public.agg_sales_weekly owner to sales_restore_operator;`);
    await t.test('default rollback and installation do not alter existing protected objects',()=>{
      const before=exact(source);sql(source,draft);assert.deepEqual(exact(source),before);
      install(source,'docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql');
      const after=catalog(source);
      for(const field of ['schemas','relations','sequences','functions','constraints','indexes','triggers','policies']) {
        after[field]=after[field]?.filter(row=>!JSON.stringify(row).includes('sales_release_v234_private'))??null;
        if(after[field]?.length===0)after[field]=null;
      }
      assert.deepEqual(after,before.catalog);
      assert.deepEqual(rows(source).filter(row=>!row.name.startsWith('sales_release_v234_private.')),before.rows);
      guards(source);
    });
    await t.test('OAuth/capture/source defects reject before any SQL authority, staging, dimension or sequence write',async()=>{
      const noop=()=>{};
      for(const [mutate,options,error] of captureDefects(today)) {
        const before=exact(source);
        await assert.rejects(candidate(source,noop,false,mutate,options),error);
        assert.deepEqual(exact(source),before,'Rejected capture reached SQL, including authority registration');
      }
    });
    await t.test('signed capture snapshot cannot be replaced, mutated or mixed with a later observation',async()=>{
      const p=payload();p.values[2][5]=p.values[3][5]=cutoff;
      const observation=await custodian.observe(p),signature=await custodian.seal(observation);
      const before=exact(source);
      assert.throws(()=>{observation.capture.values[1][11]='9.99';},TypeError);
      const bytes=observation.copyResponseBodyBytes();bytes.fill(0);
      p.values[1][11]='9.99'; // Original response owner changes after signing.
      const unchanged=await custodian.contract(observation,signature,{aliases,previous,now:clock});
      assert.equal(unchanged.provenance.sourceSha256,observation.sourceSha256);
      const later=await custodian.observe(p);
      await assert.rejects(custodian.contract(later,signature,{aliases,previous,now:clock}),
        /OFFLINE_SYNTHETIC_CAPTURE_SIGNATURE_MISMATCH/);
      const changed=structuredClone(observation.capture);changed.values[1][11]='9.99';
      await assert.rejects(custodian.contract({...observation,capture:changed},signature,{aliases,previous,now:clock}),
        /OFFLINE_SYNTHETIC_CAPTURE_SIGNATURE_MISMATCH/);
      assert.deepEqual(exact(source),before);
    });
    let accepted;
    await t.test('missing authority and independent reviews stop before import_runs, staging or sequences',async()=>{
      const missing=await candidate(source,()=>{},true);
      deny(source,missing,'SALES_RELEASE_V234_PINNED_AUTHORITY_REQUIRED');
      accepted=await candidate(source);
      deny(source,accepted,'SALES_RELEASE_V234_TWO_LOGINS_REQUIRED');
      sql(source,`select sales_attestor_private.review('${accepted.run}',${j(accepted.binding)});`,reviewers[0]);
      deny(source,accepted,'SALES_RELEASE_V234_TWO_LOGINS_REQUIRED');
      sql(source,`select sales_attestor_private.review('${accepted.run}',${j(accepted.binding)});`,reviewers[1]);
      assert.equal(sql(source,'select count(*) from public.import_runs;'),'0');
      assert.equal(sql(source,'select count(*) from sales_release_v234_private.staged;'),'0');
    });
    await t.test('single transaction preserves exact cents, all three MVs and immutable idempotent receipt',async()=>{
      const seq=rows(source).filter(row=>row.kind==='S');
      const result=JSON.parse(sql(source,commit(accepted.run),caller));
      assert.equal(result.generation,'1');
      for(const field of ['source_sha256','manifest_sha256','warehouse_sha256','mapping_sha256'])
        assert.equal(result[field],accepted.binding[field],`SQL receipt changed captured ${field}`);
      const readback=JSON.parse(sql(source,'select sales_release_v234_private.warehouse_rows();'));
      assert.deepEqual(readback,accepted.binding.canonical_rows);
      assert.equal(hash(JSON.stringify(['sales-warehouse-cents/v1',readback])),accepted.binding.warehouse_sha256);
      assert.equal(sql(source,`select source_cutoff_date from public.import_runs where id='${accepted.run}';`),cutoff);
      assert.deepEqual(JSON.parse(sql(source,`select details->'preview_v234' from public.import_runs where id='${accepted.run}';`)),result);
      assert.equal(sql(source,`select h.receipt_sha256=(i.details->>'receipt_sha256') from
        sales_release_v234_private.history h join public.import_runs i on i.id=h.run_id where h.run_id='${accepted.run}';`),'t');
      const {provenance}=await custodian.contract(accepted.observation,accepted.signature,{aliases,previous,now:clock});
      await rejectSyntheticPrior(provenance,sql(source,`select receipt_sha256 from
        sales_release_v234_private.history where run_id='${accepted.run}';`),clock);
      for(const name of ['fact_sales_daily','bi_sales_flat_mv','agg_sales_monthly','agg_sales_weekly'])
        assert.equal(sql(source,`select sum(revenue)::text||'|'||sum(checks)::text||'|'||sum(markup)::text from public.${name};`),
          '90071992547410.11|4.00|-0.02');
      const before=exact(source);
      assert.deepEqual(JSON.parse(sql(source,commit(accepted.run),caller)),result);
      assert.deepEqual(exact(source),before,'Identical retry mutated warehouse');
      assert.deepEqual(rows(source).filter(row=>row.kind==='S' && row.name!=='public.fact_sales_daily_id_seq'),
        seq.filter(row=>row.name!=='public.fact_sales_daily_id_seq'),'Unrelated sequences must not change');
      assert.equal(sql(source,"select last_value::text||'|'||is_called from public.fact_sales_daily_id_seq;"),'3|false');
      assert.equal(sql(source,'select high_water from sales_release_v234_private.identity_high_water;'),'2');
      for(const table of ['roots','authorities','history']) {
        denied(source,`truncate sales_release_v234_private.${table} cascade;`,undefined,'42501','SALES_ATTESTOR_IMMUTABLE');
        assert.deepEqual(exact(source),before);
      }
      guards(source);
    });
    await t.test('sealed signed packet crosses separately authenticated LOGIN reviews with exact bytes; every rejection preserves protected state',async()=>{
      const gen=sql(source,'select version from bi_import_private.generation;');
      const prior=sql(source,`select receipt_sha256 from sales_release_v234_private.history where generation=${gen};`);
      const f=await signedHandoff(new Date(),{baseGeneration:gen,generation:String(BigInt(gen)+1n),priorReceiptSha256:prior});
      const builder=createPreparedSalesAttestorHandoff(f), packet=await builder.prepare(f.request);
      const unregistered=exact(source);
      const policy=await verifierPolicy(f);
      // Read session identities over real SCRAM connections; never SET ROLE or
      // trust a request's reviewer string. Wrong passwords are checked at startup.
      const authenticated=role=>JSON.parse(sql(source,
        "select json_build_object('sessionUser',session_user,'currentUser',current_user);",role));
      const verifiers=reviewers.map(role=>createPreparedSalesAttestorVerifier({policy,authenticatedLogin:authenticated(role)}));
      assert.throws(()=>createPreparedSalesAttestorVerifier({policy,authenticatedLogin:authenticated(caller)}),/VERIFY_SEALED_OR_INVALID/);
      const input=verifyInput(packet,f.request.now);
      for(const bad of verifierDefects(packet)) {
        for(const verifier of verifiers) await assert.rejects(verifier.verify({...bad,now:f.request.now}),/VERIFY_SEALED_OR_INVALID/);
        assert.deepEqual(exact(source),unregistered,'Independent verifier rejection reached FIRST authority/target/stage/sequence write');
      }
      for(const bad of await authenticatedVerifierDefects(f,packet,policy)) {
        await assert.rejects(createPreparedSalesAttestorVerifier({policy:bad.policy,authenticatedLogin:authenticated(reviewers[0])})
          .verify(verifyInput(bad.packet,f.request.now)),/VERIFY_SEALED_OR_INVALID/);
        assert.deepEqual(exact(source),unregistered,'Cryptographically authenticated bad source reached FIRST SQL write');
      }
      const cancelVerify=new AbortController(),verifying=verifiers[0].verify({...input,signal:cancelVerify.signal});cancelVerify.abort();
      await assert.rejects(verifying,/VERIFY_SEALED_OR_INVALID/);
      await assert.rejects(verifiers[0].verify({...input,now:new Date(f.context.expiresAt)}),/VERIFY_SEALED_OR_INVALID/);
      const verified=await Promise.all(verifiers.map(v=>v.verify(input)));
      for(const v of verified) {
        assert.equal(v.status,'BLOCKED');assert.equal(v.packetSha256,packet.packetSha256);
        assert.ok(v.bindingJson===packet.bindingJson && v.manifestJson===packet.manifestJson && v.payloadJson===packet.payloadJson);
      }
      assert.deepEqual(exact(source),unregistered,'Even valid offline verification must be read-only');
      const binding=JSON.parse(verified[0].bindingJson), run=binding.run_id;
      for(const mutate of [
        r=>{r.capture.values[1][11]='9.99';},r=>{r.observations[0].signatureHex='a'.repeat(128);},
        r=>{r.observations[1]=r.observations[0];},r=>{r.now=new Date(Date.parse(f.context.expiresAt)+1);},
        r=>{r.capture.requestedRange='wrong';},r=>{r.capture.values[2][5]='2026-10-25';},
        r=>{r.capture.values[2][11]='0.001';}
      ]) {
        const request=structuredClone(f.request);mutate(request);
        await assert.rejects(builder.prepare(request),/SEALED_OR_INVALID/);
        assert.deepEqual(exact(source),unregistered,'Signed handoff rejection reached first SQL write');
      }
      for(const mutate of [
        c=>{c.priorReceiptSha256=hash('root substitution');},c=>{c.project='production';},
        c=>{c.aliases[0][1]='Changed';},c=>{c.cutoff='2026-10-25';}
      ]) {
        const context=structuredClone(f.context);mutate(context);
        await assert.rejects(async()=>createPreparedSalesAttestorHandoff({...f,context}).prepare(f.request),/SEALED_OR_INVALID/);
        assert.deepEqual(exact(source),unregistered,'Policy rejection reached authority registration');
      }
      const swapped=structuredClone(f.observers);
      [swapped[0].login,swapped[1].login]=[swapped[1].login,swapped[0].login];
      await assert.rejects(createPreparedSalesAttestorHandoff({...f,observers:swapped}).prepare(f.request),/SEALED_OR_INVALID/);
      const earlyCancel=new AbortController(), cancelled=builder.prepare({...f.request,signal:earlyCancel.signal});earlyCancel.abort();
      await assert.rejects(cancelled,/SEALED_OR_INVALID/);
      assert.deepEqual(exact(source),unregistered,'Wrong signer/LOGIN mapping or cancelled handoff reached first SQL write');
      // Fixture-only trusted registration. This is NOT owner-approved genesis or production provisioning.
      sql(source,`insert into sales_release_v234_private.roots select ${q(prior)},${gen},
        sales_release_v234_private.warehouse_rows(),3,'2026-10-25',${q(cutoff)},'OFFLINE_SYNTHETIC_ONLY';
        insert into sales_attestor_private.targets values(${q(run)},${j(binding)},
          encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'),${q(f.context.expiresAt)});
        insert into sales_release_v234_private.authorities values(${q(run)},${q(prior)},${q(verified[0].manifestJson)},
          ${q(verified[0].payloadJson)}::jsonb,encode(sha256(convert_to((${j(binding)})::text,'UTF8')),'hex'));`);
      // The protected SQL target retains identical canonical bytes and digest. SQL
      // hashes jsonb::text for its *binding* receipt; packet digest hashes raw UTF8.
      assert.equal(sql(source,`select encode(sha256(convert_to(binding->'handoff'->>'packetJson','UTF8')),'hex')
        from sales_attestor_private.targets where run_id=${q(run)};`),packet.packetSha256);
      assert.equal(sql(source,`select (binding->'handoff'->>'packetJson')::jsonb->4 = binding-'handoff'
        from sales_attestor_private.targets where run_id=${q(run)};`),'t');
      const before=exact(source);
      for(const field of ['packetJson','packetSha256','expiresAt']) {
        const changed=structuredClone(binding);changed.handoff[field]+='tampered';
        for(const role of reviewers) denied(source,`select sales_attestor_private.review(${q(run)},${j(changed)});`,role,
          '42501','SALES_ATTESTOR_UNTRUSTED_BINDING');
      }
      for(const field of ['prior_receipt_sha256','generation','source_sha256','mapping_sha256','project','max_date']) {
        const changed=structuredClone(binding);changed[field]='substituted';
        denied(source,`select sales_attestor_private.review(${q(run)},${j(changed)});`,reviewers[0],
          '42501','SALES_ATTESTOR_UNTRUSTED_BINDING');
      }
      denied(source,`select sales_attestor_private.review(${q(run)},${j(binding)});`,caller);
      const cancel=new AbortController(), pending=builder.prepare({...f.request,signal:cancel.signal});cancel.abort();
      await assert.rejects(pending,/SEALED_OR_INVALID/);
      assert.deepEqual(exact(source),before,'Rejected handoff wrote receipt, stage, facts, dimensions, MVs, ACL/RLS or sequence');
      for(const role of reviewers) {
        const receipt=JSON.parse(sql(source,`select sales_attestor_private.review(${q(run)},${j(binding)});`,role));
        const pinned=verified.find(v=>v.reviewer===role);
        assert.equal(receipt.reviewer,pinned.reviewer);
        assert.equal(receipt.independence_group,pinned.independenceGroup);
        assert.equal(hash(receipt.binding.handoff.packetJson),pinned.packetSha256);
        assert.ok(JSON.stringify(receipt.binding)===JSON.stringify(JSON.parse(sql(source,`select binding from sales_attestor_private.targets where run_id=${q(run)};`))),'SQL receipt binding differs');
        assert.equal(receipt.binding_sha256,sql(source,`select binding_sha256 from sales_attestor_private.targets where run_id=${q(run)};`));
        assert.equal(sql(source,`select receipt_sha256=encode(sha256(convert_to(jsonb_build_array(
          'sales-review-receipt/synthetic-v1',run_id,reviewer,independence_group,binding_sha256,observed_at)::text,'UTF8')),'hex')
          from sales_attestor_private.receipts where run_id=${q(run)} and reviewer=${q(role)};`),'t');
        const retry=JSON.parse(sql(source,`select sales_attestor_private.review(${q(run)},${j(binding)});`,role));
        assert.ok(JSON.stringify(receipt)===JSON.stringify(retry),'Authenticated retry changed the receipt');
      }
      const reviewed=exact(source);
      for(const role of reviewers) sql(source,`select sales_attestor_private.review(${q(run)},${j(binding)});`,role);
      assert.deepEqual(exact(source),reviewed,'Exact immutable receipt retry must never duplicate writes');
      const result=sql(source,`begin;${commit(run)}rollback;`,caller);
      assert.match(result,/OFFLINE_SYNTHETIC_ONLY/);assert.deepEqual(exact(source),reviewed);
      const concurrent=await lockedRace(source,[`begin;${commit(run)}rollback;`,`begin;${commit(run)}rollback;`]);
      assert.deepEqual(concurrent.map(r=>r.status),[0,0]);
      assert.equal(concurrent[0].stdout,concurrent[1].stdout);
      assert.deepEqual(exact(source),reviewed,'Concurrent rolled-back handoffs changed protected storage');
      // Explicitly prove the unresolved boundary: SQL accepts no independent signature proof.
      assert.equal(sql(source,`select count(*) from sales_attestor_private.receipts where run_id=${q(run)}
        and binding->'handoff'->>'packetSha256'=${q(packet.packetSha256)};`),'2');
    });
    await t.test('signed prepared manifest differs from DB authority and delayed reviewed replay both reject before first write',async()=>{
      const mismatch=await candidate(source,a=>{a.manifest=a.manifest.replace('90071992547410.11','90071992547410.12');});
      both(source,mismatch);deny(source,mismatch,'SALES_RELEASE_V234_MANIFEST');
      const delayed=await candidate(source,()=>{},false,()=>{},{expiresInSeconds:2});
      both(source,delayed);
      sql(source,`select pg_sleep(greatest(0,extract(epoch from (expires_at-clock_timestamp())))+0.01)
        from sales_attestor_private.targets where run_id='${delayed.run}';`);
      deny(source,delayed,'SALES_RELEASE_V234_EXPIRED');
      const identity=await candidate(source);both(source,identity);
      const before=exact(source);
      denied(source,commit(identity.run),reviewers[0], '42501');
      denied(source,commit(identity.run),undefined,'55000','SALES_RELEASE_V234_DISPOSABLE_LOGIN_REQUIRED');
      assert.deepEqual(exact(source),before);
    });
    await t.test('RLS denies a structurally valid insert and the same valid UPDATE succeeds only under a rolled-back policy',()=>{
      const f=JSON.parse(sql(source,'select to_jsonb(f) from public.fact_sales_daily f order by id limit 1;'));
      const columns=['id','date_id','location_id','brand_id','ownership_id','channel_id','order_type_id','revenue','checks','markup'];
      const values=columns.map(k=>q(String(k==='id'?99999:f[k]))).join(',');
      const before=exact(source);
      denied(source,`begin;grant select,insert on public.fact_sales_daily to ${caller};set local role ${caller};
        insert into public.fact_sales_daily(${columns.join(',')}) overriding system value values(${values});`,undefined,'42501',
        'new row violates row-level security policy for table "fact_sales_daily"');
      assert.deepEqual(exact(source),before);
      const control=invoke('psql',args(source),`begin;
        grant select,update(revenue) on public.fact_sales_daily to ${caller};
        create policy v234_negative_control on public.fact_sales_daily for all to ${caller} using(true) with check(true);
        set local role ${caller};update public.fact_sales_daily set revenue=revenue+0.01 returning revenue;rollback;`);
      assert.equal(control.status,0,control.stderr);assert.ok(control.stdout.trim());
      assert.throws(()=>parseError(control,'42501'),assert.AssertionError);
      assert.deepEqual(exact(source),before);
    });
    await t.test('full manifest, root, project, mapping, precision and identity defects reject before first write',async()=>{
      for(const [change,message] of [
        [a=>{a.binding.project='other';},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.prior_receipt_sha256=hash('forged');},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.source_sha256=null;},'ROOT_BINDING_REQUIRED'],
        [a=>{a.binding.manifest_sha256=hash('bad manifest');},'MANIFEST'],
        [a=>{a.manifest=a.manifest.replace('90071992547410.11','90071992547410.12');},'MANIFEST'],
        [a=>{a.payload=a.payload.replace('90071992547409.91','90071992547409.911');},'PRECISION'],
        [a=>{a.payload=a.payload.replace('90071992547409.91','null');},'METRIC'],
        [a=>{a.binding.mapping_sha256=hash('wrong mapping');},'CANONICAL_MISMATCH'],
        [a=>{a.binding.canonical_rows[0][2]='Lost historical identity';},'CANONICAL_MISMATCH']
      ]) {const a=await candidate(source,change);both(source,a);deny(source,a,`SALES_RELEASE_V234_${message}`);}
      for(const key of Object.keys(accepted.binding)) {
        const a=await candidate(source,a=>{a.binding[key]=null;});both(source,a);
        deny(source,a); // native 55000 and complete no-first-write parity for EVERY field
      }
      const a=await candidate(source);both(source,a);
      const before=exact(source);
      denied(source,`begin;update public.map_location_source set canonical_name='Changed';
        set session authorization ${caller};${commit(a.run)}`,undefined,'55000','SALES_RELEASE_V234_CANONICAL_MISMATCH');
      assert.deepEqual(exact(source),before);
    });
    const sequence = 'public.fact_sales_daily_id_seq';
    const identityGuard = `do $$begin
      if (select a.attidentity::text from pg_attribute a where a.attrelid='public.fact_sales_daily'::regclass
          and a.attname='id') is distinct from 'a'
        or not (select relrowsecurity from pg_class where oid='public.fact_sales_daily'::regclass)
        or exists(select from pg_roles r where r.rolname in ('anon','authenticated','service_role',
          'sales_release_v234_caller','sales_reviewer_a','sales_reviewer_b') and (
          has_table_privilege(r.oid,'public.fact_sales_daily','INSERT,UPDATE,DELETE,TRUNCATE')
          or has_sequence_privilege(r.oid,'${sequence}','USAGE,UPDATE')
          or exists(select from pg_attribute a where a.attrelid='public.fact_sales_daily'::regclass
            and a.attnum>0 and not a.attisdropped and has_column_privilege(r.oid,a.attrelid,a.attnum,'INSERT,UPDATE'))))
        or not exists(select from pg_sequence where seqrelid='${sequence}'::regclass and seqincrement=1
          and seqmin=1 and seqmax=9223372036854775807 and seqcache=1 and not seqcycle) then
        raise exception 'FIXTURE_IDENTITY_RLS_ACL_SEQUENCE_NOT_PINNED';end if;
    end$$;`;
    const withNewIdentity = source => {
      const row=[...source.values[2]];row[7]='New identity witness';row[11]='0.01';source.values.push(row);
    };
    const defaultInsert = `insert into public.dim_order_type(name) values('Default identity witness');
      insert into public.fact_sales_daily(date_id,location_id,brand_id,ownership_id,channel_id,order_type_id,revenue,checks,markup)
        select date_id,location_id,brand_id,ownership_id,channel_id,
          (select id from public.dim_order_type where name='Default identity witness'),0,0,0
        from public.fact_sales_daily order by id limit 1 returning id;`;
    await t.test('negative explicit/default collision controls and transactional high-water/overflow checks preserve storage',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      const before=exact(source);
      // Both controls must really reach the PK, with structurally valid natural keys.
      denied(source,`begin;alter sequence ${sequence} restart with 1;${defaultInsert}`,undefined,'23505',
        'duplicate key value violates unique constraint "fact_sales_daily_pkey"');
      assert.deepEqual(exact(source),before);
      denied(source,`begin;${defaultInsert.replace('fact_sales_daily(date_id','fact_sales_daily(id,date_id')
        .replace('select date_id','overriding system value select 1,date_id')}`,undefined,'23505',
        'duplicate key value violates unique constraint "fact_sales_daily_pkey"');
      assert.deepEqual(exact(source),before);
      // D240: fixture-only UPDATE cannot assign a GENERATED ALWAYS identity.
      // Restore ALWAYS immediately, before assertions/session authorization/promotion.
      const historicalId = id => `alter table public.fact_sales_daily alter column id set generated by default;
        update public.fact_sales_daily set id=${id} where id=1;
        alter table public.fact_sales_daily alter column id set generated always;${identityGuard}
        do $$begin
          if not exists(select from ${sequence} where last_value=3 and not is_called)
            or (select high_water from sales_release_v234_private.identity_high_water)<>2
            or (select count(*) from public.fact_sales_daily where id=${id})<>1 then
            raise exception 'FIXTURE_HISTORICAL_ID_OR_SEQUENCE_NOT_PINNED';end if;end$$;`;
      const high=invoke('psql',args(source),`begin;${historicalId('700')}
        set session authorization ${caller};${commit(a.run)}reset session authorization;
        do $$begin
          if (select max(id) from public.fact_sales_daily)<>701
            or (select high_water from sales_release_v234_private.identity_high_water)<>701
            or not exists(select from ${sequence} where last_value=702 and not is_called) then
            raise exception 'HIGH_WATER_BRANCH_NOT_EXECUTED';end if;end$$;
        rollback;`);
      assert.equal(high.status,0,high.stderr);assert.match(high.stdout,/OFFLINE_SYNTHETIC_ONLY/);
      assert.deepEqual(exact(source),before,'High historical ID fixture leaked after rollback');
      denied(source,`begin;${historicalId('9223372036854775807')}
        set session authorization ${caller};${commit(a.run)}`,undefined,'55000','SALES_RELEASE_V234_IDENTITY_OVERFLOW');
      assert.deepEqual(exact(source),before,'Overflow fixture leaked identity/catalog/RLS/ACL/sequence/rows');
    });
    await t.test('transactional restart permits a future default ID above explicit promotion IDs',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      const before=exact(source);
      const result=sql(source,`begin;${identityGuard}set session authorization ${caller};${commit(a.run)}
        reset session authorization;${defaultInsert}${identityGuard}
        do $$begin if (select max(id) from public.fact_sales_daily)<>4 then
          raise exception 'DEFAULT_ID_NOT_ABOVE_PROMOTION';end if;end$$;rollback;`);
      assert.match(result,/OFFLINE_SYNTHETIC_ONLY/);assert.match(result,/\n4$/);
      assert.deepEqual(exact(source),before,'Successful default writer control must roll back completely');
    });
    await t.test('sequence-ahead and protected historical high-water never move allocation backwards',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      for(const setup of [`alter sequence ${sequence} restart with 800;`,
        'update sales_release_v234_private.identity_high_water set high_water=799;']) {
        const before=exact(source);
        sql(source,`begin;${setup}${identityGuard}set session authorization ${caller};${commit(a.run)}
          reset session authorization;do $$begin
          if (select max(id) from public.fact_sales_daily)<>800
            or (select high_water from sales_release_v234_private.identity_high_water)<>800
            or not exists(select from ${sequence} where last_value=801 and not is_called) then
            raise exception 'SEQUENCE_HIGH_WATER_REGRESSED';end if;end$$;rollback;`);
        assert.deepEqual(exact(source),before);
      }
    });
    await t.test('identity mode, sequence configuration and effective writer grants reject before first write',async()=>{
      const a=await candidate(source,()=>{},false,withNewIdentity);both(source,a);
      for(const setup of [
        'alter table public.fact_sales_daily alter column id set generated by default;',
        `alter sequence ${sequence} increment by 2;`,
        `grant insert on public.fact_sales_daily to ${caller};`,
        `grant update(id) on public.fact_sales_daily to ${caller};`,
        `grant usage on sequence ${sequence} to ${caller};`,
        `grant update(high_water) on sales_release_v234_private.identity_high_water to ${caller};`,
        'alter table public.fact_sales_daily disable row level security;'
      ]) {
        const before=exact(source);
        denied(source,`begin;${setup}set session authorization ${caller};${commit(a.run)}`,undefined,'55000',
          'SALES_RELEASE_V234_IDENTITY_WRITER_CONTRACT');
        assert.deepEqual(exact(source),before);
      }
    });
    await t.test('both ISO-year boundaries reject before any dimension, fact, sequence or receipt write',async()=>{
      for(const date of ['2025-12-29','2021-01-01']) {
        const a=await candidate(source,()=>{},false,source=>{
          const row=[...source.values[2]];row[5]=date;source.values.push(row);
        });both(source,a);
        deny(source,a,'SALES_RELEASE_V234_ISO_YEAR_BOUNDARY');
      }
    });
    await t.test('a successful update-only promotion keeps future sequence allocation and retry immutable',async()=>{
      const a=await candidate(source);both(source,a);
      const before=exact(source);
      sql(source,`begin;${identityGuard}set session authorization ${caller};${commit(a.run)}${commit(a.run)}
        reset session authorization;do $$begin
        if not exists(select from ${sequence} where last_value=3 and not is_called)
          or (select high_water from sales_release_v234_private.identity_high_water)<>2 then
          raise exception 'UPDATE_ONLY_SEQUENCE_REGRESSION';end if;end$$;rollback;`);
      assert.deepEqual(exact(source),before);
    });
    await t.test('injected refresh error, final-step failure and timeout roll back new IDs, dimensions, MVs and history',async()=>{
      const a=await candidate(source,()=>{},false,source=>{
        const row=[...source.values[2]];row[7]='New rollback brand';row[11]='0.01';source.values.push(row);
      });both(source,a);
      for(const [body,state,message] of [
        ["raise exception using errcode='P0001',message='SYNTHETIC_LATE_FAILURE';",'P0001','SYNTHETIC_LATE_FAILURE'],
        ['perform pg_sleep(20);','57014','canceling statement due to statement timeout']
      ]) {
        sql(source,`create function sales_release_v234_private.fail_generation() returns trigger language plpgsql as $$begin
          if not exists(select from sales_release_v234_private.history where run_id='${a.run}') then
            raise exception 'FAILURE_PROBE_TOO_EARLY';end if;
          insert into public.dim_brand(name) values('Rollback witness');${body}return new;end$$;
          revoke all on function sales_release_v234_private.fail_generation() from PUBLIC;
          create trigger fail_generation before update on bi_import_private.generation for each row
          execute function sales_release_v234_private.fail_generation();`);
        const before=exact(source);
        denied(source,`set statement_timeout='1000ms';${commit(a.run)}`,caller,state,message);
        assert.deepEqual(exact(source),before);
        sql(source,'drop trigger fail_generation on bi_import_private.generation;drop function sales_release_v234_private.fail_generation();');
      }
      const before=exact(source);
      // Invalid MV definition in the same rollback-only fixture transaction forces a native refresh failure.
      denied(source,`begin;drop materialized view public.agg_sales_monthly;
        create materialized view public.agg_sales_monthly as select 1/(count(*)-count(*)) broken from public.fact_sales_daily with no data;
        set session authorization ${caller};${commit(a.run)}`,undefined,'22012','division by zero');
      assert.deepEqual(exact(source),before);
      const control=invoke('psql',args(source,caller),`begin;${commit(a.run)}rollback;`,caller);
      assert.equal(control.status,0,control.stderr);assert.throws(()=>parseError(control,'55000'),assert.AssertionError);
      assert.deepEqual(exact(source),before);
    });
    await t.test('competing writers serialize; identical retries are read-only and old receipts become stale',async()=>{
      const a=await candidate(source),b=await candidate(source);both(source,a);both(source,b);
      const results=await lockedRace(source,[commit(a.run),commit(b.run)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[0,3]);
      parseError(results.find(r=>r.status===3),'55000','SALES_RELEASE_V234_STALE_GENERATION');
      const winner=results[0].status===0?a:b;
      const before=exact(source);sql(source,commit(winner.run),caller);assert.deepEqual(exact(source),before);
      deny(source,accepted,'SALES_RELEASE_V234_STALE_GENERATION');
      const same=await candidate(source);both(source,same);
      const repeated=await lockedRace(source,[commit(same.run),commit(same.run)]);
      assert.deepEqual(repeated.map(r=>r.status),[0,0]);
      assert.equal(repeated[0].stdout,repeated[1].stdout);
    });
    await t.test('native restore operator and MV owner preserve RLS, ACLs, exact sequence state and receipts',()=>{
      guards(source);const baseline=exact(source);
      // Reproduce the old restore failure without touching production policy.
      // A transaction removes ONLY this fixture owner's bypass, then native
      // refresh under row_security=off must fail; disconnect rolls it back.
      const regression=invoke('psql',args(source),`begin;
        alter role sales_restore_operator nobypassrls;
        set local row_security=off;refresh materialized view public.agg_sales_monthly;`);
      parseError(regression,'42501');assert.match(regression.stderr,/row-level security/);
      assert.deepEqual(exact(source),baseline,'Restore-identity negative control left a role or MV change');
      assert.equal(sql(source,"select rolsuper||'|'||rolbypassrls||'|'||rolcanlogin from pg_roles where rolname='sales_restore_operator';"),'false|true|false');
      assert.equal(sql(source,"select count(*) from pg_class where oid in ('public.bi_sales_flat_mv'::regclass,'public.agg_sales_monthly'::regclass,'public.agg_sales_weekly'::regclass) and relowner='sales_restore_operator'::regrole;"),'3');
      assert.equal(sql(source,"select relrowsecurity from pg_class where oid='public.fact_sales_daily'::regclass;"),'t');
      const archive=path.join(dir,'synthetic.dump');
      const connection=c=>['-h',c.socket,'-p','5432','-U','release_v234_fixture','-d',db];
      ok('pg_dump',[...connection(source),'--format=custom','--file',archive]);
      ok('pg_ctl',['-D',source.data,'-m','fast','-w','stop']);source.started=false;
      start(restored);
      ok('pg_restore',[...connection(restored),'--exit-on-error','--single-transaction',archive]);
      assert.deepEqual(exact(restored),baseline,'Native restored definitions, ownership, ACL/RLS, rows, receipts and sequences');
      guards(restored);
      const before=exact(restored);
      denied(restored,'truncate sales_attestor_private.receipts cascade;',undefined,'42501','SALES_ATTESTOR_IMMUTABLE');
      assert.deepEqual(exact(restored),before);
      console.log(`v234 OFFLINE SYNTHETIC PG ${testedPgVersion} native restore PASS; no production backup/import/release.`);
    });
  } finally {
    const errors=[];
    for(const c of clusters)if(c.started) {
      try{ok('pg_ctl',['-D',c.data,'-m','immediate','-w','stop']);c.started=false;}catch(error){errors.push(error);}
    }
    if(!errors.length)fs.rmSync(dir,{recursive:true,force:true});
    else throw new AggregateError(errors,'Disposable PostgreSQL cleanup failed');
  }
});
