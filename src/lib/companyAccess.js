import { base44 } from "@/api/base44Client";

/**
 * Fetch the full User record with company_id
 * Returns { company_id, email, full_name, id, role }
 */
export async function getFullUserRecord(userEmail) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    if (users.length === 0) {
      return null;
    }
    return users[0];
  } catch (error) {
    console.error(`Failed to fetch full user record for ${userEmail}:`, error);
    throw error;
  }
}

/**
 * Validate that user's company_id matches the app's bound company_id
 * Returns { isValid: boolean, reason?: string }
 */
export async function validateUserCompanyAccess(userEmail, appBoundCompanyId) {
  if (!appBoundCompanyId) {
    return { isValid: false, reason: "App company binding not configured" };
  }

  const fullUser = await getFullUserRecord(userEmail);
  if (!fullUser) {
    return { isValid: false, reason: "User record not found" };
  }

  if (!fullUser.company_id) {
    return { isValid: false, reason: "User company_id not set" };
  }

  if (fullUser.company_id !== appBoundCompanyId) {
    return {
      isValid: false,
      reason: `User company_id (${fullUser.company_id}) does not match app company_id (${appBoundCompanyId})`
    };
  }

  return { isValid: true };
}