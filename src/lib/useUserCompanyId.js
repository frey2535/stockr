import { useAuth } from '@/lib/AuthContext';
import { useEffect, useState } from 'react';

/**
 * Hook to resolve the active company context for the current user
 * 
 * TENANT USERS: Always resolves from user.company_id or user.data.company_id only
 * - Never falls back to sessionStorage, user.id, or any other source
 * - Must start with "co_" prefix; invalid IDs are cleared and treated as null
 * 
 * PLATFORM ADMINS: Uses sessionStorage.activeCompanyId only when valid
 * - Only if it starts with "co_" prefix
 * - Invalid IDs are automatically cleared from sessionStorage
 * 
 * Returns { activeCompanyId, loading, error, userType, selectCompany(id), clearCompany() }
 */
export function useUserCompanyId() {
  // ALL hooks must be called unconditionally at the top — Rules of Hooks
  const { user } = useAuth();
  const [sessionCompanyId, setSessionCompanyId] = useState(null);

  // Load and validate sessionStorage on mount (platform admins only)
  useEffect(() => {
    const stored = sessionStorage.getItem('activeCompanyId');
    if (stored && typeof stored === 'string' && stored.startsWith('co_')) {
      setSessionCompanyId(stored);
    } else if (stored) {
      sessionStorage.removeItem('activeCompanyId');
    }
  }, []);

  // Helper: validate company ID format
  const isValidCompanyId = (id) => id && typeof id === 'string' && id.startsWith('co_');

  const selectCompany = (companyId) => {
    if (isValidCompanyId(companyId)) {
      sessionStorage.setItem('activeCompanyId', companyId);
      setSessionCompanyId(companyId);
    }
  };

  const clearCompany = () => {
    sessionStorage.removeItem('activeCompanyId');
    setSessionCompanyId(null);
  };

  // No user yet — still loading
  if (!user) {
    return { activeCompanyId: null, loading: true, error: null, userType: null, selectCompany, clearCompany };
  }

  // TENANT USER: Use ONLY user.company_id or user.data.company_id
  const userCompanyId = user?.company_id || user?.data?.company_id || null;

  if (userCompanyId) {
    if (!isValidCompanyId(userCompanyId)) {
      console.error('[useUserCompanyId] Tenant has invalid company_id:', userCompanyId);
      return { activeCompanyId: null, loading: false, error: 'Invalid company context', userType: 'tenant', selectCompany: null, clearCompany: null };
    }
    return { activeCompanyId: userCompanyId, loading: false, error: null, userType: 'tenant', selectCompany: null, clearCompany: null };
  }

  // PLATFORM ADMIN: Use sessionStorage.activeCompanyId only if valid
  const resolvedSessionId = (sessionCompanyId && isValidCompanyId(sessionCompanyId)) ? sessionCompanyId : null;

  return {
    activeCompanyId: resolvedSessionId,
    loading: false,
    error: null,
    userType: 'platform_admin',
    selectCompany,
    clearCompany
  };
}