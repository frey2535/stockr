export const PLATFORM_OWNER_EMAIL = "currentflowconsultingllc@gmail.com";
export const PLATFORM_OWNER_COMPANY_ID = "co_currentflow";
export const PLATFORM_OWNER_USER_ID = "usr_platform";
export const PLATFORM_OWNER_COMPANY_NAME = "CurrentFlow Consulting";
export const PLATFORM_OWNER_NAME = "CurrentFlow Owner";

/** Used only when PLATFORM_OWNER_PASSWORD is not set. Rotate via that env var. */
export const PLATFORM_OWNER_BOOTSTRAP_PASSWORD = "CurrentFlow-Stockr-2026";

function splitEmails(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function platformOwnerEmail() {
  return (process.env.PLATFORM_OWNER_EMAIL || PLATFORM_OWNER_EMAIL).trim().toLowerCase();
}

export function platformOwnerEmails() {
  return new Set([platformOwnerEmail(), ...splitEmails(process.env.PLATFORM_OWNER_EMAILS)]);
}

export function isPlatformOwner(email: string | null | undefined) {
  if (!email) return false;
  return platformOwnerEmails().has(email.trim().toLowerCase());
}

export function platformOwnerPassword() {
  const fromEnv = process.env.PLATFORM_OWNER_PASSWORD?.trim();
  return fromEnv || PLATFORM_OWNER_BOOTSTRAP_PASSWORD;
}

export function platformHomePath() {
  return "/admin";
}
