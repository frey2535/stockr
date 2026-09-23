import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession, resolveBuildrSsoIdentity } from "@/lib/db";

export const runtime = "nodejs";

type FamilyClaims = {
  v?: number;
  aud?: string;
  owner_type?: string;
  owner_id?: string;
  company_id?: string;
  user_id?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

type VerifyResult = { error: string } | { claims: FamilyClaims };

function verifyToken(token: string): VerifyResult {
  const secret = String(process.env.FAMILY_APP_SSO_SECRET || "").trim();
  if (!secret) return { error: "sso_not_configured" as const };

  const [encodedClaims, signature] = String(token || "").split(".");
  if (!encodedClaims || !signature) return { error: "invalid_token" as const };

  const expected = createHmac("sha256", secret).update(encodedClaims).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: "invalid_signature" as const };
  }

  let claims: FamilyClaims;
  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as FamilyClaims;
  } catch {
    return { error: "invalid_claims" as const };
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.v !== 1) return { error: "unsupported_token" as const };
  if (claims.aud !== "stockr") return { error: "wrong_audience" as const };
  if (!claims.exp || claims.exp <= now) return { error: "expired" as const };
  if (!claims.iat || claims.iat > now + 60 || now - claims.iat > 600) {
    return { error: "invalid_issued_at" as const };
  }
  if (!claims.company_id || !claims.email) return { error: "missing_identity" as const };

  return { claims };
}

function stockrOrigin(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function errorRedirect(request: Request, code: string) {
  const url = new URL("/login", stockrOrigin(request));
  url.searchParams.set("error", "buildr_sso");
  url.searchParams.set("reason", code);
  return NextResponse.redirect(url, 303);
}

/**
 * Optional Buildr SSO entry point.
 *
 * Direct Stockr login remains fully independent. This endpoint is used only
 * when an already-authenticated Buildr user launches a Stockr product they own.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("sso_token") || url.searchParams.get("token") || "";
  const verified = verifyToken(token);
  if ("error" in verified) return errorRedirect(request, verified.error);

  const claims = verified.claims;
  const queryCompanyId = String(url.searchParams.get("company_id") || "").trim();
  if (queryCompanyId && queryCompanyId !== claims.company_id) {
    return errorRedirect(request, "company_mismatch");
  }

  const identity = await resolveBuildrSsoIdentity(claims.email!, claims.company_id!);
  if (!identity) {
    // Do not create a Stockr user or workspace here. The customer must already
    // own/provision Stockr independently, preserving standalone operation.
    return errorRedirect(request, "stockr_account_not_linked");
  }

  const session = await createSession(identity.userId, identity.companyId);
  await setSessionCookie(session.id, session.expiresAt);

  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(new URL(safeNext, stockrOrigin(request)), 303);
}
