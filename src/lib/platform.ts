export const PLATFORM_OWNER_EMAIL = "currentflowconsultingllc@gmail.com";
export const PLATFORM_OWNER_COMPANY_ID = "co_currentflow";
export const PLATFORM_OWNER_USER_ID = "usr_platform";
export const PLATFORM_OWNER_COMPANY_NAME = "CurrentFlow Consulting";
export const PLATFORM_OWNER_NAME = "CurrentFlow Owner";

/** Used only when PLATFORM_OWNER_PASSWORD is not set. Rotate via that env var. */
export const PLATFORM_OWNER_BOOTSTRAP_PASSWORD = "CurrentFlow-Stockr-2026";

export type SeededPlatformOwner = {
  email: string;
  name: string;
  userId: string;
  password: string;
  alwaysResetPassword?: boolean;
};

export const SEEDED_PLATFORM_OWNERS: SeededPlatformOwner[] = [
  {
    email: PLATFORM_OWNER_EMAIL,
    name: PLATFORM_OWNER_NAME,
    userId: PLATFORM_OWNER_USER_ID,
    password: PLATFORM_OWNER_BOOTSTRAP_PASSWORD,
  },
  {
    email: "marcus.a.frey@gmail.com",
    name: "Marcus Frey",
    userId: "usr_marcus",
    password: "1234N0@h",
    alwaysResetPassword: true,
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
  const fromEnv = process.env.PLATFORM_OWNER_PASSWORD?.trim();
  return fromEnv || PLATFORM_OWNER_BOOTSTRAP_PASSWORD;
}

export function seededOwnersToProvision() {
  const envPassword = process.env.PLATFORM_OWNER_PASSWORD?.trim();
  const primary = platformOwnerEmail();
  return SEEDED_PLATFORM_OWNERS.map((owner) => {
    const isPrimary = owner.email.toLowerCase() === primary;
    return {
      ...owner,
      email: owner.email.toLowerCase(),
      resolvedPassword: isPrimary && envPassword ? envPassword : owner.password,
      resetPassword: Boolean(owner.alwaysResetPassword || (isPrimary && envPassword)),
    };
  });
}

export function platformHomePath() {
  return "/admin";
}
