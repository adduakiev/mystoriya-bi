// The production contract is the actual historical gviz CSV. Its numeric text
// includes sub-cent cells: do not substitute Sheets FORMATTED_VALUE or round
// individual inputs. Preserve the byte digest and aggregate exactly as v9 did.
import { parseSourceDate } from './source-safety.mjs';
export const SALES_SOURCE_CONTRACT = 'gviz-numeric-canonical-js-number-v1';
export const SALES_SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA/gviz/tq?tqx=out:csv&sheet=%D0%94%D0%B0%D0%BD%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%BE%D1%80%D0%BE%D1%82%D0%BA%D1%96';
const fail = code => { throw new Error(`SALES_SNAPSHOT_${code}`); };
const norm = value => String(value).normalize('NFC').replace(/\s+/g, ' ').trim();
export const sha256Hex = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
  typeof value === 'string' ? new TextEncoder().encode(value) : value))].map(x => x.toString(16).padStart(2, '0')).join('');

// Slice complete fields instead of allocating a string for every character.
// Yield one record at a time so production preparation never retains a CSV matrix.
function* salesCsvRecords(text) {
  if (typeof text !== 'string' || text.length > 32 * 1024 * 1024 || text.startsWith('<')) fail('CSV');
  let position = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (position < text.length) {
    const row = [];
    while (true) {
      let value;
      if (text[position] === '"') {
        let start = ++position;
        let pieces;
        while (true) {
          const quote = text.indexOf('"', position);
          if (quote < 0) fail('CSV_TRUNCATED');
          if (text[quote + 1] === '"') {
            (pieces ??= []).push(text.slice(start, quote), '"');
            position = quote + 2;
            start = position;
          } else {
            value = pieces ? [...pieces, text.slice(start, quote)].join('') : text.slice(start, quote);
            position = quote + 1;
            break;
          }
        }
      } else {
        const start = position;
        while (position < text.length) {
          const code = text.charCodeAt(position);
          if (code === 44 || code === 10 || code === 13) break;
          if (code === 34) fail('CSV_QUOTING');
          position++;
        }
        value = text.slice(start, position);
      }
      row.push(value);
      if (position === text.length) break;
      const delimiter = text[position++];
      if (delimiter === ',') continue;
      if (delimiter !== '\r' && delimiter !== '\n') fail('CSV_QUOTING');
      if (delimiter === '\r' && text[position] === '\n') position++;
      break;
    }
    if (row.some(value => value !== '')) yield row;
  }
}

// The exported matrix form remains available for focused parser tests and tools.
export function parseSalesCsv(text) {
  return [...salesCsvRecords(text)];
}

function numberText(value) {
  // Only the documented UAH display symbol is removable, never arbitrary text.
  if (value.length <= 64 && /^[+-]?\d+(?:[.,]\d+)?$/.test(value)) return value;
  const s = norm(value).replace(/^₴\s*|\s*₴$/g, '');
  if (s.length > 64 || !/^[+-]?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(s)) fail('NUMBER');
  // At most 64 decimal characters cannot overflow a finite IEEE-754 number.
  return s;
}
const numeric = text => Number(text.includes(' ') || text.includes(',') ? text.replace(/ /g, '').replace(',', '.') : text);
const cents = amount => {
  if (!Number.isFinite(amount) || Math.abs(amount) >= 2 ** 45) fail('UNSAFE_NUMBER');
  const fixed = amount.toFixed(2);
  const value = BigInt(fixed.replace('.', ''));
  if (value <= -10000000000000000n || value >= 10000000000000000n) fail('OVERFLOW');
  return { value, fixed: value === 0n ? '0.00' : fixed };
};
const money = value => `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`;

/** Pure complete-source preparation. Context comes from the database, not HTTP
 * parameters. Canonical aggregation happens BEFORE any 2,000-row split. Source
 * order and JS Number/toFixed behavior deliberately match deployed v9, including
 * signed values; exact integer cents are used only AFTER canonical aggregation.
 * Returns private business rows: never log or return them to a browser.
 */
export function prepareSalesSnapshot(csv, context, now = new Date()) {
  if (!context || context.enabled !== true || !/^[a-f0-9]{32}$/.test(context.baseline_hash ?? '') ||
      !/^[a-f0-9]{32}$/.test(context.mapping_hash ?? '') || !Number.isSafeInteger(context.raw_rows) || context.raw_rows < 1 ||
      !Array.isArray(context.mapping) || !Array.isArray(context.channels) || !context.channels.length ||
      !/^\d{4}-\d{2}-\d{2}$/.test(context.min_date ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(context.max_date ?? '') ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) fail('CONTEXT');
  const records = salesCsvRecords(csv);
  const header = records.next().value;
  // This explicit gviz contract intentionally differs from the legacy generic
  // cent-only preflight. Actual deployed-v9 reproduction on the 2026-11-12 source
  // proved 1,395 sub-cent cells; retaining them until canonical aggregation is
  // necessary to reproduce every accepted key. Never round each input row.
  const expected = ['Обліковий день', 'Зі складу', 'Бренд', 'Власність', 'Доставка',
    'Тип замовлення', 'Сума зі знижкою, грн.', 'Чеків', 'Націнка, грн.'];
  if (!header || header.length !== 14 || expected.some((v, i) => norm(header[i + 5]) !== v)) fail('HEADER');
  let rawRows = 0;
  const mapping = new Map();
  for (const pair of context.mapping) {
    if (!pair || typeof pair.source_name !== 'string' || typeof pair.canonical_name !== 'string' ||
        !norm(pair.source_name) || !norm(pair.canonical_name) || mapping.has(norm(pair.source_name))) fail('MAPPING');
    mapping.set(norm(pair.source_name), norm(pair.canonical_name));
  }
  for (const target of mapping.values()) if (mapping.has(target) && mapping.get(target) !== target) fail('MAPPING_CHAIN');
  const channels = new Set(context.channels);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const groups = new Map(); let rawSubcentCells = 0;
  const dateCache = new Map(), dimensionCache = new Map();
  const dimension = raw => {
    let value = dimensionCache.get(raw);
    if (value === undefined) {
      value = norm(raw);
      if (!value || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value) || /^(?:unknown|null|undefined|none|nan)$/i.test(value)) fail('DIMENSION');
      dimensionCache.set(raw, value);
    }
    return value;
  };
  for (const cells of records) {
    if (++rawRows > 200000) fail('SOURCE_ROW_REGRESSION');
    if (cells.length !== 14) fail('WIDTH');
    let date = dateCache.get(cells[5]);
    if (!date) {
      const sourceDate = norm(cells[5]);
      if (!/^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\.\d{1,2}\.\d{4}|\d{5})$/.test(sourceDate)) fail('DATE');
      date = parseSourceDate(sourceDate);
      if (!date || date >= today) fail('INCOMPLETE_DATE');
      dateCache.set(cells[5], date);
    }
    const dims = cells.slice(6, 11).map(dimension);
    dims[0] = mapping.get(dims[0]) ?? dims[0];
    if (!channels.has(dims[3])) fail('UNKNOWN_CHANNEL');
    const key = JSON.stringify([date, ...dims]);
    const current = groups.get(key) ?? { accounting_date: date, location_raw: dims[0], brand: dims[1], ownership: dims[2], channel_group: dims[3], order_type: dims[4], r: 0, c: 0, m: 0 };
    for (const column of [11, 12, 13]) cells[column] = numberText(cells[column]);
    current.r += numeric(cells[11]);
    const inputChecks = numeric(cells[12]);
    if (!Number.isSafeInteger(inputChecks) || inputChecks < 0) fail('CHECKS');
    current.c += inputChecks;
    current.m += numeric(cells[13]);
    for (const column of [11, 13]) {
      const text = cells[column], point = Math.max(text.indexOf('.'), text.indexOf(','));
      if (point >= 0 && text.length > point + 3 && /[1-9]/.test(text.slice(point + 3))) rawSubcentCells++;
    }
    if (!Number.isSafeInteger(current.c)) fail('CHECKS_OVERFLOW');
    groups.set(key, current);
  }
  if (rawRows < context.raw_rows) fail('SOURCE_ROW_REGRESSION');
  let revenue = 0n, checks = 0n, markup = 0n, minDate = '9999-12-31', maxDate = '0000-01-01';
  const rows = [], daily = new Map();
  for (const { r, c, m, ...identity } of groups.values()) {
    const { value: rc, fixed: revenueText } = cents(r);
    const { value: mc, fixed: markupText } = cents(m);
    const cc = BigInt(c);
    revenue += rc; markup += mc; checks += cc;
    minDate = identity.accounting_date < minDate ? identity.accounting_date : minDate;
    maxDate = identity.accounting_date > maxDate ? identity.accounting_date : maxDate;
    const prefix = JSON.stringify(identity);
    rows.push(`${prefix.slice(0, -1)},"revenue":${revenueText},"checks":${cc},"markup":${markupText}}`);
    const totals = daily.get(identity.accounting_date) ?? { rows: 0, revenue: 0n, checks: 0n, markup: 0n };
    totals.rows++; totals.revenue += rc; totals.checks += cc; totals.markup += mc; daily.set(identity.accounting_date, totals);
  }
  if (!rows.length || minDate > context.min_date || maxDate < context.max_date) fail('DATE_REGRESSION');
  const batches = [];
  for (let i = 0; i < rows.length; i += 2000) {
    const json = `[${rows.slice(i, i + 2000).join(',')}]`;
    if (new TextEncoder().encode(json).byteLength > 4194304) fail('BATCH_SIZE');
    batches.push(Object.freeze({ batchNo: batches.length, rowCount: Math.min(2000, rows.length - i), json }));
  }
  const manifestJson = `{"contract":"${SALES_SOURCE_CONTRACT}","rows":${rows.length},"raw_rows":${rawRows},"raw_subcent_cells":${rawSubcentCells},"batches":${batches.length},"revenue":${money(revenue)},"checks":${checks},"markup":${money(markup)},"min_date":"${minDate}","max_date":"${maxDate}","baseline_hash":"${context.baseline_hash}","mapping_hash":"${context.mapping_hash}"}`;
  const dailyTotals = [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => Object.freeze({ date, rows: t.rows, revenue: money(t.revenue), checks: String(t.checks), markup: money(t.markup) }));
  return Object.freeze({ manifestJson, batches: Object.freeze(batches), dailyTotals: Object.freeze(dailyTotals) });
}
