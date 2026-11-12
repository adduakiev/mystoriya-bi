// PREPARED ONLY: review model, NOT an importer/attestor or a production trust root.
// No I/O, secrets, signing, storage, environment lookup or runtime wiring.
import { SPREADSHEET_ID } from './google-sheet-reader.mjs';
import { prepareSalesRecovery } from './prepared-sales-recovery.mjs';
import { parseSourceDate } from './source-safety.mjs';

const RANGE = "'Данние короткі'!A:N";
const encoder = new TextEncoder();
const fail = code => { throw new Error(`SALES_PROVENANCE_${code}`); };
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const digest = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const json = value => JSON.stringify(value);
const hash = value => digest(encoder.encode(json(value)));
const isHash = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const uuid = s => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const generation = s => typeof s === 'string' && /^(?:0|[1-9]\d{0,18})$/.test(s) && BigInt(s) < 9223372036854775807n;
const norm = s => s.normalize('NFC').replace(/\s+/g, ' ').trim();
function string(s) {
  if (typeof s !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)) fail('STRING');
  return s;
}
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) fail('SHAPE');
}
function timestamp(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) ||
      !Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s) fail('TIMESTAMP');
  return Date.parse(s);
}

/** Exact typed Values API projection, before the existing reader's String coercion.
 * Raw HTTP response must also be privately retained; this is not a response parser.
 */
export function canonicalSalesSourceBytes(capture) {
  keys(capture, ['spreadsheetId', 'requestedRange', 'returnedRange', 'majorDimension', 'valueRenderOption', 'dateTimeRenderOption', 'values']);
  if (capture.spreadsheetId !== SPREADSHEET_ID || capture.requestedRange !== RANGE ||
      capture.majorDimension !== 'ROWS' || capture.valueRenderOption !== 'UNFORMATTED_VALUE' ||
      capture.dateTimeRenderOption !== 'SERIAL_NUMBER' || !Array.isArray(capture.values) ||
      capture.values.length < 2 || capture.values.length > 200001) fail('SOURCE_CONTRACT');
  const end = /^'Данние короткі'!A1:N([1-9]\d*)$/.exec(capture.returnedRange);
  if (!end || !Number.isSafeInteger(Number(end[1])) || Number(end[1]) < capture.values.length) fail('SOURCE_RANGE');
  const rows = Array.from(capture.values, row => {
    if (!Array.isArray(row) || row.length > 14) fail('SOURCE_WIDTH');
    return Array.from({ length: 14 }, (_, i) => {
      const v = row[i];
      if (v === undefined || v === null) return ['blank'];
      if (typeof v === 'string') return ['string', string(v)];
      if (typeof v !== 'number' || !Number.isFinite(v) || Object.is(v, -0) ||
          ((i === 11 || i === 13) && Math.abs(v) >= 2 ** 45)) fail('SOURCE_TYPE_OR_PRECISION');
      return ['number', String(v)];
    });
  });
  // Fixed tuple order; no BOM/newline, no Unicode/whitespace normalization of cells.
  return encoder.encode(json(['sales-source-bytes/v1', SPREADSHEET_ID, RANGE, capture.returnedRange,
    'ROWS', 'UNFORMATTED_VALUE', 'SERIAL_NUMBER', 14, rows]));
}

const sorted = rows => [...rows].sort((a, b) => {
  const x = encoder.encode(json(a)), y = encoder.encode(json(b));
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
});
function canonicalWarehouseRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 200000) fail('WAREHOUSE_ROWS');
  const seen = new Set();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 10 || row.some(x => typeof x !== 'string')) fail('WAREHOUSE_ROW');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0]) || parseSourceDate(row[0]) !== row[0]) fail('WAREHOUSE_DATE');
    for (const s of row.slice(1, 7)) if (!string(s) || norm(s) !== s || /[\u0000-\u001f\u007f]/.test(s)) fail('WAREHOUSE_IDENTITY');
    for (const s of row.slice(7)) if (!/^(?:0|-?[1-9]\d*)$/.test(s)) fail('WAREHOUSE_DECIMAL');
    if (BigInt(row[8]) < 0n) fail('WAREHOUSE_CHECKS');
    const key = json(row.slice(0, 7));
    if (seen.has(key)) fail('WAREHOUSE_DUPLICATE');
    seen.add(key);
  }
  return sorted(rows);
}
const warehouseHash = rows => hash(['sales-warehouse-cents/v1', canonicalWarehouseRows(rows)]);
function cents(s) {
  const clean = norm(s).replace(/ /g, '').replace(',', '.');
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(clean);
  if (!match || /[1-9]/.test((match[3] ?? '').slice(2))) fail('DECIMAL');
  return (BigInt(match[2]) * 100n + BigInt(((match[3] ?? '') + '00').slice(0, 2))) * (match[1] === '-' ? -1n : 1n);
}

/** Recompute source, manifest and canonical identity+amount digests; NO authenticity claim.
 * aliases is a complete, independently retained mapping resolution for every source
 * location (including explicit identity mappings for unmatched SQL coalesce cases).
 */
export async function deriveSalesProvenance({ capture, aliases, previous, now }) {
  const sourceBytes = canonicalSalesSourceBytes(capture);
  aliases = structuredClone(aliases); previous = structuredClone(previous);
  if (now instanceof Date) now = new Date(now.getTime());
  // Derive from the exact captured bytes, not mutable caller cells after an await.
  // Every numeric tag contains a string, so no monetary JSON number is parsed.
  const matrix = JSON.parse(new TextDecoder().decode(sourceBytes))[8].map(row =>
    row.map(cell => cell[0] === 'blank' ? '' : cell[1]));
  const sourceSha256 = await digest(sourceBytes);
  const prepared = prepareSalesRecovery(matrix, { previous, now });
  if (!Array.isArray(aliases) || !aliases.length) fail('MAPPING');
  const mapping = new Map();
  for (const pair of aliases) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(s => !string(s) || norm(s) !== s || /[\u0000-\u001f\u007f]/.test(s)) || mapping.has(pair[0])) fail('MAPPING');
    mapping.set(...pair);
  }
  const groups = new Map(), used = new Set();
  for (const row of matrix.slice(1)) {
    const dimensions = row.slice(6, 11).map(norm), raw = dimensions[0];
    if (!mapping.has(raw)) fail('UNRESOLVED_ALIAS');
    used.add(raw);
    const rawKey = json([parseSourceDate(norm(row[5])), ...dimensions]);
    const key = [parseSourceDate(norm(row[5])), mapping.get(raw), dimensions[1], dimensions[2], dimensions[3], dimensions[3], dimensions[4]];
    const r = cents(row[11]), c = cents(row[12]) / 100n, m = cents(row[13]);
    const old = groups.get(rawKey);
    if (old) { old[7] += r; old[8] += c; old[9] += m; }
    else groups.set(rawKey, [...key, r, c, m]);
  }
  if (used.size !== mapping.size) fail('EXTRANEOUS_ALIAS');
  const rows = canonicalWarehouseRows([...groups.values()].map(row => row.map(String)));
  const dates = rows.map(row => row[0]).sort();
  return Object.freeze({ sourceSha256, rawRows: matrix.length - 1, minDate: dates[0], maxDate: dates.at(-1),
    manifestJson: prepared.manifestJson, manifestSha256: await digest(encoder.encode(prepared.manifestJson)),
    warehouseSha256: await warehouseHash(rows), canonicalRowsJson: json(rows),
    mappingSha256: await hash(['sales-alias-resolution/v1', sorted(aliases)]) });
}

// Tokens prove ONLY this in-memory review verification, never permission to commit.
const verified = new WeakSet();
/** trustedContext is pinned server/reviewer configuration, NEVER request metadata.
 * Its prior receipt must already have a verified chain to an authorized trust root.
 * This module deliberately cannot create that root or attest a legacy first run.
 */
export async function verifyPreparedSalesProvenance({ evidence, first, second, aliases, trustedContext, now }) {
  if (typeof window !== 'undefined') fail('SERVER_ONLY');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('CLOCK');
  now = new Date(now.getTime());
  // Snapshot the whole review before asynchronous hashing/signature verification.
  evidence = structuredClone(evidence);
  first = structuredClone(first); second = structuredClone(second);
  aliases = structuredClone(aliases); trustedContext = structuredClone(trustedContext);
  const { prior, target, observers, priorReceiptSha256 } = trustedContext ?? {};
  if (!prior || prior.kind !== 'atomic-accepted/v1' || !isHash(priorReceiptSha256) ||
      !uuid(prior.runId) || !generation(prior.generation) || !isHash(prior.sourceSha256) || !isHash(prior.warehouseSha256)) fail('CLOSED_PRIOR');
  const priorRows = canonicalWarehouseRows(JSON.parse(prior.canonicalRowsJson));
  if (!Number.isSafeInteger(prior.rawRows) || prior.rawRows < priorRows.length || prior.rawRows > 200000 ||
      priorRows[0][0] !== prior.minDate || priorRows.at(-1)[0] !== prior.maxDate ||
      await warehouseHash(priorRows) !== prior.warehouseSha256 ||
      await hash(['sales-prior-receipt/v1', prior.runId, prior.generation, prior.sourceSha256,
        prior.rawRows, prior.minDate, prior.maxDate, prior.warehouseSha256]) !== priorReceiptSha256) fail('PRIOR_RECEIPT');
  if (!target || !uuid(target.runId) || target.runId === prior.runId || target.baseGeneration !== prior.generation ||
      !generation(target.generation) || BigInt(target.generation) !== BigInt(prior.generation) + 1n) fail('GENERATION');
  const previous = { rawRows: prior.rawRows, minDate: prior.minDate, maxDate: prior.maxDate };
  const a = await deriveSalesProvenance({ capture: first, aliases, previous, now });
  const b = await deriveSalesProvenance({ capture: second, aliases, previous, now });
  if (json(a) !== json(b)) fail('REOBSERVATION_CHANGED');
  const identities = new Set(JSON.parse(a.canonicalRowsJson).map(row => json(row.slice(0, 7))));
  if (priorRows.some(row => !identities.has(json(row.slice(0, 7))))) fail('HISTORICAL_KEY_REGRESSION');
  const core = ['sales-provenance-binding/v1', target.runId, prior.runId, priorReceiptSha256,
    prior.generation, target.generation, a.sourceSha256, a.rawRows, a.minDate, a.maxDate,
    a.manifestSha256, a.warehouseSha256, a.mappingSha256];
  keys(evidence, ['core', 'observations']);
  if (json(evidence.core) !== json(core) || !Array.isArray(evidence.observations) || evidence.observations.length !== 2) fail('BINDING');
  const seenKeys = new Set(), seenGroups = new Set(), seenIds = new Set();
  let previousTime = -Infinity;
  for (const observation of evidence.observations) {
    keys(observation, ['observerId', 'observedAt', 'signatureHex']);
    const { observerId, observedAt, signatureHex } = observation;
    const observer = observers instanceof Map ? observers.get(observerId) : undefined;
    if (!observer || !observer.independenceGroup || seenIds.has(observerId) || seenGroups.has(observer.independenceGroup) ||
        observer.publicKey?.type !== 'public' || observer.publicKey.algorithm?.name !== 'Ed25519') fail('OBSERVER');
    const keyHash = await digest(await crypto.subtle.exportKey('spki', observer.publicKey));
    if (seenKeys.has(keyHash)) fail('OBSERVER');
    seenIds.add(observerId); seenGroups.add(observer.independenceGroup); seenKeys.add(keyHash);
    const time = timestamp(observedAt);
    if (time <= previousTime || time > now.getTime() || now.getTime() - time > 15 * 60 * 1000) fail('STALE_OBSERVATION');
    previousTime = time;
    if (typeof signatureHex !== 'string' || !/^[a-f0-9]{128}$/.test(signatureHex)) fail('SIGNATURE');
    const signature = Uint8Array.from(signatureHex.match(/../g), x => parseInt(x, 16));
    const message = encoder.encode(json(['sales-source-observation/v1', observerId, observedAt, core]));
    if (!await crypto.subtle.verify('Ed25519', observer.publicKey, signature, message)) fail('SIGNATURE');
  }
  const canonicalEvidence = { core, observations: evidence.observations.map(({ observerId, observedAt, signatureHex }) =>
    ({ observerId, observedAt, signatureHex })) };
  const result = Object.freeze({ runId: target.runId, generation: target.generation, baseGeneration: prior.generation,
    sourceSha256: a.sourceSha256, rawRows: a.rawRows, minDate: a.minDate, maxDate: a.maxDate,
    warehouseSha256: a.warehouseSha256, manifestSha256: a.manifestSha256,
    evidenceJson: json(canonicalEvidence), evidenceSha256: await hash(canonicalEvidence) });
  verified.add(result);
  return result;
}

/** Synthetic read-after-write model only; caller must obtain a complete, consistent,
 * privately authorized DB read with generation before+after and all joined identities.
 */
export async function verifyPreparedSalesReadback(binding, readback) {
  if (!verified.has(binding)) fail('UNVERIFIED_BINDING');
  keys(readback, ['generationBefore', 'generationAfter', 'runId', 'status', 'atomic', 'rowsRead', 'rowsRejected', 'acceptedSourceJson', 'rows']);
  if (readback.generationBefore !== binding.generation || readback.generationAfter !== binding.generation ||
      readback.runId !== binding.runId || readback.status !== 'success' || readback.atomic !== true ||
      readback.rowsRead !== binding.rawRows || readback.rowsRejected !== 0 ||
      readback.acceptedSourceJson !== binding.evidenceJson || await warehouseHash(readback.rows) !== binding.warehouseSha256) fail('READBACK');
  return Object.freeze({ verified: true, runId: binding.runId, evidenceSha256: binding.evidenceSha256 });
}
