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
    const locations = await base44.asServiceRole.entities.Location.filter({ company_id });
    const projects = await base44.asServiceRole.entities.Material.filter({ company_id });

    return Response.json({
      materials: materials.length > 0 ? [
        {
          id: materials[0].id,
          name: materials[0].name,
          unit_cost: materials[0].unit_cost
        }
      ] : [],
      locations: locations.length > 0 ? [
        {
          id: locations[0].id,
          name: locations[0].name,
          type: locations[0].type
        }
      ] : [],
      material_count: materials.length,
      location_count: locations.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});