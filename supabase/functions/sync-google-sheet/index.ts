import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA";
const SHEET_NAME = "Данние короткі";
const BATCH_SIZE = 2000;


async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type SyncRow = {
  accounting_date: string;
  location_raw: string;
  brand: string;
  ownership: string;
  channel_group: string;
  order_type: string;
  revenue: number;
  checks: number;
  markup: number;
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

function excelSerialToIso(serial: number): string {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + serial * 86_400_000).toISOString().slice(0, 10);
}

function strictIso(year: number, month: number, day: number): string | null {
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

function parseSourceDate(value: string): string | null {
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

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isGarbage(value: string): boolean {
  return /#REF!|#N\/A|^None$|^nan$/i.test(value.trim());
}

function aggregateRows(matrix: string[][], locationMap: Map<string, string>) {
  const aggregated = new Map<string, SyncRow>();
  let rejected = 0;

  for (const row of matrix.slice(1)) {
    if (row.length < 14) {
      rejected += 1;
      continue;
    }

    const accountingDate = parseSourceDate(row[5]);
    const rawLocation = normalizeText(row[6]);
    const location = locationMap.get(rawLocation) ?? rawLocation;
    const brand = normalizeText(row[7]);
    const ownership = normalizeText(row[8]);
    const channelGroup = normalizeText(row[9]);
    const orderType = normalizeText(row[10]);

    if (
      !accountingDate ||
      [location, brand, ownership, channelGroup, orderType].some((value) => !value || isGarbage(value))
    ) {
      rejected += 1;
      continue;
    }

    const key = [
      accountingDate,
      location,
      brand,
      ownership,
      channelGroup,
      orderType
    ].join("|");

    const current = aggregated.get(key) ?? {
      accounting_date: accountingDate,
      location_raw: location,
      brand,
      ownership,
      channel_group: channelGroup,
      order_type: orderType,
      revenue: 0,
      checks: 0,
      markup: 0
    };

    current.revenue += parseNumber(row[11]);
    current.checks += parseNumber(row[12]);
    current.markup += parseNumber(row[13]);
    aggregated.set(key, current);
  }

  const rows = [...aggregated.values()].map((row) => ({
    ...row,
    revenue: Number(row.revenue.toFixed(2)),
    checks: Number(row.checks.toFixed(2)),
    markup: Number(row.markup.toFixed(2))
  }));

  return { rows, rejected };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase runtime credentials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const presentedSyncKey = req.headers.get("x-bi-sync-key") ?? "";
  const { data: syncConfig, error: syncConfigError } = await supabase
    .from("bi_runtime_config")
    .select("value_hash")
    .eq("config_key", "sync_key")
    .maybeSingle();

  if (
    syncConfigError ||
    !syncConfig?.value_hash ||
    (await sha256Hex(presentedSyncKey)) !== syncConfig.value_hash
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const recentCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: recentRun } = await supabase
    .from("import_runs")
    .select("id,status,started_at")
    .eq("source_name", "google_sheets:Данние короткі")
    .gte("started_at", recentCutoff)
    .in("status", ["running", "success"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentRun) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "recent_sync_exists",
        import_run_id: recentRun.id,
        status: recentRun.status
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      }
    );
  }

  const { data: run, error: runError } = await supabase
    .from("import_runs")
    .insert({
      source_name: "google_sheets:Данние короткі",
      status: "running"
    })
    .select("id")
    .single();

  if (runError || !run) {
    return new Response(JSON.stringify({ error: "Cannot create import run", details: runError?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const runId = run.id;

  try {
    const url =
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "myastoriya-bi-sync" }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const matrix = parseCsv(await response.text());
    const rawRows = Math.max(0, matrix.length - 1);

    const { data: locationMappings, error: mappingError } = await supabase
      .from("map_location_source")
      .select("source_name,canonical_name");

    if (mappingError) {
      throw new Error(`Cannot load location mappings: ${mappingError.message}`);
    }

    const locationMap = new Map<string, string>(
      (locationMappings ?? []).map((item) => [item.source_name, item.canonical_name])
    );

    const { rows, rejected } = aggregateRows(matrix, locationMap);

    const sourceTotals = rows.reduce(
      (acc, row) => {
        acc.revenue += row.revenue;
        acc.checks += row.checks;
        acc.markup += row.markup;
        return acc;
      },
      { revenue: 0, checks: 0, markup: 0 }
    );

    sourceTotals.revenue = Number(sourceTotals.revenue.toFixed(2));
    sourceTotals.checks = Number(sourceTotals.checks.toFixed(2));
    sourceTotals.markup = Number(sourceTotals.markup.toFixed(2));

    let loaded = 0;

    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rows.slice(offset, offset + BATCH_SIZE);
      const { data, error } = await supabase.rpc("sync_sales_batch", {
        p_rows: batch,
        p_import_run_id: runId
      });

      if (error) throw new Error(`Batch ${offset / BATCH_SIZE + 1}: ${error.message}`);
      loaded += Number(data ?? batch.length);
    }

    const cutoffDate = rows.reduce(
      (max, row) => (row.accounting_date > max ? row.accounting_date : max),
      rows[0]?.accounting_date ?? null
    );

    const { data: finalized, error: finalizeError } = await supabase.rpc(
      "finalize_sales_snapshot",
      { p_import_run_id: runId }
    );

    if (finalizeError) {
      throw new Error(`Cannot finalize warehouse snapshot: ${finalizeError.message}`);
    }

    const warehouseTotals = {
      revenue: Number(finalized?.revenue ?? 0),
      checks: Number(finalized?.checks ?? 0),
      markup: Number(finalized?.markup ?? 0)
    };

    const reconciliation = {
      revenue_diff: Number((warehouseTotals.revenue - sourceTotals.revenue).toFixed(2)),
      checks_diff: Number((warehouseTotals.checks - sourceTotals.checks).toFixed(2)),
      markup_diff: Number((warehouseTotals.markup - sourceTotals.markup).toFixed(2))
    };

    if (
      Math.abs(reconciliation.revenue_diff) > 0.01 ||
      Math.abs(reconciliation.checks_diff) > 0.01 ||
      Math.abs(reconciliation.markup_diff) > 0.01
    ) {
      await supabase.from("data_quality_issues").insert({
        import_run_id: runId,
        issue_type: "warehouse_reconciliation_mismatch",
        severity: "error",
        details: {
          source_totals: sourceTotals,
          warehouse_totals: warehouseTotals,
          reconciliation
        }
      });
    }

    if (rejected > 0) {
      await supabase.from("data_quality_issues").insert({
        import_run_id: runId,
        issue_type: "source_rows_rejected",
        severity: "warning",
        details: { rows_rejected: rejected }
      });
    }

    const { error: finishError } = await supabase
      .from("import_runs")
      .update({
        finished_at: new Date().toISOString(),
        source_cutoff_date: cutoffDate,
        rows_read: rawRows,
        rows_loaded: loaded,
        rows_rejected: rejected,
        status: "success",
        details: {
          aggregated_rows: rows.length,
          batch_size: BATCH_SIZE,
          deleted_stale_rows: Number(finalized?.deleted_stale_rows ?? 0),
          source_totals: sourceTotals,
          warehouse_totals: warehouseTotals,
          reconciliation
        }
      })
      .eq("id", runId);

    if (finishError) throw new Error(`Cannot finalize import run: ${finishError.message}`);

    return new Response(
      JSON.stringify({
        ok: true,
        import_run_id: runId,
        rows_read: rawRows,
        aggregated_rows: rows.length,
        rows_loaded: loaded,
        rows_rejected: rejected,
        cutoff_date: cutoffDate,
        deleted_stale_rows: Number(finalized?.deleted_stale_rows ?? 0),
        reconciliation
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from("import_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        details: { error: message }
      })
      .eq("id", runId);

    return new Response(JSON.stringify({ ok: false, error: message, import_run_id: runId }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
