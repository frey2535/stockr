export const PLATFORM_OWNER_EMAIL = "currentflowconsultingllc@gmail.com";
export const PLATFORM_OWNER_COMPANY_ID = "co_currentflow";
export const PLATFORM_OWNER_USER_ID = "usr_platform";
export const PLATFORM_OWNER_COMPANY_NAME = "CurrentFlow Consulting";
export const PLATFORM_OWNER_NAME = "CurrentFlow Owner";

export type SeededPlatformOwner = {
  email: string;
  name: string;
  userId: string;
};

export const SEEDED_PLATFORM_OWNERS: SeededPlatformOwner[] = [
  {
    email: PLATFORM_OWNER_EMAIL,
    name: PLATFORM_OWNER_NAME,
    userId: PLATFORM_OWNER_USER_ID,
  },
  {
    email: "marcus.a.frey@gmail.com",
    name: "Marcus Frey",
    userId: "usr_marcus",
  },
];

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
  return new Set([
    platformOwnerEmail(),
    ...SEEDED_PLATFORM_OWNERS.map((owner) => owner.email.toLowerCase()),
    ...splitEmails(process.env.PLATFORM_OWNER_EMAILS),
  ]);
}

export function isPlatformOwner(email: string | null | undefined) {
  if (!email) return false;
  return platformOwnerEmails().has(email.trim().toLowerCase());
}

export function platformOwnerPassword() {
  return process.env.PLATFORM_OWNER_PASSWORD?.trim() || "";
}

export function seededOwnersToProvision() {
  const password = platformOwnerPassword();
  if (!password) return [];
  const primary = platformOwnerEmail();
  return SEEDED_PLATFORM_OWNERS.map((owner) => ({
    ...owner,
    email: owner.email.toLowerCase(),
    resolvedPassword: password,
    resetPassword: false,
    isPrimary: owner.email.toLowerCase() === primary,
  }));
}

export function platformHomePath() {
  return "/admin";
}
