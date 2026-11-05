// PREPARE ONLY. Pure private proposal; NO authority, I/O, keys, DB writer or live fallback.
import { canonicalSalesSourceBytes, deriveSalesProvenance } from './prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from './prepared-sales-recovery.mjs';
import { SPREADSHEET_ID } from './google-sheet-reader.mjs';
const fail = () => { throw new Error('SALES_HANDOFF_SEALED_OR_INVALID'); };
const json = JSON.stringify, encoder = new TextEncoder();
const hash = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof text === 'string' ? encoder.encode(text) : text))].map(x => x.toString(16).padStart(2, '0')).join('');
const timestamp = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const generation = s => typeof s === 'string' && /^(0|[1-9]\d*)$/.test(s) && BigInt(s) < 9223372036854775807n;

/** context and observers are independently pinned private configuration, NEVER HTTP
 * input. Synthetic-only output is not an accepted prior, SQL authority or release
 * token. Real genesis, signer→LOGIN provisioning and attestor-side verification
 * are deliberately unavailable. Never log/persist/serve packets or signatures.
 */
export function createPreparedSalesAttestorHandoff({ context, observers } = {}) {
  if (typeof window !== 'undefined') fail();
  context = structuredClone(context); observers = structuredClone(observers);
  if (!context || Object.keys(context).sort().join(',') !==
      'aliases,baseGeneration,cutoff,expiresAt,generation,kind,previous,priorReceiptSha256,project,range,runId,source' ||
      context.kind !== 'sales-attestor-handoff/v1/OFFLINE_SYNTHETIC_ONLY' ||
      context.project !== 'OFFLINE_SYNTHETIC_ONLY' || context.source !== SPREADSHEET_ID ||
      context.range !== "'Данние короткі'!A:N" || !/^[a-f0-9]{64}$/.test(context.priorReceiptSha256) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(context.runId) ||
      !generation(context.baseGeneration) || !generation(context.generation) ||
      BigInt(context.generation) !== BigInt(context.baseGeneration) + 1n ||
      !timestamp(context.expiresAt) || !Array.isArray(observers) || observers.length !== 2) fail();
  // Fixed field order is part of the signature contract; request key order is irrelevant.
  const pinned = Object.fromEntries(['kind','project','source','range','runId','priorReceiptSha256',
    'baseGeneration','generation','cutoff','expiresAt','previous','aliases'].map(k => [k,context[k]]));
  async function prepare({ capture, observations, now, signal } = {}) {
    try {
      if (signal?.aborted || !(now instanceof Date) || !Number.isFinite(now.getTime())) fail();
      const clock = new Date(now.getTime()), frozenCapture = structuredClone(capture);
      const source = new TextDecoder().decode(canonicalSalesSourceBytes(frozenCapture));
      observations = structuredClone(observations);
      const expiry = Date.parse(pinned.expiresAt);
      if (expiry <= clock.getTime() || expiry - clock.getTime() > 15 * 60 * 1000 ||
          !Array.isArray(observations) || observations.length !== 2) fail();
      const roster = [];
      for (const observer of observers) {
        if (!observer || !/^observer-[ab]$/.test(observer.id) ||
            !['sales_reviewer_a','sales_reviewer_b'].includes(observer.login) ||
            typeof observer.independenceGroup !== 'string' ||
            !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(observer.independenceGroup) || observer.publicKey?.type !== 'public' ||
            observer.publicKey.algorithm.name !== 'Ed25519') fail();
        roster.push({ id:observer.id, login:observer.login, independenceGroup:observer.independenceGroup,
          fingerprint:await hash(await crypto.subtle.exportKey('spki',observer.publicKey)) });
      }
      for (const key of ['id','login','independenceGroup','fingerprint']) if (new Set(roster.map(r => r[key])).size !== 2) fail();
      let last = -Infinity;
      for (let i = 0; i < 2; i++) {
        const o = observations[i];
        if (!o || Object.keys(o).sort().join(',') !== 'id,observedAt,signatureHex' || o.id !== roster[i].id ||
            !timestamp(o.observedAt) || !/^[a-f0-9]{128}$/.test(o.signatureHex)) fail();
        const time = Date.parse(o.observedAt);
        if (time <= last || time > clock.getTime() || clock.getTime()-time > 15*60*1000 || time >= expiry) fail();
        last = time;
        const message = json(['sales-signed-handoff-observation/v1',pinned,roster,source,o.id,o.observedAt]);
        if (!await crypto.subtle.verify('Ed25519',observers[i].publicKey,
          Uint8Array.from(o.signatureHex.match(/../g),x=>parseInt(x,16)),encoder.encode(message))) fail();
      }
      // Derive ALL SQL bytes from the one signed canonical capture. Never re-read.
      const matrix = JSON.parse(source)[8].map(row=>row.map(cell=>cell[0]==='blank'?'':cell[1]));
      const prepared = prepareSalesRecovery(matrix,{previous:pinned.previous,now:clock});
      const derived = await deriveSalesProvenance({capture:frozenCapture,aliases:pinned.aliases,previous:pinned.previous,now:clock});
      if (prepared.batches.length !== 1 || derived.maxDate !== pinned.cutoff) fail();
      const binding = {kind:'sales-release/v234/OFFLINE_SYNTHETIC_ONLY',project:pinned.project,run_id:pinned.runId,
        prior_receipt_sha256:pinned.priorReceiptSha256,base_generation:pinned.baseGeneration,generation:pinned.generation,
        source_sha256:derived.sourceSha256,raw_rows:String(derived.rawRows),min_date:derived.minDate,max_date:derived.maxDate,
        manifest_sha256:derived.manifestSha256,warehouse_sha256:derived.warehouseSha256,mapping_sha256:derived.mappingSha256,
        canonical_rows:JSON.parse(derived.canonicalRowsJson),aliases:[...pinned.aliases].sort((a,b)=>{
          const x=encoder.encode(json(a)),y=encoder.encode(json(b));
          for(let i=0;i<Math.min(x.length,y.length);i++) if(x[i]!==y[i]) return x[i]-y[i];
          return x.length-y.length;
        })};
      const packetJson = json(['sales-attestor-packet/v1',pinned,roster,source,binding,
        prepared.manifestJson,prepared.batches[0].json,await hash(prepared.batches[0].json),
        observations]);
      const packetSha256 = await hash(packetJson);
      if (signal?.aborted) fail();
      return Object.freeze({status:'BLOCKED',code:'OWNER_GENESIS_AND_AUTHENTICATED_ATTESTOR_POLICY_REQUIRED',
        packetJson,packetSha256,bindingJson:json({...binding,handoff:{packetJson,packetSha256,expiresAt:pinned.expiresAt}}),
        manifestJson:prepared.manifestJson,payloadJson:prepared.batches[0].json});
    } catch { fail(); }
  }
  return Object.freeze({prepare});
}
