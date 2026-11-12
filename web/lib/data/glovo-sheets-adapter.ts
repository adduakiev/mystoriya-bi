import "server-only";
import { normalizeGlovoSheet, buildGlovoReport } from "./glovo-contract";

// OFFLINE PREPARATION ONLY. No default transport or runtime caller.
// Authorization is a caller assertion, not a credential or proof of Google access.
export const GLOVO_SHEETS_REQUEST = Object.freeze({
  spreadsheetId: "1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98",
  range: "'Дані'!A5:I",
  method: "GET",
  url: "https://sheets.googleapis.com/v4/spreadsheets/1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98/values/" +
    encodeURIComponent("'Дані'!A5:I") + "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE",
  majorDimension: "ROWS",
  valueRenderOption: "UNFORMATTED_VALUE",
  scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
  redirect: "error"
} as const);

export type GlovoSheetsTransport = Readonly<{
  authorization: Readonly<{
    spreadsheetId: typeof GLOVO_SHEETS_REQUEST.spreadsheetId;
    scope: typeof GLOVO_SHEETS_REQUEST.scope;
  }>;
  // Any supplied transport must enforce redirect:error before sending
  // authorization, consume the whole response, and supply parsed JSON only.
  getValues: (request: typeof GLOVO_SHEETS_REQUEST) => Promise<Readonly<{
    status: number;
    url: string;
    redirected: boolean;
    contentType: string;
    body: unknown;
  }>>;
}>;

export type GlovoSheetsCoverage = Readonly<{
  // Independent evidence for this exact matrix, not values.length inferred as
  // completeness. Includes header and interior blank rows, excludes trailing blanks.
  matrixComplete: true;
  expectedMatrixRows: number;
  // Independently verified complete local months; row presence is insufficient.
  verifiedMonths: readonly string[];
}>;

type PreparedResult = {
  status: "OFFLINE PREPARED";
  report: NonNullable<ReturnType<typeof buildGlovoReport>>;
} | {
  status: "SOURCE UNAVAILABLE";
  report: null;
  reason: "AUTHORIZATION_REQUIRED" | "COVERAGE_REQUIRED" | "INVALID_RESPONSE" | "INVALID_MATRIX" | "TRANSPORT_FAILED";
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) =>
  Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const unavailable = (reason: Extract<PreparedResult, { report: null }>['reason']): PreparedResult =>
  ({ status: "SOURCE UNAVAILABLE", report: null, reason });
const blankOrMeasure = (value: unknown, count: boolean) => value === "" ||
  (typeof value === "number" && Number.isFinite(value) && value >= 0 && (!count || Number.isSafeInteger(value)));

/** Test-injected transport seam only; deliberately NOT imported by glovo-source.
 * No default transport, auth discovery, token requests, logs or fallback readers.
 * Transport metadata/coverage are trusted caller assertions, not upstream proof.
 */
export async function prepareGlovoSheetReport(
  transport: GlovoSheetsTransport,
  coverage: GlovoSheetsCoverage
): Promise<PreparedResult> {
  try {
    if (!record(transport) || typeof transport.getValues !== "function" ||
        !record(transport.authorization) || !keys(transport.authorization, ["spreadsheetId", "scope"]) ||
        transport.authorization.spreadsheetId !== GLOVO_SHEETS_REQUEST.spreadsheetId ||
        transport.authorization.scope !== GLOVO_SHEETS_REQUEST.scope) return unavailable("AUTHORIZATION_REQUIRED");
    if (!record(coverage) || !keys(coverage, ["matrixComplete", "expectedMatrixRows", "verifiedMonths"]) ||
        coverage.matrixComplete !== true || !Number.isSafeInteger(coverage.expectedMatrixRows) || coverage.expectedMatrixRows < 2 ||
        !Array.isArray(coverage.verifiedMonths) ||
        coverage.verifiedMonths.some(month => typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) ||
        new Set(coverage.verifiedMonths).size !== coverage.verifiedMonths.length) return unavailable("COVERAGE_REQUIRED");
    // Snapshot evidence before yielding to a caller-supplied async dependency.
    const expectedRows = coverage.expectedMatrixRows;
    const verifiedMonths = [...coverage.verifiedMonths];
    const response: unknown = await transport.getValues(GLOVO_SHEETS_REQUEST);
    if (!record(response) || !keys(response, ["status", "url", "redirected", "contentType", "body"]) ||
        response.status !== 200 || response.url !== GLOVO_SHEETS_REQUEST.url || response.redirected !== false ||
        typeof response.contentType !== "string" || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.contentType)) {
      return unavailable("INVALID_RESPONSE");
    }
    const body = response.body;
    if (!record(body) || !keys(body, ["range", "majorDimension", "values"]) || body.majorDimension !== "ROWS" ||
        typeof body.range !== "string" || !Array.isArray(body.values) || body.values.length !== expectedRows) {
      return unavailable("INVALID_MATRIX");
    }
    // Values.get returns the resolved grid range, which can extend past the last
    // populated row. It is not a row-count/completeness attestation.
    const range = /^'Дані'!A5:I([1-9]\d*)$/.exec(body.range);
    if (!range || !Number.isSafeInteger(Number(range[1])) || Number(range[1]) < expectedRows + 4) {
      return unavailable("INVALID_MATRIX");
    }
    const values: unknown[][] = body.values;
    for (const [index, cells] of values.entries()) {
      if (!Array.isArray(cells) || cells.length > 9 || Array.from(cells).some(cell => typeof cell !== "string" &&
          (typeof cell !== "number" || !Number.isFinite(cell)))) return unavailable("INVALID_MATRIX");
      if (index === 0 || cells.length === 0 || cells.every(cell => cell === "")) continue;
      if (cells.length !== 9 || !blankOrMeasure(cells[5], true) || !blankOrMeasure(cells[6], false) ||
          (cells[8] !== 0 && cells[8] !== 1)) return unavailable("INVALID_MATRIX");
    }
    const contract = normalizeGlovoSheet(values);
    if (contract.status !== "valid" || contract.rows.length === 0) return unavailable("INVALID_MATRIX");
    if (verifiedMonths.some(month => !contract.rows.some(row => row.month === month))) return unavailable("COVERAGE_REQUIRED");
    const report = buildGlovoReport(contract, verifiedMonths);
    return report ? { status: "OFFLINE PREPARED", report } : unavailable("INVALID_MATRIX");
  } catch {
    // Never expose upstream bodies, exception messages, source rows or auth data.
    return unavailable("TRANSPORT_FAILED");
  }
}
