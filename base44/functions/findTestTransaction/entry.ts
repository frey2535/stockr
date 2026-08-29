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

    // Find a "use" transaction with company_id and buildr_project_id
    const txs = await base44.asServiceRole.entities.Transaction.filter({
      company_id,
      type: 'use'
    });

    const eligible = txs.filter(t => t.buildr_project_id && !t.synced_to_buildr);

    if (eligible.length === 0) {
      return Response.json({ 
        message: 'No eligible test transactions found',
        total_use_txs: txs.length,
        synced_count: txs.filter(t => t.synced_to_buildr).length
      });
    }

    const testTx = eligible[0];
    return Response.json({
      transaction_id: testTx.id,
      type: testTx.type,
      company_id: testTx.company_id,
      buildr_project_id: testTx.buildr_project_id,
      material_id: testTx.material_id,
      quantity: testTx.quantity,
      synced_to_buildr: testTx.synced_to_buildr
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});