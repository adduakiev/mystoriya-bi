import { unstable_cache } from "next/cache";
import type { SalesRow } from "./types";

const DEFAULT_SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA";
const DEFAULT_SHEET_NAME = "Данние короткі";

const LOCATION_MAPPING: Record<string, string> = {
  "Ахматова NEW": "Ахматова",
  "Европарк NEW": "Європарк",
  "Оболонь NEW": "Оболонь",
  "Теремки NEW": "Теремки",
  "Кудряшова new": "Кудряшова",
  "Парк Авеню NEW": "Парк Авеню",
  "София new": "Софія",
  "Софія (NEW)": "Софія"
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseNumber(value: string): number {
  const normalized = value
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excelSerialToDate(serial: number): Date {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + serial * 86_400_000);
}

function utcDateStrict(year: number, month: number, day: number): Date | null {
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

  return date;
}

function parseSourceDate(value: string): Date | null {
  const clean = value.trim();
  if (!clean) return null;

  const numeric = Number(clean);
  if (Number.isFinite(numeric) && numeric > 30_000 && numeric < 80_000) {
    return excelSerialToDate(numeric);
  }

  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (iso) {
    return utcDateStrict(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // Google gviz returns older source dates in US M/D/YYYY format.
  // Example observed in the source: 1/18/2025.
  const mdy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/);
  if (mdy) {
    return utcDateStrict(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]));
  }

  // Newer source rows are rendered in D.M.YYYY format.
  // Example observed in the source: 04.11.2025.
  const dmy = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/);
  if (dmy) {
    return utcDateStrict(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isGarbage(value: string): boolean {
  return /#REF!|#N\/A|^None$|^nan$/i.test(value.trim());
}

async function fetchAndNormalizeSalesData(): Promise<SalesRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? DEFAULT_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "myastoriya-bi-v2" }
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}`);
  }

  const matrix = parseCsv(await response.text());
  if (matrix.length < 2) return [];

  // Map by position, not duplicate source header names.
  // The Sheet currently contains two columns named "Рік".
  return matrix
    .slice(1)
    .map((row): SalesRow | null => {
      if (row.length < 14) return null;

      const date = parseSourceDate(row[5]);
      if (!date) return null;

      const rawLocation = normalizeText(row[6]);
      const brand = normalizeText(row[7]);
      const ownership = normalizeText(row[8]);
      const channelGroup = normalizeText(row[9]);
      const orderType = normalizeText(row[10]);

      if ([rawLocation, brand, ownership, channelGroup, orderType].some(isGarbage)) {
        return null;
      }

      return {
        date: date.toISOString().slice(0, 10),
        location: LOCATION_MAPPING[rawLocation] ?? rawLocation,
        brand,
        ownership,
        channelGroup,
        orderType,
        revenue: parseNumber(row[11]),
        checks: parseNumber(row[12]),
        markup: parseNumber(row[13])
      };
    })
    .filter((row): row is SalesRow => row !== null);
}


const getCachedSalesData = unstable_cache(
  fetchAndNormalizeSalesData,
  ["myastoriya-sales-data-normalized-v1"],
  {
    revalidate: 600,
    tags: ["sales-data"]
  }
);

export async function loadSalesData(): Promise<SalesRow[]> {
  return getCachedSalesData();
}
