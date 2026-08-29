import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return Response.json({ error: 'company_id is required' }, { status: 400 });
    }

    const materials = await base44.asServiceRole.entities.Material.filter({ company_id });
    const withCost = materials.filter(m => m.unit_cost && m.unit_cost > 0);

    if (withCost.length === 0) {
      return Response.json({ error: 'No materials with unit_cost found', total: materials.length });
    }

    const mat = withCost[0];
    return Response.json({
      id: mat.id,
      name: mat.name,
      unit_cost: mat.unit_cost,
      unit: mat.unit
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});