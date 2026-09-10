import { cookies } from "next/headers";
import { deleteSession, getAccount, getSession } from "./db";
import { SITE_HOST } from "./site";
import type { Account } from "./types";

export const SESSION_COOKIE = "stockr_session";

export async function setSessionCookie(sessionId: string, expiresAt: string) {
  const store = await cookies();
  const production = process.env.NODE_ENV === "production";
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    secure: production,
    ...(production ? { domain: SITE_HOST } : {}),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  const current = store.get(SESSION_COOKIE)?.value;
  if (current) deleteSession(current);
  store.delete(SESSION_COOKIE);
}

export async function getCurrentAccount(): Promise<Account | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = getSession(sessionId);
  if (!session) return null;
  return getAccount(session.user_id, session.company_id);
}
