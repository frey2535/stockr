import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { company_id, material_id, from_location_id, buildr_project_id, quantity } = await req.json();

    if (!company_id || !material_id || !from_location_id || !buildr_project_id) {
      return Response.json({ 
        error: 'Required: company_id, material_id, from_location_id, buildr_project_id' 
      }, { status: 400 });
    }

    // Create the transaction
    const tx = await base44.asServiceRole.entities.Transaction.create({
      type: 'use',
      material_id,
      from_location_id,
      company_id,
      buildr_project_id,
      quantity: quantity || 5,
      notes: 'Test transaction for Buildr sync'
    });

    return Response.json({
      transaction_id: tx.id,
      type: tx.type,
      company_id: tx.company_id,
      buildr_project_id: tx.buildr_project_id,
      material_id: tx.material_id,
      quantity: tx.quantity
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});