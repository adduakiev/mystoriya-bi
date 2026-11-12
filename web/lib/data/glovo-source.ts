import "server-only";
import type { buildGlovoReport } from "./glovo-contract";
import { readGlovoPrivateSheet } from "./glovo-private-runtime";

/** Private server-only Glovo source. Each page request performs a fresh read;
 * errors expose neither credential details nor upstream bodies. */
export async function loadGlovoSource() {
  try {
    const data = await readGlovoPrivateSheet(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON, fetch);
    return { status: "CONNECTED" as const,
      reason: "Приватне джерело прочитане. Повнота місяців незалежно не підтверджена.", ...data };
  } catch {
    return {
      status: "SOURCE UNAVAILABLE" as const,
      reason: "Приватне джерело Glovo недоступне. Перевірте доступ облікового запису до погодженої таблиці.",
      latestEventMonth: null,
      lastReadAt: null,
      report: null as ReturnType<typeof buildGlovoReport>
    };
  }
}
