export const COMPANY_PAGE_SIZE = 25;

export function companyListQuery(input: { q?: string; limit?: number; offset?: number }) {
  const q = String(input.q || "")
    .replace(/[%_,.()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const limit = Math.min(Math.max(input.limit || COMPANY_PAGE_SIZE, 1), 100);
  const offset = Math.max(Math.floor(input.offset || 0), 0);
  return { q, limit, offset };
}

export function canSwitchWorkspace(opts: {
  companyId: string;
  workspaces: { id: string }[];
  platformOwner?: boolean;
  adminOverride?: boolean;
}) {
  const companyId = String(opts.companyId || "").trim();
  if (!companyId) return false;
  if (opts.adminOverride && opts.platformOwner) return true;
  return opts.workspaces.some((row) => row.id === companyId);
}

export function inviteJoinError(input: {
  existingUser: boolean;
  passwordMatches: boolean;
  alreadyMember: boolean;
  seatError: string | null;
}) {
  if (input.existingUser && !input.passwordMatches) {
    return "That email already has an account. Enter the existing password to join this company.";
  }
  if (input.alreadyMember) return null;
  return input.seatError;
}

export function pickLoginCompany(opts: {
  companyIds: string[];
  lastCompanyId?: string | null;
  preferredCompanyId?: string | null;
}) {
  const ids = opts.companyIds.filter(Boolean);
  if (ids.length === 0) return "";
  if (opts.preferredCompanyId && ids.includes(opts.preferredCompanyId)) return opts.preferredCompanyId;
  if (opts.lastCompanyId && ids.includes(opts.lastCompanyId)) return opts.lastCompanyId;
  return ids[0];
}
