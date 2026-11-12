import { NextResponse } from "next/server";

// No environment override: the installed batch writer is not atomic. Remove this
// gate only with a reviewed transactional importer and separate release approval.
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "SALES_IMPORT_SAFETY_GATE",
      error: "Оновлення тимчасово недоступне: готуємо безпечний імпорт. Наявні дані збережено."
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
