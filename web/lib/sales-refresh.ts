import "server-only";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from "@/lib/auth";

export const refreshHeaders = { "Cache-Control": "no-store" };

export async function authorizedSalesRefresh(request: NextRequest): Promise<boolean> {
  const password = process.env.BI_ACCESS_PASSWORD;
  if (!password) return false;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  return safeEqual(token, await createAccessToken(password));
}

export function salesRequestId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  return typeof value === "string" && /^[1-9]\d{0,17}$/.test(value) ? value : null;
}

export type AtomicSyncProgress = {
  requestId?: string | number;
  done?: boolean;
  status?: string;
  atomic?: boolean;
  runId?: string;
  cutoffDate?: string;
  rowsLoaded?: number;
};

export function verifiedAtomicSuccess(value: AtomicSyncProgress, requestId: string): boolean {
  return salesRequestId(value.requestId) === requestId && value.done === true &&
    value.status === "success" && value.atomic === true &&
    typeof value.runId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.runId) &&
    typeof value.cutoffDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.cutoffDate) &&
    Number.isSafeInteger(value.rowsLoaded) && Number(value.rowsLoaded) > 0;
}
