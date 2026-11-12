// OFFLINE PREPARE ONLY. Independent verifier; no builder import, I/O, env, writer or authority.
import { canonicalSalesSourceBytes, deriveSalesProvenance } from './prepared-sales-provenance.mjs';
import { prepareSalesRecovery } from './prepared-sales-recovery.mjs';
import { SPREADSHEET_ID } from './google-sheet-reader.mjs';

const encoder = new TextEncoder(), json = JSON.stringify;
const fail = () => { throw new Error('SALES_ATTESTOR_VERIFY_SEALED_OR_INVALID'); };
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  typeof bytes === 'string' ? encoder.encode(bytes) : bytes))].map(x => x.toString(16).padStart(2,'0')).join('');
const isHash = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const timestamp = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const generation = s => typeof s === 'string' && /^(0|[1-9]\d{0,18})$/.test(s) && BigInt(s) < 9223372036854775807n;
const contextKeys = ['kind','project','source','range','runId','priorReceiptSha256','baseGeneration',
  'generation','cutoff','expiresAt','previous','aliases'];
const exactKeys = (o, keys) => o && !Array.isArray(o) && Object.keys(o).sort().join(',') === [...keys].sort().join(',');
function strings(value) {
  if (typeof value === 'string' && /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) fail();
  if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) { strings(k); strings(v); }
}
function canonicalParse(text) {
  const value = JSON.parse(text);
  strings(value);
  // Reject duplicate keys, alternate escapes, -0, whitespace and lossy number roundtrips.
  if (json(value) !== text) fail();
  return value;
}

/** policy and authenticatedLogin MUST originate outside packet/request metadata.
 * Only synthetic provisioning is supported. LOGIN is a trusted connection read of
 * session_user/current_user BEFORE any SET ROLE/definer call, never a JWT claim.
 * verify().now must be the verifier's trusted clock, never client/packet time.
 * This pure model cannot authenticate a connection or establish real genesis.
 * Never log, persist, serve or artifact packet/signature/key material.
 */
export function createPreparedSalesAttestorVerifier({ policy, authenticatedLogin } = {}) {
  if (typeof window !== 'undefined') fail();
  policy = structuredClone(policy); authenticatedLogin = structuredClone(authenticatedLogin);
  const { context:c, actors, sourceSha256 } = policy ?? {};
  if (!exactKeys(policy,['kind','context','actors','sourceSha256']) ||
      policy.kind !== 'sales-attestor-verifier/v1/OFFLINE_SYNTHETIC_ONLY' ||
      !exactKeys(c,contextKeys) || c.kind !== 'sales-attestor-handoff/v1/OFFLINE_SYNTHETIC_ONLY' ||
      c.project !== 'OFFLINE_SYNTHETIC_ONLY' || c.source !== SPREADSHEET_ID || c.range !== "'Данние короткі'!A:N" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(c.runId) ||
      !isHash(c.priorReceiptSha256) || !isHash(sourceSha256) ||
      !generation(c.baseGeneration) || !generation(c.generation) || BigInt(c.generation) !== BigInt(c.baseGeneration)+1n ||
      !timestamp(c.expiresAt) || !/^\d{4}-\d{2}-\d{2}$/.test(c.cutoff) ||
      !Array.isArray(actors) || actors.length !== 2 ||
      !exactKeys(authenticatedLogin,['sessionUser','currentUser']) ||
      authenticatedLogin.sessionUser !== authenticatedLogin.currentUser) fail();
  strings(c);
  const context = Object.fromEntries(contextKeys.map(k=>[k,c[k]]));
  const roster = actors.map(a=>{
    if (!exactKeys(a,['id','login','independenceGroup','fingerprint','publicKey']) ||
        !/^observer-[ab]$/.test(a.id) || !['sales_reviewer_a','sales_reviewer_b'].includes(a.login) ||
        typeof a.independenceGroup !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(a.independenceGroup) || !isHash(a.fingerprint) ||
        a.publicKey?.type !== 'public' || a.publicKey.algorithm?.name !== 'Ed25519') fail();
    return {id:a.id,login:a.login,independenceGroup:a.independenceGroup,fingerprint:a.fingerprint};
  });
  for (const k of ['id','login','independenceGroup','fingerprint']) if (new Set(roster.map(a=>a[k])).size !== 2) fail();
  const actor = roster.find(a=>a.login === authenticatedLogin.sessionUser);
  if (!actor) fail();

  async function verify({ packetBytes, packetSha256, now, signal } = {}) {
    try {
      if (signal?.aborted || !(now instanceof Date) || !Number.isFinite(now.getTime()) ||
          !(packetBytes instanceof Uint8Array) || packetBytes.length > 128*1024*1024 || !isHash(packetSha256)) fail();
      // Copy before the first await; all derivations use ONLY these frozen input bytes.
      const bytes = new Uint8Array(packetBytes), clock = new Date(now.getTime());
      const text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
      const packet = canonicalParse(text);
      if (await hash(bytes) !== packetSha256 || !Array.isArray(packet) || packet.length !== 9 ||
          packet[0] !== 'sales-attestor-packet/v1' || json(packet[1]) !== json(context) ||
          json(packet[2]) !== json(roster) || typeof packet[3] !== 'string') fail();
      const expiry = Date.parse(context.expiresAt);
      if (expiry <= clock.getTime() || expiry-clock.getTime() > 15*60*1000) fail();
      const source = packet[3], typed = canonicalParse(source);
      if (!Array.isArray(typed) || typed.length !== 9 || typed[0] !== 'sales-source-bytes/v1' || !Array.isArray(typed[8])) fail();
      const values = typed[8].map(row=>row.map(cell=>{
        if (json(cell) === '["blank"]') return null;
        if (!Array.isArray(cell) || cell.length !== 2 || typeof cell[1] !== 'string') fail();
        if (cell[0] === 'string') return cell[1];
        if (cell[0] === 'number' && String(Number(cell[1])) === cell[1]) return Number(cell[1]);
        fail();
      }));
      const capture = {spreadsheetId:typed[1],requestedRange:typed[2],returnedRange:typed[3],
        majorDimension:typed[4],valueRenderOption:typed[5],dateTimeRenderOption:typed[6],values};
      if (new TextDecoder().decode(canonicalSalesSourceBytes(capture)) !== source || await hash(source) !== sourceSha256) fail();
      const observations = packet[8];
      if (!Array.isArray(observations) || observations.length !== 2) fail();
      let last = -Infinity;
      for (let i=0;i<2;i++) {
        const o=observations[i], a=actors[i];
        if (await hash(await crypto.subtle.exportKey('spki',a.publicKey)) !== a.fingerprint ||
            !exactKeys(o,['id','observedAt','signatureHex']) ||
            json(o) !== json({id:o.id,observedAt:o.observedAt,signatureHex:o.signatureHex}) ||
            o.id !== a.id || !timestamp(o.observedAt) || !/^[a-f0-9]{128}$/.test(o.signatureHex)) fail();
        const time=Date.parse(o.observedAt);
        if (time<=last || time>clock.getTime() || clock.getTime()-time>15*60*1000 || time>=expiry) fail();
        last=time;
        const message=encoder.encode(json(['sales-signed-handoff-observation/v1',context,roster,source,o.id,o.observedAt]));
        if (!await crypto.subtle.verify('Ed25519',a.publicKey,
          Uint8Array.from(o.signatureHex.match(/../g),x=>parseInt(x,16)),message)) fail();
      }
      const matrix=typed[8].map(row=>row.map(cell=>cell[0]==='blank'?'':cell[1]));
      const prepared=prepareSalesRecovery(matrix,{previous:context.previous,now:clock});
      const d=await deriveSalesProvenance({capture,aliases:context.aliases,previous:context.previous,now:clock});
      if (prepared.batches.length !== 1 || d.maxDate !== context.cutoff ||
          packet[5] !== prepared.manifestJson || packet[6] !== prepared.batches[0].json ||
          packet[7] !== await hash(packet[6])) fail();
      const sortedAliases=[...context.aliases].sort((a,b)=>{
        const x=encoder.encode(json(a)),y=encoder.encode(json(b));
        for(let i=0;i<Math.min(x.length,y.length);i++) if(x[i]!==y[i]) return x[i]-y[i];
        return x.length-y.length;
      });
      const binding={kind:'sales-release/v234/OFFLINE_SYNTHETIC_ONLY',project:context.project,run_id:context.runId,
        prior_receipt_sha256:context.priorReceiptSha256,base_generation:context.baseGeneration,generation:context.generation,
        source_sha256:d.sourceSha256,raw_rows:String(d.rawRows),min_date:d.minDate,max_date:d.maxDate,
        manifest_sha256:d.manifestSha256,warehouse_sha256:d.warehouseSha256,mapping_sha256:d.mappingSha256,
        canonical_rows:JSON.parse(d.canonicalRowsJson),aliases:sortedAliases};
      if (json(packet[4]) !== json(binding) || signal?.aborted) fail();
      return Object.freeze({status:'BLOCKED',code:'OWNER_GENESIS_AND_AUTHENTICATED_ATTESTOR_POLICY_REQUIRED',
        reviewer:actor.login,independenceGroup:actor.independenceGroup,packetSha256,
        bindingJson:json({...binding,handoff:{packetJson:text,packetSha256,expiresAt:context.expiresAt}}),
        manifestJson:packet[5],payloadJson:packet[6]});
    } catch { fail(); }
  }
  return Object.freeze({verify});
}
