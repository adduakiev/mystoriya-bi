import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { callBiRpc } from "@/lib/data/source";
import { authorizedSalesRefresh, refreshHeaders, salesRequestId, verifiedAtomicSuccess, type AtomicSyncProgress } from "@/lib/sales-refresh";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!await authorizedSalesRefresh(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: refreshHeaders });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: refreshHeaders });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
    if (body.completedRequestId !== undefined) {
      const id = salesRequestId(body.completedRequestId);
      if (!id) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: refreshHeaders });
      const progress = await callBiRpc<AtomicSyncProgress>("bi_atomic_sync_progress", { p_request_id: id }, 10_000);
      if (!verifiedAtomicSuccess(progress, id)) {
        return NextResponse.json({ ok: false, error: "Оновлення ще не підтверджене." }, { status: 409, headers: refreshHeaders });
      }
      revalidateTag("sales-data");
      revalidateTag("sales-data-status");
      revalidatePath("/", "layout");
      return NextResponse.json({ ok: true, ...progress }, { headers: refreshHeaders });
    }
    if (Object.keys(body).length) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: refreshHeaders });
    const result = await callBiRpc<{ requestId?: string | number; alreadyRunning?: boolean }>("bi_trigger_atomic_sync", {}, 10_000);
    const id = salesRequestId(result.requestId);
    if (!id) throw new Error("Missing request receipt");
    return NextResponse.json({ ok: true, requestId: id, alreadyRunning: result.alreadyRunning === true }, { status: 202, headers: refreshHeaders });
  } catch {
    return NextResponse.json({ ok: false, error: "Не вдалося запустити або підтвердити оновлення. Наявний звіт збережено." }, { status: 503, headers: refreshHeaders });
  }
}
