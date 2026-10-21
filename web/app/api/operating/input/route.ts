import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from "@/lib/auth";
import { collectInput } from "@/lib/operating-collector";
import { callBiRpc } from "@/lib/data/source";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.BI_ACCESS_PASSWORD;
  if (!secret || !safeEqual(request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "", await createAccessToken(secret)))
    return NextResponse.json({error:"Unauthorized"}, {status:401, headers:{"Cache-Control":"no-store"}});
  try {
    const packet = await collectInput(name => callBiRpc(name));
    return NextResponse.json(packet, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Aggregate input failed contract validation"},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
