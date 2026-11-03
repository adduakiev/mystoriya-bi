// PREPARE ONLY. Deliberately unreferenced by all production entrypoints.
// Explicit dependencies only: no env/secret lookup, logging or import-time I/O.
import { readPrivateSalesSheet, SPREADSHEET_ID } from './google-sheet-reader.mjs';
import { prepareSalesRecovery } from './prepared-sales-recovery.mjs';
import { parseSourceDate } from './source-safety.mjs';

const ORIGIN = 'https://rxewpevxqtfmksybykvo.supabase.co';
const SOURCE = 'google_sheets:Данние короткі';
const RANGE = "'Данние короткі'!A:N";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = code => { throw new Error(`SALES_TRANSPORT_${code}`); };
const integer = (n, max = 200000) => Number.isSafeInteger(n) && n > 0 && n <= max;
const date = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && parseSourceDate(s) === s;
const stamp = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) &&
  date(s.slice(0, 10)) && Number.isFinite(Date.parse(s));
const bytes = s => new TextEncoder().encode(s).byteLength;

/** Future accepted-source evidence contract, NOT currently emitted by importers.
 * A warehouse min_date is not proof of the prior SOURCE minDate. Missing provenance
 * must close the gate, including for otherwise successful atomic/legacy records.
 */
function accepted(run, now) {
  const e = run?.details?.accepted_source_v1;
  const snapshot = run?.details?.snapshot;
  if (!run || !UUID.test(run.id) || run.source_name !== SOURCE || run.status !== 'success' ||
      !stamp(run.started_at) || !stamp(run.finished_at) || Date.parse(run.started_at) > Date.parse(run.finished_at) ||
      Date.parse(run.finished_at) > now.getTime() || !integer(run.rows_read) || !integer(run.rows_loaded) ||
      run.rows_loaded > run.rows_read || run.rows_rejected !== 0 || !date(run.source_cutoff_date)) fail('INVALID_ACCEPTED_RUN');
  if (run.details?.atomic !== true || !e || e.spreadsheet_id !== SPREADSHEET_ID || e.range !== RANGE ||
      e.run_id !== run.id || e.raw_rows !== run.rows_read || !date(e.min_date) || !date(e.max_date) ||
      e.min_date < '2000-01-01' || e.min_date > e.max_date || e.max_date !== run.source_cutoff_date ||
      !stamp(e.observed_at) || Date.parse(e.observed_at) < Date.parse(run.started_at) - 2 * 60 * 60 * 1000 ||
      Date.parse(e.observed_at) > Date.parse(run.finished_at) ||
      typeof e.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(e.sha256) ||
      !snapshot || snapshot.warehouse_rows !== run.rows_loaded || snapshot.min_date !== e.min_date ||
      snapshot.max_date !== e.max_date) fail('AUTHORITATIVE_SOURCE_EVIDENCE_REQUIRED');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (e.max_date >= today) fail('INCOMPLETE_ACCEPTED_DATE');
  return Object.freeze({ rawRows: run.rows_read, minDate: e.min_date, maxDate: e.max_date });
}

/** Opt-in server dependency. Never expose options/credentials or source rows to a client.
 * fetchImpl/readSourceImpl are trusted test/server dependencies, never HTTP parameters.
 * JWT shape checks restrict accidental anon/user/cross-project credentials; Supabase
 * remains responsible for cryptographic signature verification. Only legacy service-role
 * JWTs are supported here; no anonymous key, sb_secret adaptation or hidden fallback.
 */
export function createPreparedSalesTransport({ enabled = false, baseUrl, serviceRoleKey,
  fetchImpl, readSourceImpl = readPrivateSalesSheet, timeoutMs = 30000, stageRetries = 1 } = {}) {
  if (enabled !== true || typeof window !== 'undefined') fail('DISABLED');
  if (baseUrl !== ORIGIN || typeof fetchImpl !== 'function' || typeof readSourceImpl !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 ||
      !Number.isInteger(stageRetries) || stageRetries < 0 || stageRetries > 2) fail('INVALID_CONFIG');
  try {
    if (typeof serviceRoleKey !== 'string' || serviceRoleKey.length > 8192 ||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(serviceRoleKey)) fail();
    const claims = JSON.parse(atob(serviceRoleKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (claims.role !== 'service_role' || claims.ref !== 'rxewpevxqtfmksybykvo' ||
        !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= Date.now() + 60000) fail();
  } catch { fail('INVALID_AUTH'); }

  // Fixed paths only; no caller-selected URLs, redirects, headers or request init.
  async function request(path, { body, signal, maxBytes = 65536, range = false } = {}) {
    if (signal?.aborted) fail('ABORTED');
    const controller = new AbortController();
    let deadline, retryable = true;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      // Race enforces the deadline even for an injected fetch/reader ignoring abort.
      return await Promise.race([
        new Promise((_, reject) => {
          deadline = setTimeout(() => { retryable = true; controller.abort(); reject(new Error('deadline')); }, timeoutMs);
          controller.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true });
        }),
        (async () => {
          const response = await fetchImpl(`${ORIGIN}/rest/v1/${path}`, {
            method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
            credentials: 'omit', signal: controller.signal,
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
              Accept: 'application/json', 'Accept-Profile': 'public', ...(body === undefined ? { Prefer: 'count=exact' } : { 'Content-Type': 'application/json', 'Content-Profile': 'public' }) },
            ...(body === undefined ? {} : { body })
          });
          retryable = [502, 503, 504].includes(response.status);
          if (!response.ok || (response.status !== 200 && response.status !== 206) ||
              !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) fail('RESPONSE');
          const reader = response.body?.getReader();
          if (!reader) fail('RESPONSE');
          const chunks = []; let size = 0;
          const cancel = () => { void reader.cancel().catch(() => {}); };
          controller.signal.addEventListener('abort', cancel, { once: true });
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > maxBytes) fail('RESPONSE');
              chunks.push(value);
            }
          } finally {
            controller.signal.removeEventListener('abort', cancel);
            void reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          const buffer = new Uint8Array(size); let offset = 0;
          for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
          const raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
          const value = JSON.parse(raw);
          return range ? { value, raw, range: response.headers.get('content-range') } : value;
        })()
      ]);
    } catch { fail(signal?.aborted ? 'ABORTED' : retryable ? 'REQUEST_FAILED' : 'RESPONSE_REJECTED'); }
    finally { clearTimeout(deadline); signal?.removeEventListener('abort', abort); }
  }

  const runsPath = 'import_runs?' + new URLSearchParams({
    select: 'id,source_name,status,started_at,finished_at,source_cutoff_date,rows_read,rows_loaded,rows_rejected,details',
    source_name: `eq.${SOURCE}`, status: 'eq.success',
    order: 'finished_at.desc.nullslast,started_at.desc,id.desc', limit: '1'
  });
  async function latest(now, signal) {
    const { value, raw, range } = await request(runsPath, { signal, range: true });
    if (!Array.isArray(value) || value.length !== 1 || !/^0-0\/[1-9]\d*$/.test(range ?? '')) fail('MISSING_OR_PARTIAL_RUN');
    const previous = accepted(value[0], now);
    return { run: value[0], previous, evidence: raw };
  }

  const baselineEvidence = new WeakMap();
  async function readBaseline({ now = new Date(), signal } = {}) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('INVALID_CLOCK');
    const { run, previous, evidence } = await latest(now, signal);
    let total, min = '9999-12-31', max = '0000-01-01', lastId = 0n;
    for (let offset = 0; offset < run.rows_loaded; offset += 1000) {
      const path = 'fact_sales_daily?' + new URLSearchParams({ select: 'id,date_id,import_run_id', order: 'id.asc', limit: '1000', offset: String(offset) });
      const { value, range } = await request(path, { signal, maxBytes: 256000, range: true });
      const expected = Math.min(1000, run.rows_loaded - offset);
      const match = /^(\d+)-(\d+)\/(\d+)$/.exec(range ?? '');
      if (!Array.isArray(value) || value.length !== expected || !match || Number(match[1]) !== offset ||
          Number(match[2]) !== offset + expected - 1 || Number(match[3]) !== run.rows_loaded) fail('PARTIAL_WAREHOUSE');
      total = Number(match[3]);
      for (const row of value) {
        // PostgREST bigint JSON numbers beyond MAX_SAFE_INTEGER cannot be trusted.
        if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || BigInt(row.id) <= lastId ||
            row.import_run_id !== run.id || !date(row.date_id)) fail('WAREHOUSE_IDENTITY');
        lastId = BigInt(row.id);
        if (row.date_id < min) min = row.date_id;
        if (row.date_id > max) max = row.date_id;
      }
    }
    if (total !== run.rows_loaded || min !== previous.minDate || max !== previous.maxDate) fail('WAREHOUSE_MISMATCH');
    const after = await latest(now, signal);
    if (after.evidence !== evidence) fail('BASELINE_CHANGED');
    // This is read evidence, not a token authorizing arbitrary prepared bodies.
    const result = Object.freeze({ runId: run.id, ...previous });
    baselineEvidence.set(result, evidence);
    return result;
  }

  let beginAttempted = false;
  async function recover({ sheetSecret, now = new Date(), signal } = {}) {
    if (beginAttempted) fail('NEW_REVIEW_REQUIRED');
    const baseline = await readBaseline({ now, signal });
    if (signal?.aborted) fail('ABORTED');
    let matrix;
    let sourceTimer;
    const sourceController = new AbortController();
    const abortSource = () => sourceController.abort();
    signal?.addEventListener('abort', abortSource, { once: true });
    try {
      matrix = await Promise.race([
        readSourceImpl(sheetSecret, { fetchImpl, signal: sourceController.signal }),
        new Promise((_, reject) => {
          sourceTimer = setTimeout(() => { sourceController.abort(); reject(new Error('deadline')); }, timeoutMs);
          if (sourceController.signal.aborted) reject(new Error('abort'));
          else sourceController.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true });
        })
      ]);
    } catch { fail(signal?.aborted ? 'ABORTED' : 'SOURCE_READ_FAILED'); }
    finally { clearTimeout(sourceTimer); signal?.removeEventListener('abort', abortSource); }
    if (signal?.aborted) fail('ABORTED');
    const prepared = prepareSalesRecovery(matrix, { previous: baseline, now });
    const current = await readBaseline({ now, signal });
    if (baselineEvidence.get(current) !== baselineEvidence.get(baseline)) fail('BASELINE_CHANGED');
    // No parse/serialize of manifest/batch JSON: exact decimal numeric text survives.
    const counts = /^\{"rows":(\d+),"raw_rows":(\d+),"batches":(\d+),/.exec(prepared.manifestJson);
    const dates = /"min_date":"([^"]+)","max_date":"([^"]+)"\}$/.exec(prepared.manifestJson);
    if (!counts || !dates) fail('INVALID_PREPARATION');
    if (beginAttempted) fail('NEW_REVIEW_REQUIRED'); // concurrent invocation
    beginAttempted = true; // includes an ambiguous begin acknowledgement
    const id = await request('rpc/begin_sales_snapshot_v2', { signal, maxBytes: 128, body: `{"p_manifest":${prepared.manifestJson}}` });
    if (typeof id !== 'string' || !UUID.test(id)) fail('INVALID_RUN_ID');
    // Counts are known from validated source, without parsing monetary bodies.
    let staged = 0;
    for (const batch of prepared.batches) {
      const body = `{"p_run_id":${JSON.stringify(id)},"p_batch_no":${batch.batchNo},"p_rows":${batch.json}}`;
      if (bytes(batch.json) > 4 * 1024 * 1024) fail('BATCH_LIMIT');
      let count;
      for (let attempt = 0; ; attempt++) {
        try { count = await request('rpc/stage_sales_batch_v2', { body, signal, maxBytes: 128 }); break; }
        catch (error) {
          // SQL makes identical (run,batch,payload) delivery idempotent. Never retry
          // begin (allocates a run), validation errors, external abort, or commit.
          if (signal?.aborted || error.message !== 'SALES_TRANSPORT_REQUEST_FAILED' || attempt >= stageRetries) throw error;
        }
      }
      if (count !== Math.min(2000, Number(counts[1]) - batch.batchNo * 2000)) fail('INVALID_STAGE_COUNT');
      staged += count;
    }
    if (staged !== Number(counts[1])) fail('INVALID_STAGE_COUNT');
    // Single attempt only. A lost/invalid receipt is ambiguous, not a failed commit.
    // No resumable run or automatic whole-flow retry is exposed by this contract.
    let receipt;
    try { receipt = await request('rpc/commit_sales_snapshot_v2', { signal, body: `{"p_run_id":${JSON.stringify(id)}}`, maxBytes: 4096 }); }
    catch { fail('COMMIT_OUTCOME_UNKNOWN'); }
    if (!receipt || receipt.warehouse_rows !== staged || !Number.isSafeInteger(receipt.deleted_stale_rows) ||
        receipt.deleted_stale_rows < 0 || receipt.min_date !== dates[1] || receipt.max_date !== dates[2]) fail('COMMIT_RECEIPT_INVALID');
    // Do not return upstream totals/errors/extra fields, source rows or credentials.
    return Object.freeze({ runId: id, rows: staged, rawRows: Number(counts[2]) });
  }
  return Object.freeze({ readBaseline, recover });
}
