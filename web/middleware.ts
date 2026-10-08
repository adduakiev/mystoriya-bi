import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken, safeEqual } from "./lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const configuredPassword = process.env.BI_ACCESS_PASSWORD;

  if (!configuredPassword) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "config");
    return NextResponse.redirect(loginUrl);
  }

  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expectedSession = await createAccessToken(configuredPassword);

  if (session && safeEqual(session, expectedSession)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff|woff2)$).*)"
  ]
};
