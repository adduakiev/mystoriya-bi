import { unstable_cache } from "next/cache";
import type { SalesRow } from "./types";

const DEFAULT_SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA";
const DEFAULT_SHEET_NAME = "Данние короткі";

const BI_SUPABASE_URL = "https://rxewpevxqtfmksybykvo.supabase.co";
const BI_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZXdwZXZ4cXRmbWtzeWJ5a3ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzMwODksImV4cCI6MjEwNjk0OTA4OX0.T9tfpmwYxsy_3KdaVw23NLGy01NlQG7cMOUBkHMJc3k";

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

export type SalesDataStatus = {
  source: "supabase" | "google-sheets";
  cutoffDate: string | null;
  lastSuccessfulSync: string | null;
  warehouseRows: number | null;
  monthlyAggregateRows: number | null;
  weeklyAggregateRows: number | null;
  status: "success" | "fallback";
};

type SalesDataset = {
  rows: SalesRow[];
  status: SalesDataStatus;
};

type SupabaseSnapshotPayload = {
  source?: string;
  meta?: {
    cutoffDate?: string | null;
    lastSuccessfulSync?: string | null;
    warehouseRows?: number | string | null;
    monthlyAggregateRows?: number | string | null;
    weeklyAggregateRows?: number | string | null;
  };
  rows?: unknown[];
};

type SupabaseStatusPayload = {
  source?: string;
  cutoffDate?: string | null;
  lastSuccessfulSync?: string | null;
  warehouseRows?: number | string | null;
  monthlyAggregateRows?: number | string | null;
  weeklyAggregateRows?: number | string | null;
  status?: string;
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

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const mdy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/);
  if (mdy) {
    return utcDateStrict(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]));
  }

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

function supabaseHeaders(): HeadersInit {
  return {
    apikey: BI_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${BI_SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

function unwrapRpcPayload<T>(raw: unknown, functionName: string): T {
  if (
    Array.isArray(raw) &&
    raw.length === 1 &&
    raw[0] &&
    typeof raw[0] === "object" &&
    functionName in (raw[0] as Record<string, unknown>)
  ) {
    return (raw[0] as Record<string, unknown>)[functionName] as T;
  }

  return raw as T;
}

function mapSupabaseRows(rawRows: unknown[]): SalesRow[] {
  const rows: SalesRow[] = [];

  for (const raw of rawRows) {
    if (!Array.isArray(raw) || raw.length < 9) continue;

    const [date, location, brand, ownership, channelGroup, orderType, revenue, checks, markup] = raw;

    if (
      typeof date !== "string" ||
      typeof location !== "string" ||
      typeof brand !== "string" ||
      typeof ownership !== "string" ||
      typeof channelGroup !== "string" ||
      typeof orderType !== "string"
    ) {
      continue;
    }

    rows.push({
      date,
      location,
      brand,
      ownership,
      channelGroup,
      orderType,
      revenue: toNumber(revenue),
      checks: toNumber(checks),
      markup: toNumber(markup)
    });
  }

  return rows;
}

async function fetchSupabaseDataset(password: string): Promise<SalesDataset> {
  const response = await fetch(`${BI_SUPABASE_URL}/rest/v1/rpc/bi_sales_snapshot`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ p_password: password }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    throw new Error(`Supabase snapshot returned ${response.status}`);
  }

  const raw = await response.json();
  const payload = unwrapRpcPayload<SupabaseSnapshotPayload>(raw, "bi_sales_snapshot");
  const rows = mapSupabaseRows(Array.isArray(payload.rows) ? payload.rows : []);

  if (rows.length === 0) {
    throw new Error("Supabase snapshot returned no sales rows");
  }

  return {
    rows,
    status: {
      source: "supabase",
      cutoffDate: payload.meta?.cutoffDate ?? null,
      lastSuccessfulSync: payload.meta?.lastSuccessfulSync ?? null,
      warehouseRows: toNullableNumber(payload.meta?.warehouseRows),
      monthlyAggregateRows: toNullableNumber(payload.meta?.monthlyAggregateRows),
      weeklyAggregateRows: toNullableNumber(payload.meta?.weeklyAggregateRows),
      status: "success"
    }
  };
}

async function fetchGoogleSheetRows(): Promise<SalesRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID ?? DEFAULT_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME ?? DEFAULT_SHEET_NAME;

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "myastoriya-bi-v2" },
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}`);
  }

  const matrix = parseCsv(await response.text());
  if (matrix.length < 2) return [];

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

function cutoffFromRows(rows: SalesRow[]): string | null {
  return rows.reduce<string | null>(
    (max, row) => (max === null || row.date > max ? row.date : max),
    null
  );
}

async function fetchSalesDataset(): Promise<SalesDataset> {
  const password = process.env.BI_ACCESS_PASSWORD;

  if (password) {
    try {
      return await fetchSupabaseDataset(password);
    } catch (error) {
      console.error("Supabase BI snapshot failed; falling back to Google Sheets.", error);
    }
  }

  const rows = await fetchGoogleSheetRows();

  return {
    rows,
    status: {
      source: "google-sheets",
      cutoffDate: cutoffFromRows(rows),
      lastSuccessfulSync: null,
      warehouseRows: null,
      monthlyAggregateRows: null,
      weeklyAggregateRows: null,
      status: "fallback"
    }
  };
}

async function fetchSupabaseStatus(password: string): Promise<SalesDataStatus> {
  const response = await fetch(`${BI_SUPABASE_URL}/rest/v1/rpc/bi_sync_status`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ p_password: password }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new Error(`Supabase status returned ${response.status}`);
  }

  const raw = await response.json();
  const payload = unwrapRpcPayload<SupabaseStatusPayload>(raw, "bi_sync_status");

  return {
    source: "supabase",
    cutoffDate: payload.cutoffDate ?? null,
    lastSuccessfulSync: payload.lastSuccessfulSync ?? null,
    warehouseRows: toNullableNumber(payload.warehouseRows),
    monthlyAggregateRows: toNullableNumber(payload.monthlyAggregateRows),
    weeklyAggregateRows: toNullableNumber(payload.weeklyAggregateRows),
    status: "success"
  };
}

const getCachedSalesDataset = unstable_cache(
  fetchSalesDataset,
  ["myastoriya-sales-dataset-v2"],
  {
    revalidate: 600,
    tags: ["sales-data"]
  }
);

const getCachedSalesStatus = unstable_cache(
  async (): Promise<SalesDataStatus> => {
    const password = process.env.BI_ACCESS_PASSWORD;

    if (password) {
      try {
        return await fetchSupabaseStatus(password);
      } catch (error) {
        console.error("Supabase BI status failed.", error);
      }
    }

    const dataset = await getCachedSalesDataset();
    return dataset.status;
  },
  ["myastoriya-sales-status-v1"],
  {
    revalidate: 60,
    tags: ["sales-data-status"]
  }
);

export async function loadSalesData(): Promise<SalesRow[]> {
  return (await getCachedSalesDataset()).rows;
}

export async function loadSalesDataStatus(): Promise<SalesDataStatus> {
  return getCachedSalesStatus();
}
