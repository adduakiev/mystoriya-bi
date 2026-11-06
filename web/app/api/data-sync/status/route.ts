import { NextResponse } from "next/server";

// Historical run metadata cannot confirm a new import while imports are paused.
// Keep this gate unconditional until separately reviewed release approval.
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      done: false,
      code: "SALES_IMPORT_SAFETY_GATE",
      error: "Оновлення призупинено: імпорт тимчасово недоступний. Наявні дані збережено."
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
