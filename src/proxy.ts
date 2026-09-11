import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("stockr_session")?.value;
  const authed = Boolean(session);

  if (isProtected(pathname) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (
    authed &&
    (pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/signin" ||
      pathname === "/sign-in")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
