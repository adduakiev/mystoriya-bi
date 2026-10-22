import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from '@/lib/auth';
import { manualRunAvailability, requestManualRun } from '@/lib/operating-manual';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function authorized(request: NextRequest) {
  const secret=process.env.BI_ACCESS_PASSWORD;
  return Boolean(secret && safeEqual(request.cookies.get(AUTH_COOKIE_NAME)?.value??'',await createAccessToken(secret)));
}
export async function GET(request: NextRequest) {
  if(!await authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  return NextResponse.json(manualRunAvailability(process.env.OPERATING_MANUAL_RUN_ENABLED==='1'),{headers});
}
export async function POST(request: NextRequest) {
  if(!await authorized(request))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
  if(request.headers.get('origin')!==request.nextUrl.origin || request.headers.get('sec-fetch-site')==='cross-site')
    return NextResponse.json({error:'Same-origin request required'},{status:403,headers});
  return NextResponse.json(await requestManualRun(process.env.OPERATING_MANUAL_RUN_ENABLED==='1'),{status:503,headers});
}
