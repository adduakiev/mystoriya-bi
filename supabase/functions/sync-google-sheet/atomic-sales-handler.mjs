import { SALES_SOURCE_URL, prepareSalesSnapshot, sha256Hex } from './sales-snapshot.mjs';
const ORIGIN = 'https://rxewpevxqtfmksybykvo.supabase.co';
const response = (body, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = code => { throw new Error(code); };

async function boundedRead(fetchImpl, url, init, { bytes = 65536, timeoutMs = 30000, csv = false, hashOnly = false } = {}) {
  const controller = new AbortController();
  let timer, reader;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('REQUEST_TIMEOUT')); }, timeoutMs); });
  try {
    return await Promise.race([deadline, (async () => {
      const r = await fetchImpl(url, { ...init, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (!r.ok || r.redirected || (r.url && r.url !== url)) fail('REQUEST_REJECTED');
      const contentType = r.headers.get('content-type') ?? '';
      if (!(csv ? /^(?:text\/(?:csv|plain)|application\/csv)(?:;|$)/i : /^application\/json(?:;|$)/i).test(contentType)) fail('CONTENT_TYPE');
      reader = r.body?.getReader(); if (!reader) fail('RESPONSE_BODY');
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > bytes) fail('RESPONSE_SIZE'); chunks.push(value);
      }
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      if (csv && hashOnly) return { sha256: await sha256Hex(body) };
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
      return csv ? { text, sha256: await sha256Hex(body) } : JSON.parse(text);
    })()]);
  } finally {
    clearTimeout(timer); controller.abort();
    if (reader) void reader.cancel().catch(() => {}).finally(() => { try { reader.releaseLock(); } catch {} });
  }
}

/** Server-only production handler. The database policy is DISABLED after install;
 * the release controller enables it after backup/restore and exact-commit checks.
 * Reuses the deployed v9 sync-key header and fixed displayed CSV source. Credentials,
 * source contents and database error text never appear in responses or logs.
 */
export async function handleAtomicSalesRequest(req, { envGet, fetchImpl = fetch, now = () => new Date() } = {}) {
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const key = req.headers.get('x-bi-sync-key') ?? '';
  if (!key || key.length > 4096) return response({ error: 'Unauthorized' }, 401);
  let runId, rpc;
  try {
    if (typeof envGet !== 'function') fail('RUNTIME_CONFIGURATION');
    const origin = envGet('SUPABASE_URL'), serviceKey = envGet('SUPABASE_SERVICE_ROLE_KEY');
    if (origin !== ORIGIN || typeof serviceKey !== 'string' || !serviceKey || serviceKey.length > 8192) fail('RUNTIME_CONFIGURATION');
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json', 'Content-Type': 'application/json' };
    const config = await boundedRead(fetchImpl, `${ORIGIN}/rest/v1/bi_runtime_config?select=value_hash&config_key=eq.sync_key`, { method: 'GET', headers });
    if (!Array.isArray(config) || config.length !== 1 || !/^[a-f0-9]{64}$/.test(config[0]?.value_hash ?? '') ||
        await sha256Hex(key) !== config[0].value_hash) return response({ error: 'Unauthorized' }, 401);
    rpc = async (name, json = '{}') => boundedRead(fetchImpl, `${ORIGIN}/rest/v1/rpc/${name}`,
      { method: 'POST', headers, body: json }, { timeoutMs: name === 'commit_sales_snapshot_v3' ? 60000 : 30000 });
    // Read-only context also enforces the database release policy before source access.
    const context = await rpc('sales_snapshot_context_v3');
    const readSource = (hashOnly = false) => boundedRead(fetchImpl, SALES_SOURCE_URL,
      { method: 'GET', headers: { 'User-Agent': 'myastoriya-bi-sync', Accept: 'text/csv' } }, { bytes: 32 * 1024 * 1024, csv: true, hashOnly });
    const first = await readSource();
    const prepared = prepareSalesSnapshot(first.text, context, now());
    const second = await readSource(true);
    if (first.sha256 !== second.sha256) fail('SOURCE_CHANGED');
    // Add the digest to immutable exact-decimal JSON without Number reparsing.
    const manifest = `${prepared.manifestJson.slice(0, -1)},"source_sha256":"${first.sha256}"}`;
    runId = await rpc('begin_sales_snapshot_v3', `{"p_manifest":${manifest}}`);
    if (typeof runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) fail('RUN_RECEIPT');
    for (const batch of prepared.batches) {
      const count = await rpc('stage_sales_batch_v3', `{"p_run_id":"${runId}","p_batch_no":${batch.batchNo},"p_rows":${batch.json}}`);
      if (count !== batch.rowCount) fail('STAGING_RECEIPT');
    }
    const result = await rpc('commit_sales_snapshot_v3', JSON.stringify({ p_run_id: runId }));
    if (result?.ok !== true || result.import_run_id !== runId || result.atomic !== true || result.source_sha256 !== first.sha256) fail('COMMIT_RECEIPT');
    return response(result);
  } catch (error) {
    // Never repeat a commit on a transport error or overwrite an uncertain success.
    // This RPC locks the run and returns committed success if the response was lost.
    if (runId && rpc) {
      try {
        const result = await rpc('fail_sales_snapshot_v3', JSON.stringify({ p_run_id: runId, p_code: 'IMPORT_FAILED' }));
        if (result?.ok === true && result.import_run_id === runId && result.atomic === true) return response(result);
        if (result?.status === 'failed') return response({ ok: false, code: 'SALES_IMPORT_FAILED', import_run_id: runId, published: false }, 500);
      } catch {}
      return response({ ok: false, code: 'SALES_IMPORT_STATUS_PENDING', import_run_id: runId }, 202);
    }
    return response({ ok: false, code: 'SALES_IMPORT_SAFETY_GATE' }, 503);
  }
}
