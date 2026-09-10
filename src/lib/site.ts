export const SITE_HOST =
  process.env.NEXT_PUBLIC_STOCKR_HOST || "stockr.currentflowconsulting.org";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${SITE_HOST}`
).replace(/\/$/, "");

export const SITE_ORIGIN = new URL(SITE_URL).origin;

export function hostWithoutPort(host: string | null | undefined) {
  return (host || "").split(":")[0].toLowerCase();
}

export function isCanonicalHost(host: string | null | undefined) {
  return hostWithoutPort(host) === SITE_HOST;
}
