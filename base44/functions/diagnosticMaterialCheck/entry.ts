import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get total count of ALL materials
    const allMaterials = await base44.asServiceRole.entities.Material.list();
    const totalCount = allMaterials.length;

    // 2. Get materials where company_id = "co_dayonelectric"
    const withCompanyId = await base44.asServiceRole.entities.Material.filter({
      company_id: "co_dayoneelectric"
    });
    const withCompanyIdCount = withCompanyId.length;

    // 3. Get materials where company_id is null/undefined/empty
    const missingCompanyId = allMaterials.filter(
      m => m.company_id === null || 
           m.company_id === undefined || 
           m.company_id === ''
    );
    const missingCount = missingCompanyId.length;

    // 4. Get first 5 records with company_id = "co_dayoneelectric"
    const first5 = withCompanyId.slice(0, 5).map(m => ({
      id: m.id,
      name: m.name,
      company_id: m.company_id,
      company_id_stringified: JSON.stringify(m.company_id)
    }));

    return Response.json({
      totalMaterialCount: totalCount,
      withCompanyIdCount: withCompanyIdCount,
      missingCompanyIdCount: missingCount,
      first5WithCompanyId: first5,
      allMaterialsCount: allMaterials.length,
      withCompanyIdDataCount: withCompanyId.length
    });

  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error.message);
    return Response.json({ 
      error: error.message || 'Server error',
      fullError: String(error)
    }, { status: 500 });
  }
});