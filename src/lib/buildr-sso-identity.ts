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
 * Prefers an already-linked workspace, then a unique membership, then a unique admin/owner membership.
 * New Buildr-bundled users are created by ensureBuildrSsoIdentity via bootstrap.
 */
export function pickBuildrSsoCompany(
  candidates: BuildrSsoCandidate[],
  buildrCompanyId: string,
  lastCompanyId = "",
): BuildrSsoCandidate | null {
  const target = String(buildrCompanyId || "").trim();
  if (!target || candidates.length === 0) return null;

  const alreadyLinked = candidates.filter(
    (row) => sameCompanyId(row.buildrCompanyId, target) || sameCompanyId(row.companyId, target),
  );
  if (alreadyLinked.length === 1) return alreadyLinked[0];
  if (alreadyLinked.length > 1) {
    return alreadyLinked.find((row) => row.buildrLinked) || alreadyLinked[0];
  }

  if (candidates.length === 1) return candidates[0];

  const admins = candidates.filter((row) => isAdminRole(row.role));
  if (admins.length === 1) return admins[0];

  const last = String(lastCompanyId || "").trim();
  if (last) return candidates.find((row) => sameCompanyId(row.companyId, last)) || null;

  return null;
}

export function buildrSsoLoginMessage(reason: string) {
  switch (String(reason || "").trim()) {
    case "sso_not_configured":
      return "Stockr is not configured to accept Buildr sign-in.";
    case "expired":
    case "invalid_issued_at":
      return "That Buildr sign-in link expired. Open Stockr from Buildr again.";
    case "stockr_account_not_linked":
      return "Buildr could not open Stockr for this company yet. Confirm Stockr is granted, you have Access Control permission, and Stockr can reach Buildr SSO.";
    case "company_mismatch":
      return "That Buildr company does not match this Stockr workspace.";
    case "invalid_token":
    case "invalid_signature":
    case "invalid_claims":
    case "unsupported_token":
    case "wrong_audience":
    case "missing_identity":
      return "Could not verify that Buildr sign-in link. Open Stockr from Buildr again.";
    default:
      return "Could not sign you in from Buildr. Open Stockr from Buildr again, or sign in with email.";
  }
}

export function shouldPersistBuildrLink(
  company: BuildrSsoCandidate,
  buildrCompanyId: string,
  candidates: BuildrSsoCandidate[] = [company],
) {
  const existing = String(company.buildrCompanyId || "").trim();
  const target = String(buildrCompanyId || "").trim();
  if (existing && existing !== target) return false;
  if (existing === target) return true;
  if (sameCompanyId(company.companyId, target)) return true;
  return candidates.length === 1;
}
