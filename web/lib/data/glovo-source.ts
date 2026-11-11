import "server-only";

/** Server read boundary, intentionally disconnected. The prepared private Sales
 * reader is pinned to another spreadsheet/range; it grants no Glovo access.
 * Wire an exact authorized descriptor here only after separate source review.
 * Never fall back to public CSV, Sales RPC, P&L snapshots or test fixtures.
 */
export async function loadGlovoSource() {
  return {
    status: "SOURCE UNAVAILABLE" as const,
    reason: "Авторизоване приватне джерело Glovo не підключене до BI. Дані та оновлення недоступні.",
    latestEventMonth: null,
    lastReadAt: null,
    report: null
  };
}
