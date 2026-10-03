export type BuildrSsoCandidate = {
  companyId: string;
  role: string;
  buildrLinked?: boolean;
  buildrCompanyId?: string | null;
};

function sameCompanyId(left: string | null | undefined, right: string) {
  return String(left || "").trim() === String(right || "").trim();
}

function isAdminRole(role: string) {
  const value = String(role || "").trim().toLowerCase();
  return value === "owner" || value === "admin";
}

/**
 * Pick an existing Stockr workspace for a verified Buildr SSO identity.
 *
 * Never creates a user or company. Prefers an already-linked workspace,
 * then a unique membership, then a unique admin/owner membership.
 */
export function pickBuildrSsoCompany(
  candidates: BuildrSsoCandidate[],
  buildrCompanyId: string,
): BuildrSsoCandidate | null {
  const target = String(buildrCompanyId || "").trim();
  if (!target || candidates.length === 0) return null;

  const alreadyLinked = candidates.filter((row) => sameCompanyId(row.buildrCompanyId, target));
  if (alreadyLinked.length === 1) return alreadyLinked[0];
  if (alreadyLinked.length > 1) {
    return alreadyLinked.find((row) => row.buildrLinked) || alreadyLinked[0];
  }

  if (candidates.length === 1) return candidates[0];

  const admins = candidates.filter((row) => isAdminRole(row.role));
  if (admins.length === 1) return admins[0];

  return null;
}

export function shouldPersistBuildrLink(company: BuildrSsoCandidate, buildrCompanyId: string) {
  const existing = String(company.buildrCompanyId || "").trim();
  return !existing || existing === String(buildrCompanyId || "").trim();
}
