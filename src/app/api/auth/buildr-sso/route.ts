import { NextResponse } from "next/server";
import { applySessionCookie } from "@/lib/auth";
import { bootstrapBuildrFamilyAppSso } from "@/lib/buildr";
import { familySsoTokenFromSearch, verifyFamilySsoToken } from "@/lib/buildr-sso";
import { createSession, ensureBuildrSsoIdentity } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

function errorRedirect(request: Request, code: string) {
  const url = new URL("/login", requestOrigin(request));
  url.searchParams.set("error", "buildr_sso");
  url.searchParams.set("reason", code);
  return NextResponse.redirect(url, 303);
}

/**
 * Buildr sidebar launch: verify SSO, bootstrap the Buildr identity (same login +
 * company ID), create a Stockr session, and land on the dashboard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = familySsoTokenFromSearch(url.searchParams);
  const verified = verifyFamilySsoToken(token);
  if ("error" in verified) return errorRedirect(request, verified.error);

  const claims = verified.claims;
  const queryCompanyId = String(
    url.searchParams.get("company_id") || url.searchParams.get("app_tenant_binding_company_id") || "",
  ).trim();
  if (queryCompanyId && claims.company_id && queryCompanyId !== claims.company_id) {
    return errorRedirect(request, "company_mismatch");
  }

  const bootstrap = await bootstrapBuildrFamilyAppSso(token, "stockr");
  if (!bootstrap.valid) {
    // Fall back to an already-linked workspace when Buildr bootstrap is unreachable.
    const identity = await ensureBuildrSsoIdentity({
      email: claims.email!,
      name: String(url.searchParams.get("name") || claims.email || "").trim(),
      buildrCompanyId: claims.company_id!,
      role: claims.role,
    });
    if (!identity) return errorRedirect(request, bootstrap.error || "stockr_account_not_linked");
    const session = await createSession(identity.userId, identity.companyId);
    const next = url.searchParams.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    const response = NextResponse.redirect(new URL(safeNext, requestOrigin(request)), 303);
    await applySessionCookie(response, session.id, session.expiresAt);
    return response;
  }

  const identity = await ensureBuildrSsoIdentity({
    email: bootstrap.email!,
    name: bootstrap.name,
    buildrCompanyId: bootstrap.company_id!,
    companyName: bootstrap.company_name,
    passwordHash: bootstrap.password_hash,
    role: bootstrap.role || claims.role,
  });
  if (!identity) return errorRedirect(request, "stockr_account_not_linked");

  const session = await createSession(identity.userId, identity.companyId);
  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const response = NextResponse.redirect(new URL(safeNext, requestOrigin(request)), 303);
  await applySessionCookie(response, session.id, session.expiresAt);
  return response;
}
