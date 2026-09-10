import { cookies, headers } from "next/headers";
import { deleteSession, getAccount, getSession } from "./db";
import { SITE_HOST, isCanonicalHost } from "./site";
import type { Account } from "./types";

export const SESSION_COOKIE = "stockr_session";

export async function setSessionCookie(sessionId: string, expiresAt: string) {
  const store = await cookies();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const proto = headerStore.get("x-forwarded-proto") || "";
  const canonical = isCanonicalHost(host);
  const https = proto === "https" || canonical;
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    secure: https,
    ...(canonical ? { domain: SITE_HOST } : {}),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const current = store.get(SESSION_COOKIE)?.value;
  if (current) await deleteSession(current);
  store.delete(SESSION_COOKIE);
}

export async function getCurrentAccount(): Promise<Account | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  if (!session) return null;
  return getAccount(session.user_id, session.company_id);
}
