// Pure fail-closed source preflight. No network, secrets, database writes or runtime state.
const REQUIRED = [
  [5, "Обліковий день"], [6, "Зі складу"], [7, "Бренд"],
  [8, "Власність"], [9, "Доставка"], [10, "Тип замовлення"],
  [11, "Сума зі знижкою, грн."], [12, "Чеків"], [13, "Націнка, грн."]
];

function normalized(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

function numeric(value, rowNumber, column) {
  const text = normalized(value);
  if (!/^[+-]?(?:\d+|\d{1,3}(?: \d{3})+)(?:[.,]\d+)?$/.test(text)) {
    throw new Error(`SOURCE_PREFLIGHT_INVALID_NUMBER row=${rowNumber} column=${column}`);
  }
  // Prevent source amounts below one kopiyka from being silently rounded away
  // by aggregation/toFixed(2) before the database can check precision.
  // Decimal trailing zeroes are harmless and remain accepted (1.2300 -> 1.23).
  if ((column === 11 || column === 13) &&
      /[1-9]/.test((text.split(/[.,]/)[1] ?? "").slice(2))) {
    throw new Error(`SOURCE_PREFLIGHT_SUB_CENT row=${rowNumber} column=${column}`);
  }
  const result = Number(text.replace(/ /g, "").replace(",", "."));
  if (!Number.isFinite(result)) {
    throw new Error(`SOURCE_PREFLIGHT_NONFINITE row=${rowNumber} column=${column}`);
  }
  return result;
}

function excelSerialToIso(serial) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + serial * 86_400_000).toISOString().slice(0, 10);
}

function strictIso(year, month, day) {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function parseSourceDate(value) {
  const clean = value.trim();
  if (!clean) return null;

  const numeric = Number(clean);
  if (Number.isFinite(numeric) && numeric > 30_000 && numeric < 80_000) {
    return excelSerialToIso(numeric);
  }

  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (iso) return strictIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const mdy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/);
  if (mdy) return strictIso(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]));

  const dmy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/);
  if (dmy) return strictIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  return null;
}

// Runs before any RPC that changes fact_sales_daily. This is defense in depth;
// staging + transactional promotion are STILL REQUIRED to prevent partial-batch writes.
export function assertSalesCsvPreflight(matrix, { previousRowCount = null } = {}) {
  if (!Array.isArray(matrix) || matrix.length < 2 || !Array.isArray(matrix[0])) {
    throw new Error("SOURCE_PREFLIGHT_EMPTY_OR_NOT_CSV");
  }
  const header = matrix[0];
  if (header.length < 14) throw new Error("SOURCE_PREFLIGHT_HEADER_WIDTH");
  for (const [column, expected] of REQUIRED) {
    if (normalized(header[column]) !== expected) {
      throw new Error(`SOURCE_PREFLIGHT_HEADER_MISMATCH column=${column}`);
    }
  }
  const rawRows = matrix.length - 1;
  if (previousRowCount !== null && previousRowCount !== undefined) {
    const lastAccepted = Number(previousRowCount);
    if (Number.isFinite(lastAccepted) && lastAccepted >= 100 &&
        rawRows < Math.floor(lastAccepted * 0.95)) {
      throw new Error(`SOURCE_PREFLIGHT_HISTORICAL_SHRINK rows=${rawRows} previous=${lastAccepted}`);
    }
  }
  for (let index = 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    const rowNumber = index + 1;
    if (!Array.isArray(row) || row.length < 14) {
      throw new Error(`SOURCE_PREFLIGHT_ROW_WIDTH row=${rowNumber}`);
    }
    for (const column of [5, 6, 7, 8, 9, 10]) {
      const value = normalized(row[column]);
      if (!value || /#REF!|#N\/A|^None$|^nan$/i.test(value)) {
        throw new Error(`SOURCE_PREFLIGHT_MISSING_DIMENSION row=${rowNumber} column=${column}`);
      }
    }
    if (parseSourceDate(normalized(row[5])) === null) {
      throw new Error(`SOURCE_PREFLIGHT_INVALID_DATE row=${rowNumber} column=5`);
    }
    numeric(row[11], rowNumber, 11);
    const checks = numeric(row[12], rowNumber, 12);
    if (!Number.isSafeInteger(checks) || checks < 0) {
      throw new Error(`SOURCE_PREFLIGHT_INVALID_CHECKS row=${rowNumber}`);
    }
    numeric(row[13], rowNumber, 13);
  }
  return { rawRows };
}
