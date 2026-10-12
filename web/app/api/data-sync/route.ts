import { NextResponse } from "next/server";
import { callBiRpc } from "@/lib/data/source";

type TriggerPayload = {
  accepted?: boolean;
  alreadyRunning?: boolean;
  requestId?: number | string | null;
  runId?: string | null;
  status?: string | null;
  startedAt?: string | null;
  requestedAt?: string | null;
};

export async function POST() {
  try {
    const payload = await callBiRpc<TriggerPayload>("bi_trigger_sync", {}, 8_000);

    return NextResponse.json(
      {
        ok: true,
        accepted: Boolean(payload.accepted),
        alreadyRunning: Boolean(payload.alreadyRunning),
        requestId: payload.requestId ?? null,
        runId: payload.runId ?? null,
        status: payload.status ?? null,
        startedAt: payload.startedAt ?? null,
        requestedAt: payload.requestedAt ?? new Date().toISOString()
      },
      {
        status: 202,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Cannot trigger BI data sync.", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Не вдалося запустити синхронізацію."
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
