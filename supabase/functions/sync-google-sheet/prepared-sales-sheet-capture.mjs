// PREPARED ONLY. No runtime wiring, default fetch, environment lookup or storage.
import { SPREADSHEET_ID, privateSalesReadonlyAccessToken } from './google-sheet-reader.mjs';
import { canonicalSalesSourceBytes } from './prepared-sales-provenance.mjs';
import { assertSalesCsvPreflight } from './source-safety.mjs';

/** @typedef {string | number | null} SourceCell
 * @typedef {Readonly<{spreadsheetId: string, requestedRange: string,
 * returnedRange: string, majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
 * dateTimeRenderOption: 'SERIAL_NUMBER', values: ReadonlyArray<ReadonlyArray<SourceCell>>}>} SalesCapture
 * @typedef {Readonly<{requestUrl: string, status: 200, redirected: false,
 * contentType: string, contentLength: string | null, contentEncoding: string | null,
 * date: string | null, bodyByteLength: number}>} CaptureResponseMetadata
 * @typedef {Readonly<{capture: SalesCapture, responseBodySha256: string, sourceSha256: string,
 * responseMetadata: CaptureResponseMetadata, copyResponseBodyBytes: () => Uint8Array}>} PreparedSalesObservation
 */
const RANGE = "'Данние короткі'!A:N";
const MAX_BYTES = 32 * 1024 * 1024;
const URL_FIXED = (() => {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(RANGE)}`);
  url.search = new URLSearchParams({ majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER' }).toString();
  return url.toString();
})();
const fail = code => { throw new Error(`SALES_CAPTURE_${code}`); };
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(x => x.toString(16).padStart(2, '0')).join('');

// Compare decimal spellings without rounding through Number first. Accept 1e2
// and 100.00 equivalently, but reject 9007199254740993 / 0.10000000000000001.
function decimalIdentity(text) {
  const [mantissa, exponent = '0'] = text.toLowerCase().split('e');
  if (text.length > 1024 || !Number.isSafeInteger(Number(exponent)) || Math.abs(Number(exponent)) > 1024) fail('NUMBER');
  const [whole, fraction = ''] = mantissa.split('.');
  let digits = (whole + fraction).replace(/^-/, '').replace(/^0+/, '');
  let power = Number(exponent) - fraction.length;
  if (!digits) return '0';
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); power++; }
  return `${mantissa.startsWith('-') ? '-' : ''}${digits}e${power}`;
}
function parseTypedJson(text) {
  // Skip complete JSON string tokens (including escaped quotes/digits).
  for (const token of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)) {
    if (token[1] === undefined) continue;
    const number = Number(token[1]);
    if (!Number.isFinite(number) || Object.is(number, -0) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number)) ||
        decimalIdentity(token[1]) !== decimalIdentity(String(number))) fail('NUMBER');
  }
  return JSON.parse(text);
}

/** One future separately authorized read-only observation, never a pair/retry.
 * secret/fetchImpl/signal are explicit TRUSTED SERVER dependencies, never request
 * fields. Caller must obtain separate authorization/custodians for two captures.
 * The entire result is confidential in-memory evidence, not an HTTP response.
 * copyResponseBodyBytes returns a defensive copy; never log/persist it or cells.
 * Hashes describe bytes only: no signature, authentic prior receipt or trust root.
 * @param {string} secret Explicit existing private service-account secret, never persisted.
 * @param {{fetchImpl: typeof fetch, signal?: AbortSignal, timeoutMs?: number}} options
 * @returns {Promise<PreparedSalesObservation>}
 */
export async function capturePreparedPrivateSalesSheet(secret, options) {
  if (typeof window !== 'undefined') fail('SERVER_ONLY');
  if (!options || Object.keys(options).some(k => !['fetchImpl', 'signal', 'timeoutMs'].includes(k)) ||
      typeof options.fetchImpl !== 'function') fail('OPTIONS');
  const { fetchImpl, signal, timeoutMs = 30000 } = options;
  if ((signal !== undefined && !(signal instanceof AbortSignal)) ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('OPTIONS');
  if (signal?.aborted) fail('ABORTED');
  const controller = new AbortController();
  let timer, reader;
  let rejectStop;
  const stop = new Promise((_, reject) => { rejectStop = reject; });
  const cancel = code => { rejectStop(new Error(`SALES_CAPTURE_${code}`)); controller.abort(); };
  const abort = () => cancel('ABORTED');
  signal?.addEventListener('abort', abort, { once: true });
  timer = setTimeout(() => cancel('TIMEOUT'), timeoutMs);
  // Race EVERY await, including injected dependencies that ignore AbortSignal.
  const bounded = promise => Promise.race([promise, stop]);
  try {
    const token = await bounded(privateSalesReadonlyAccessToken(secret, fetchImpl, controller.signal));
    if (controller.signal.aborted) fail('ABORTED');
    const response = await bounded(Promise.resolve().then(() => fetchImpl(URL_FIXED, {
      method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal
    })));
    if (response.status !== 200 || response.redirected || (response.url && response.url !== URL_FIXED)) fail('RESPONSE');
    const contentType = response.headers.get('content-type');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType ?? '')) fail('RESPONSE');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^(?:0|[1-9]\d{0,8})$/.test(length) || Number(length) > MAX_BYTES)) fail('RESPONSE');
    const encoding = response.headers.get('content-encoding');
    if (encoding !== null && !/^(?:identity|gzip|br|deflate)$/i.test(encoding)) fail('RESPONSE');
    const date = response.headers.get('date');
    if (date !== null && (!Number.isFinite(Date.parse(date)) || new Date(date).toUTCString() !== date)) fail('RESPONSE');
    reader = response.body?.getReader();
    if (!reader) fail('RESPONSE');
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await bounded(reader.read());
      if (done) break;
      if (!(value instanceof Uint8Array)) fail('RESPONSE');
      size += value.byteLength;
      if (size > MAX_BYTES) fail('BYTE_LIMIT');
      chunks.push(value.slice());
    }
    if (length !== null && (!encoding || encoding.toLowerCase() === 'identity') && Number(length) !== size) fail('RESPONSE');
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    // BOM is not silently removed from the retained JSON decoding contract.
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const result = parseTypedJson(text);
    if (!result || Object.keys(result).sort().join(',') !== 'majorDimension,range,values' ||
        result.majorDimension !== 'ROWS' || !Array.isArray(result.values) ||
        result.values.some(row => !Array.isArray(row) || row.length !== 14)) fail('VALUES');
    /** @type {SalesCapture} */
    const capture = Object.freeze({ spreadsheetId: SPREADSHEET_ID, requestedRange: RANGE,
      returnedRange: result.range, majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER', values: Object.freeze(result.values.map(row => Object.freeze(row))) });
    const sourceBytes = canonicalSalesSourceBytes(capture); // exact shared contract, before coercion
    assertSalesCsvPreflight(capture.values); // validates header/required cells; does not change capture
    const responseBodySha256 = await bounded(sha256(bytes));
    const sourceSha256 = await bounded(sha256(sourceBytes));
    return Object.freeze({ capture, responseBodySha256, sourceSha256,
      responseMetadata: Object.freeze({ requestUrl: URL_FIXED, status: 200, redirected: false,
        contentType, contentLength: length, contentEncoding: encoding, date, bodyByteLength: size }),
      copyResponseBodyBytes: () => bytes.slice() });
  } catch (error) {
    // Never forward upstream/auth/parse errors, causes, headers, source or secrets.
    if (error?.message === 'SALES_CAPTURE_ABORTED') fail('ABORTED');
    if (error?.message === 'SALES_CAPTURE_TIMEOUT') fail('TIMEOUT');
    fail('FAILED');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.abort();
    if (reader) {
      // Cleanup must not hang on an injected non-cooperating stream.
      void reader.cancel().catch(() => {}).finally(() => { try { reader.releaseLock(); } catch {} });
    }
  }
}
