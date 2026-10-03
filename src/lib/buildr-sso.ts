import { createHmac, timingSafeEqual } from "node:crypto";

export type FamilySsoClaims = {
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

export type FamilySsoVerifyResult = { error: string } | { claims: FamilySsoClaims };

export function familySsoTokenFromSearch(search: URLSearchParams) {
  return (
    search.get("sso_token") ||
    search.get("token") ||
    search.get("sso") ||
    ""
  ).trim();
}

export function familySsoSearch(search: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of [
    "sso_token",
    "token",
    "sso",
    "company_id",
    "app_tenant_binding_company_id",
    "email",
    "next",
    "source",
    "app_id",
    "tenant_binding_id",
  ]) {
    const value = search.get(key);
    if (value) next.set(key, value);
  }
  return next;
}

function hmacHex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function signaturesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyFamilySsoToken(token: string, now = Math.floor(Date.now() / 1000)): FamilySsoVerifyResult {
  const secret = String(process.env.FAMILY_APP_SSO_SECRET || "").trim();
  if (!secret) return { error: "sso_not_configured" };

  const parts = String(token || "").split(".");
  if (parts.length < 2 || !parts[0] || !parts[1]) return { error: "invalid_token" };

  const encodedClaims = parts.length === 3 ? parts[1] : parts[0];
  const signature = parts.length === 3 ? parts[2] : parts[1];
  const signed = parts.length === 3 ? `${parts[0]}.${parts[1]}` : encodedClaims;
  if (!signaturesMatch(signature, hmacHex(secret, signed)) && !signaturesMatch(signature, hmacHex(secret, encodedClaims))) {
    return { error: "invalid_signature" };
  }

  let claims: FamilySsoClaims;
  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as FamilySsoClaims;
  } catch {
    return { error: "invalid_claims" };
  }

  if (claims.v != null && claims.v !== 1) return { error: "unsupported_token" };
  const audience = String(claims.aud || "").trim().toLowerCase();
  if (audience && audience !== "stockr") return { error: "wrong_audience" };
  if (!claims.exp || claims.exp <= now) return { error: "expired" };
  if (claims.iat && (claims.iat > now + 120 || now - claims.iat > 30 * 60)) {
    return { error: "invalid_issued_at" };
  }
  const email = String(claims.email || "").trim();
  const companyId = String(claims.company_id || claims.owner_id || "").trim();
  if (!companyId || !email) return { error: "missing_identity" };

  return { claims: { ...claims, email, company_id: companyId } };
}
