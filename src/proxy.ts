import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/db";
import { SITE_HOST } from "@/lib/site";

const SESSION_COOKIE = "stockr_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/scanner",
  "/inventory",
  "/locations",
  "/transfers",
  "/activity",
  "/catalog",
  "/purchase-orders",
  "/reports",
  "/settings",
  "/billing",
];

const AUTH_PAGES = new Set(["/login", "/signup", "/signin", "/sign-in", "/sign-up"]);

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function expireSessionCookie(response: NextResponse) {
  const blank = {
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax" as const,
  };
  response.cookies.set(SESSION_COOKIE, "", blank);
  response.cookies.set(SESSION_COOKIE, "", { ...blank, domain: SITE_HOST });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const session = sessionId ? await getSession(sessionId) : null;
  const authed = Boolean(session);

  if (isProtected(pathname) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    if (sessionId) expireSessionCookie(response);
    return response;
  }

  if (authed && AUTH_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (sessionId && !session) {
    const response = NextResponse.next();
    expireSessionCookie(response);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/scanner/:path*",
    "/inventory/:path*",
    "/locations/:path*",
    "/transfers/:path*",
    "/activity/:path*",
    "/catalog/:path*",
    "/purchase-orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/sign-up",
  ],
};
