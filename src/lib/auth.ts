import { cache } from "react";
import { cookies, headers } from "next/headers";
import { deleteSession, getAccount, getSession } from "./db";
import { SITE_HOST, isCanonicalHost } from "./site";
import type { Account } from "./types";

export const SESSION_COOKIE = "stockr_session";

async function sessionCookieBase() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const proto = headerStore.get("x-forwarded-proto") || "";
  const canonical = isCanonicalHost(host);
  const https = proto === "https" || canonical;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: https,
    ...(canonical ? { domain: SITE_HOST } : {}),
  };
}

export async function setSessionCookie(sessionId: string, expiresAt: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    ...(await sessionCookieBase()),
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const current = store.get(SESSION_COOKIE)?.value;
  if (current) await deleteSession(current);
  store.set(SESSION_COOKIE, "", {
    ...(await sessionCookieBase()),
    expires: new Date(0),
  });
}

async function readCurrentAccount(includeMembers: boolean): Promise<Account | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  if (!session) return null;
  return getAccount(session.user_id, session.company_id, { members: includeMembers });
}

/** Dedupe session + account lookups within one RSC/request. */
export const getCurrentAccount = cache(() => readCurrentAccount(true));

/** API routes do not need the team roster on every tab fetch. */
export const getCurrentAccountLite = cache(() => readCurrentAccount(false));
