import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  createAccessToken,
  safeEqual
} from "@/lib/auth";

function safeNext(value: FormDataEntryValue | null): string {
  const candidate = typeof value === "string" ? value : "/";

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/login")
  ) {
    return "/";
  }

  return candidate;
}

export async function POST(request: NextRequest) {
  const configuredPassword = process.env.BI_ACCESS_PASSWORD;
  const formData = await request.formData();
  const nextPath = safeNext(formData.get("next"));

  if (!configuredPassword) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "config");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const submittedPassword = String(formData.get("password") ?? "");

  if (!safeEqual(submittedPassword, configuredPassword)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: await createAccessToken(configuredPassword),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}
