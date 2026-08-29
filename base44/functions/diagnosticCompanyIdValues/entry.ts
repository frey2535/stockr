import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allMaterials = await base44.asServiceRole.entities.Material.list();

    // Get unique company_id values
    const uniqueCompanyIds = [...new Set(
      allMaterials.map(m => {
        if (m.company_id === null) return 'NULL';
        if (m.company_id === undefined) return 'UNDEFINED';
        if (m.company_id === '') return 'EMPTY_STRING';
        return m.company_id;
      })
    )];

    // Count each value
    const companyCounts = {};
    uniqueCompanyIds.forEach(val => {
      companyCounts[val] = allMaterials.filter(m => {
        if (val === 'NULL') return m.company_id === null;
        if (val === 'UNDEFINED') return m.company_id === undefined;
        if (val === 'EMPTY_STRING') return m.company_id === '';
        return m.company_id === val;
      }).length;
    });

    // Get sample from first non-null company_id
    const sampleMaterial = allMaterials.find(m => m.company_id);

    return Response.json({
      uniqueCompanyIdValues: uniqueCompanyIds,
      companyCounts: companyCounts,
      sampleMaterialWithCompanyId: sampleMaterial ? {
        id: sampleMaterial.id,
        name: sampleMaterial.name,
        company_id: sampleMaterial.company_id,
        company_id_type: typeof sampleMaterial.company_id,
        company_id_stringified: JSON.stringify(sampleMaterial.company_id)
      } : null,
      first3Materials: allMaterials.slice(0, 3).map(m => ({
        id: m.id,
        name: m.name,
        company_id: m.company_id,
        company_id_type: typeof m.company_id
      }))
    });

  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error.message);
    return Response.json({ 
      error: error.message || 'Server error'
    }, { status: 500 });
  }
});