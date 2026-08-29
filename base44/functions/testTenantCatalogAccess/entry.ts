import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Test what happens when mfrey@dayoneelectric.com logs in
 * - Gets user context
 * - Resolves company_id from user.company_id
 * - Queries Material.filter({ company_id })
 * - Returns full result
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Simulate useUserCompanyId hook
    const userCompanyId = user.company_id || user.data?.company_id || null;

    if (!userCompanyId || !userCompanyId.startsWith('co_')) {
      return Response.json({
        status: 'invalid_company_id',
        email: user.email,
        resolved_company_id: userCompanyId,
        is_valid: false
      });
    }

    // Query materials exactly as Catalog does
    const materials = await base44.entities.Material.filter({
      company_id: userCompanyId
    });

    return Response.json({
      status: 'success',
      email: user.email,
      resolved_company_id: userCompanyId,
      materials_count: materials.length,
      first_5_names: materials.slice(0, 5).map(m => m.name)
    });

  } catch (error) {
    return Response.json({ 
      error: error.message || 'Server error'
    }, { status: 500 });
  }
});