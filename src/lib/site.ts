export const SITE_HOST =
  process.env.NEXT_PUBLIC_STOCKR_HOST || "stockr.currentflowconsulting.org";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${SITE_HOST}`
).replace(/\/$/, "");

export const SITE_ORIGIN = new URL(SITE_URL).origin;
