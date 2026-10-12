import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

type SyncProgress = {
  runId?: string | null;
  status?: "running" | "success" | "failed" | string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cutoffDate?: string | null;
  rowsRead?: number | string | null;
  rowsLoaded?: number | string | null;
  rowsRejected?: number | string | null;
  warehouseRows?: number | string | null;
  warehouseCutoff?: string | null;
};

function isRelevantRun(startedAt: string | null | undefined, after: string | null): boolean {
  if (!after) return true;
  if (!startedAt) return false;

  const started = Date.parse(startedAt);
  const requested = Date.parse(after);

  if (!Number.isFinite(started) || !Number.isFinite(requested)) return false;

  // Allow a small clock/queue skew when the run is created immediately after the request.
  return started >= requested - 2_000;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await callBiRpc<SyncProgress>("bi_sync_progress", {}, 8_000);
    const after = request.nextUrl.searchParams.get("after");
    const relevant = isRelevantRun(payload.startedAt, after);
    const success = relevant && payload.status === "success";
    const failed = relevant && payload.status === "failed";

    if (success) {
      revalidateTag("sales-data");
      revalidateTag("sales-data-status");
      revalidatePath("/", "layout");
    }

    return NextResponse.json(
      {
        ok: true,
        relevant,
        done: success || failed,
        runId: payload.runId ?? null,
        status: relevant ? payload.status ?? null : "waiting",
        startedAt: payload.startedAt ?? null,
        finishedAt: payload.finishedAt ?? null,
        cutoffDate: payload.cutoffDate ?? payload.warehouseCutoff ?? null,
        rowsRead: Number(payload.rowsRead ?? 0),
        rowsLoaded: Number(payload.rowsLoaded ?? 0),
        rowsRejected: Number(payload.rowsRejected ?? 0),
        warehouseRows: Number(payload.warehouseRows ?? 0)
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Cannot read BI sync progress.", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Не вдалося перевірити статус синхронізації."
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
