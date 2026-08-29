import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Simulates what Catalog.jsx does when a user loads the page
 * - Gets user from auth
 * - Resolves activeCompanyId (simulating useUserCompanyId hook)
 * - Calls Material.filter with that company_id
 * - Returns what the frontend should see
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CATALOG DIAGNOSTIC] User:', {
      email: user.email,
      company_id: user.company_id,
      data_company_id: user.data?.company_id,
      is_platform_admin: user.is_platform_admin,
      role: user.role
    });

    // Simulate useUserCompanyId hook logic
    const userCompanyId = user?.company_id || user?.data?.company_id || null;
    
    if (!userCompanyId) {
      return Response.json({
        status: 'no_company_id',
        userEmail: user.email,
        userIsAdmin: user.is_platform_admin,
        message: 'User is platform admin with no company selected',
        activeCompanyId: null
      });
    }

    console.log('[CATALOG DIAGNOSTIC] Resolved activeCompanyId:', userCompanyId);

    // Now try the exact query that Catalog does
    console.log('[CATALOG DIAGNOSTIC] Calling Material.filter({ company_id: ' + userCompanyId + ' })');
    
    const materials = await base44.entities.Material.filter({
      company_id: userCompanyId
    });

    console.log('[CATALOG DIAGNOSTIC] Filter result:', {
      length: materials.length,
      first3: materials.slice(0, 3).map(m => ({ id: m.id, name: m.name, company_id: m.company_id }))
    });

    return Response.json({
      status: 'success',
      userEmail: user.email,
      userIsAdmin: user.is_platform_admin,
      activeCompanyId: userCompanyId,
      materialsCount: materials.length,
      first3Materials: materials.slice(0, 3).map(m => ({
        id: m.id,
        name: m.name,
        company_id: m.company_id
      }))
    });

  } catch (error) {
    console.error('[CATALOG DIAGNOSTIC] Error:', error.message);
    return Response.json({ 
      error: error.message || 'Server error',
      fullError: String(error)
    }, { status: 500 });
  }
});