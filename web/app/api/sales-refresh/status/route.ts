import { NextRequest, NextResponse } from "next/server";
import { callBiRpc } from "@/lib/data/source";
import { authorizedSalesRefresh, refreshHeaders, salesRequestId, verifiedAtomicSuccess, type AtomicSyncProgress } from "@/lib/sales-refresh";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await authorizedSalesRefresh(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: refreshHeaders });
  }
  const id = salesRequestId(request.nextUrl.searchParams.get("requestId"));
  if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: refreshHeaders });
  try {
    const value = await callBiRpc<AtomicSyncProgress>("bi_atomic_sync_progress", { p_request_id: id }, 10_000);
    if (salesRequestId(value.requestId) !== id) throw new Error("Wrong request receipt");
    if (verifiedAtomicSuccess(value, id)) {
      return NextResponse.json({ ok: true, ...value }, { headers: refreshHeaders });
    }
    if (value.done === true && value.status === "failed") {
      return NextResponse.json({ ok: true, requestId: id, done: true, status: "failed" }, { headers: refreshHeaders });
    }
    if (value.done === true) throw new Error("Unverified completion");
    return NextResponse.json({ ok: true, requestId: id, done: false, status: value.status === "unknown" ? "unknown" : "running" }, { headers: refreshHeaders });
  } catch {
    return NextResponse.json({ ok: false, error: "Статус оновлення поки недоступний." }, { status: 503, headers: refreshHeaders });
  }
}
