import "server-only";
import { normalizeGlovoSheet, buildGlovoReport } from "./glovo-contract";
import { glovoGoogleBearer } from "./glovo-google-auth";
import { glovoPrivateJson, glovoRecord } from "./glovo-private-http";

const ID = "1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98";
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${ID}`;
const META_URL = `${BASE}?fields=spreadsheetId,sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`;
const fail = () => new Error("GLOVO_SOURCE_UNAVAILABLE");

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
export async function readGlovoPrivateSheet(serviceAccountJson: string | undefined, fetchImpl: typeof fetch) {
  try {
    const bearer = await glovoGoogleBearer(serviceAccountJson, fetchImpl);
    const read = (url: string) => {
      if (bearer.expiresAt <= Date.now() + 5000) throw fail();
      return glovoPrivateJson(fetchImpl, url, { method: "GET",
        headers: { Authorization: `Bearer ${bearer.token}`, Accept: "application/json" } });
    };
    const before = grid(await read(META_URL));
    const range = `'Дані'!A5:I${before.rowCount}`;
    const url = `${BASE}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
    const result = await read(url);
    const after = grid(await read(META_URL));
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
    return { report, latestEventMonth: months.at(-1)!, lastReadAt: new Date().toISOString() };
  } catch { throw fail(); }
}
