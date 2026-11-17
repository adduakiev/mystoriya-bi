import "server-only";
import { normalizeGlovoSheet, buildGlovoReport } from "./glovo-contract";
import { mapGlovoMonthlyRows } from "./glovo-monthly-mapping";
import { glovoGoogleBearer } from "./glovo-google-auth";
import { glovoPrivateJson, glovoRecord } from "./glovo-private-http";

const ID = "1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98";
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${ID}`;
const META_URL = `${BASE}?fields=spreadsheetId,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`;
const fail = () => new Error("GLOVO_SOURCE_UNAVAILABLE");

const MAPPING_SHEETS = [
  { id: 20111302, title: "Мапінг закладів", columns: 5, last: "E" },
  { id: 20111303, title: "Мапінг брендів", columns: 7, last: "G" }
] as const;
function mappingGrids(value: unknown) {
  if (!glovoRecord(value) || !Array.isArray(value.sheets)) throw fail();
  return MAPPING_SHEETS.map(def => {
    const matches = (value.sheets as unknown[]).filter(s => glovoRecord(s) && glovoRecord(s.properties) &&
      (s.properties.sheetId === def.id || s.properties.title === def.title));
    if (matches.length !== 1 || !glovoRecord(matches[0]) || !glovoRecord(matches[0].properties)) throw fail();
    const p = matches[0].properties;
    if (p.sheetId !== def.id || p.title !== def.title || !glovoRecord(p.gridProperties)) throw fail();
    const {rowCount, columnCount} = p.gridProperties;
    if (typeof rowCount !== "number" || !Number.isSafeInteger(rowCount) || rowCount < 2 || rowCount > 10000 ||
      typeof columnCount !== "number" || !Number.isSafeInteger(columnCount) || columnCount < def.columns) throw fail();
    return {...def, rowCount, columnCount, range: "'" + def.title + "'!A1:" + def.last + rowCount};
  });
}

function grid(value: unknown) {
  if (!glovoRecord(value) || value.spreadsheetId !== ID || !Array.isArray(value.sheets)) throw fail();
  const matches = value.sheets.filter(sheet => glovoRecord(sheet) && glovoRecord(sheet.properties) &&
    (sheet.properties.sheetId === 1135188423 || sheet.properties.title === "Дані"));
  if (matches.length !== 1 || !glovoRecord(matches[0]) || !glovoRecord(matches[0].properties)) throw fail();
  const properties = matches[0].properties;
  if (properties.sheetId !== 1135188423 || properties.title !== "Дані" || !glovoRecord(properties.gridProperties)) throw fail();
  const { rowCount, columnCount } = properties.gridProperties;
  if (typeof rowCount !== "number" || !Number.isSafeInteger(rowCount) || rowCount < 6 || rowCount > 50000 ||
      typeof columnCount !== "number" || !Number.isSafeInteger(columnCount) || columnCount < 9) throw fail();
  return { rowCount, columnCount };
}

/** Reads every cell of the approved A:I grid through its metadata boundary.
 * This proves a fully consumed bounded API response, NOT upstream month coverage.
 * Trailing empty rows may be omitted by Google; new rows/brands need no snapshot count.
 * Metadata is checked again to reject a concurrent grid resize; Google does not
 * provide a transaction snapshot across these calls, so concurrent cell edits remain possible.
 */
export async function readGlovoPrivateSheet(serviceAccountJson: string | undefined, fetchImpl: typeof fetch, includeMappings = false) {
  try {
    const bearer = await glovoGoogleBearer(serviceAccountJson, fetchImpl);
    const read = (url: string) => {
      if (bearer.expiresAt <= Date.now() + 5000) throw fail();
      return glovoPrivateJson(fetchImpl, url, { method: "GET",
        headers: { Authorization: `Bearer ${bearer.token}`, Accept: "application/json" } });
    };
    const beforeMetadata = await read(META_URL);
    const before = grid(beforeMetadata);
    const mappings = includeMappings ? mappingGrids(beforeMetadata) : [];
    const range = `'Дані'!A5:I${before.rowCount}`;
    const url = `${BASE}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
    const result = await read(url);
    const mappedValues = await Promise.all(mappings.map(async m => {
      const payload = await read(BASE + "/values/" + encodeURIComponent(m.range) + "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE");
      if (!glovoRecord(payload) || Object.keys(payload).length !== 3 || payload.range !== m.range ||
        payload.majorDimension !== "ROWS" || !Array.isArray(payload.values) || payload.values.length < 1 ||
        payload.values.length > m.rowCount || payload.values.some(row => !Array.isArray(row))) throw fail();
      return payload.values as unknown[][];
    }));
    const afterMetadata = await read(META_URL);
    const after = grid(afterMetadata);
    if (includeMappings && JSON.stringify(mappings) !== JSON.stringify(mappingGrids(afterMetadata))) throw fail();
    if (before.rowCount !== after.rowCount || before.columnCount !== after.columnCount ||
        !glovoRecord(result) || Object.keys(result).length !== 3 || result.range !== range ||
        result.majorDimension !== "ROWS" || !Array.isArray(result.values) || result.values.length < 2 ||
        result.values.length > before.rowCount - 4) throw fail();
    for (const cells of result.values) {
      if (!Array.isArray(cells) || cells.length > 9 || cells.some(cell => cell !== null && typeof cell !== "string" &&
          (typeof cell !== "number" || !Number.isFinite(cell)))) throw fail();
      if (!cells.length || cells.every(cell => cell === "" || cell === null)) continue;
      if (cells !== result.values[0] && (cells.length !== 9 ||
          ![5, 6].every(index => cells[index] === "" || cells[index] === null || (typeof cells[index] === "number" &&
            cells[index] >= 0 && (index !== 5 || Number.isSafeInteger(cells[index])))) ||
          (cells[8] !== 0 && cells[8] !== 1))) throw fail();
    }
    const contract = normalizeGlovoSheet(result.values);
    if (contract.status !== "valid" || !contract.rows.length) throw fail();
    const months = [...new Set(contract.rows.map(row => row.month))].sort();
    const report = buildGlovoReport(contract, [], months);
    if (!report) throw fail();
    const monthlyRows = includeMappings ? mapGlovoMonthlyRows(contract.rows, mappedValues[0], mappedValues[1]) : undefined;
    // Latest source month has no independent closing evidence. Reading later is
    // not proof of full coverage; keep current/future calendar months partial too.
    const calendarMonth = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit"}).format(new Date());
    const incompleteMonths = months.filter(month => month === months.at(-1) || month >= calendarMonth);
    return { report, latestEventMonth: months.at(-1)!, lastReadAt: new Date().toISOString(),
      ...(monthlyRows ? {monthlyRows, incompleteMonths} : {}) };
  } catch { throw fail(); }
}
