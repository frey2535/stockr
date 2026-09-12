export const SITE_HOST =
  process.env.NEXT_PUBLIC_STOCKR_HOST || "stockr.currentflowconsulting.org";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${SITE_HOST}`
).replace(/\/$/, "");

export const SITE_ORIGIN = new URL(SITE_URL).origin;

export const ANDROID_PACKAGE_NAME = "org.currentflowconsulting.stockr";
export const ANDROID_APP_NAME = "Stockr";
export const LEGAL_ENTITY = "CurrentFlow Consulting";
export const SUPPORT_EMAIL = "stockr@currentflowconsulting.org";
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
export const ANDROID_APK_PATH = "/downloads/stockr.apk";

export function hostWithoutPort(host: string | null | undefined) {
  return (host || "").split(":")[0].toLowerCase();
}

export function isCanonicalHost(host: string | null | undefined) {
  return hostWithoutPort(host) === SITE_HOST;
}
