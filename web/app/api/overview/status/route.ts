import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from "@/lib/auth";
import { loadSalesDataStatus } from "@/lib/data/source";
import { warehouseObservation } from "@/lib/overview-freshness";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// Read-only metadata; no import progress, importer, cache invalidation or client
// supplied cache keys. Explicit auth also protects direct route invocation.
export async function GET(request: NextRequest) {
  const password = process.env.BI_ACCESS_PASSWORD;
  if (!password) return NextResponse.json({ error: "Unavailable" }, { status: 503, headers });
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!safeEqual(token, await createAccessToken(password))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const observation = warehouseObservation(await loadSalesDataStatus());
    return NextResponse.json(observation, { status: observation.cutoff ? 200 : 503, headers });
  } catch {
    return NextResponse.json({ error: "Status unavailable; retry GET" }, { status: 503, headers });
  }
}
