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

    if (char === """) {
      if (quoted && next === """) {
        field += """;
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

function parseSourceDate(value: string): Date | null {
  const clean = value.trim();
  if (!clean) return null;

  const numeric = Number(clean);
  if (Number.isFinite(numeric) && numeric > 30_000 && numeric < 80_000) {
    return excelSerialToDate(numeric);
  }

  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  const dmy = clean.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isGarbage(value: string): boolean {
  return /#REF!|#N\/A|^None$|^nan$/i.test(value.trim());
}

export async function loadSalesData(): Promise<SalesRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? DEFAULT_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    next: { revalidate: 600 },
    headers: { "User-Agent": "myastoriya-bi-v2" }
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}`);
  }

  const matrix = parseCsv(await response.text());
  if (matrix.length < 2) return [];

  // We intentionally map by position, not duplicate header names.
  // Source currently contains two columns named "Рік".
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

      const location = LOCATION_MAPPING[rawLocation] ?? rawLocation;

      return {
        date: date.toISOString().slice(0, 10),
        location,
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
