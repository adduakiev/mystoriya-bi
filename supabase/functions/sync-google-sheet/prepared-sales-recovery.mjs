// PREPARED ONLY. No database client, RPC execution, environment reads or import-time I/O.
// JSON text is intentional: parsing/restringifying monetary numbers loses cents.
import { readPrivateSalesSheet } from './google-sheet-reader.mjs';
import { assertSalesCsvPreflight, parseSourceDate } from './source-safety.mjs';

const fail = code => { throw new Error(`SALES_RECOVERY_${code}`); };
const text = value => typeof value === 'string'
  ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : fail('INVALID_CELL');
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  parseSourceDate(value) === value;
const money = cents => `${cents < 0n ? '-' : ''}${(cents < 0n ? -cents : cents) / 100n}.${String((cents < 0n ? -cents : cents) % 100n).padStart(2, '0')}`;

function decimal(value, checks = false) {
  const clean = text(value);
  if (!/^[+-]?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(clean)) fail('INVALID_METRIC');
  const [whole, fraction = ''] = clean.replace(/ /g, '').replace(',', '.').split('.');
  if (/[1-9]/.test(fraction.slice(checks ? 0 : 2))) fail('INVALID_PRECISION');
  const negative = whole.startsWith('-');
  const cents = (BigInt(whole.replace(/^[+-]/, '')) * 100n + BigInt((fraction + '00').slice(0, 2))) * (negative ? -1n : 1n);
  if (cents <= -10000000000000000n || cents >= 10000000000000000n || (checks && cents < 0n)) fail('INVALID_PRECISION');
  return cents;
}

function baseline(previous, now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('INVALID_CLOCK');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (!previous || !Number.isSafeInteger(previous.rawRows) || previous.rawRows < 1 || previous.rawRows > 200000 ||
      !iso(previous.minDate) || !iso(previous.maxDate) || previous.minDate > previous.maxDate || previous.maxDate >= today) fail('UNKNOWN_BASELINE');
  return today;
}

/** Build immutable request bodies for later reviewed atomic integration; never send them.
 * previous MUST come from the last accepted source/warehouse, never caller guesses.
 * No initial-load bypass. SQL independently checks every historical canonical key.
 * Duplicate source keys fail closed; aggregation requires separate source-contract review.
 */
export function prepareSalesRecovery(matrix, { previous, now = new Date() } = {}) {
  const today = baseline(previous, now);
  assertSalesCsvPreflight(matrix, { previousRowCount: previous.rawRows });
  const count = matrix.length - 1;
  if (count < previous.rawRows || count > 200000) fail('SOURCE_ROW_REGRESSION_OR_LIMIT');
  const keys = new Set(), rows = [];
  let revenue = 0n, checks = 0n, markup = 0n, minDate = '9999-12-31', maxDate = '0000-01-01';
  for (const cells of matrix.slice(1)) {
    if (cells.length !== 14) fail('INVALID_WIDTH');
    const dateText = text(cells[5]);
    // Reject timestamps, fractional serials and date-parser suffix truncation.
    if (!/^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\d{1,2}\.\d{4}|\d{5})$/.test(dateText)) fail('INVALID_DATE');
    const accounting_date = parseSourceDate(dateText);
    if (!accounting_date || accounting_date < '2000-01-01' || accounting_date >= today) fail('INCOMPLETE_OR_FUTURE_DATE');
    const dimensions = cells.slice(6, 11).map(value => {
      if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) fail('UNKNOWN_DIMENSION');
      const result = text(value);
      if (!result || result.length > 256 || /^(?:unknown|null|undefined|none|nan)$/i.test(result) || /#REF!|#N\/A/i.test(result)) fail('UNKNOWN_DIMENSION');
      return result;
    });
    const key = JSON.stringify([accounting_date, ...dimensions]);
    if (keys.has(key)) fail('DUPLICATE_SOURCE_KEY');
    keys.add(key);
    const r = decimal(cells[11]), c = decimal(cells[12], true), m = decimal(cells[13]);
    revenue += r; checks += c; markup += m;
    if (accounting_date < minDate) minDate = accounting_date;
    if (accounting_date > maxDate) maxDate = accounting_date;
    const [location_raw, brand, ownership, channel_group, order_type] = dimensions;
    const identity = JSON.stringify({ accounting_date, location_raw, brand, ownership, channel_group, order_type });
    rows.push(`${identity.slice(0, -1)},"revenue":${money(r)},"checks":${c / 100n},"markup":${money(m)}}`);
  }
  if (minDate > previous.minDate || maxDate < previous.maxDate) fail('SOURCE_DATE_REGRESSION');
  const lastCompleted = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  if (maxDate !== lastCompleted) fail('STALE_OR_PARTIAL_CUTOFF');
  const batches = [];
  for (let offset = 0; offset < rows.length; offset += 2000) {
    const json = `[${rows.slice(offset, offset + 2000).join(',')}]`;
    if (new TextEncoder().encode(json).byteLength > 4 * 1024 * 1024) fail('BATCH_BYTE_LIMIT');
    batches.push(Object.freeze({ batchNo: batches.length, json }));
  }
  const manifestJson = `{"rows":${count},"raw_rows":${count},"batches":${batches.length},"revenue":${money(revenue)},"checks":${checks / 100n},"markup":${money(markup)},"min_date":"${minDate}","max_date":"${maxDate}"}`;
  return Object.freeze({ manifestJson, batches: Object.freeze(batches) });
}

/** Explicit server-only preparation call, disconnected from both production entrypoints.
 * Reads only the fixed private source via the existing readonly OAuth reader.
 * Returned bodies contain confidential source rows: never log, publish or persist them.
 */
export async function readAndPrepareSalesRecovery(secret, { previous, now = new Date(), fetchImpl = fetch } = {}) {
  baseline(previous, now); // unknown baseline fails before authentication/network
  const matrix = await readPrivateSalesSheet(secret, { fetchImpl });
  return prepareSalesRecovery(matrix, { previous, now });
}
