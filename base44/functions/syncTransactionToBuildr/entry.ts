import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── AUTH ─────────────────────────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── INPUT: accept transactionId or transaction_id ─────────────────────────
    const body = await req.json();
    const transactionId = body.transactionId || body.transaction_id;
    if (!transactionId) {
      return Response.json({ error: 'transactionId is required' }, { status: 400 });
    }

    // ── FETCH TRANSACTION FIRST (to get company_id) ──────────────────────────
    const txList = await base44.asServiceRole.entities.Transaction.filter({ id: transactionId });
    if (!txList || txList.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const tx = txList[0];

    if (!tx.company_id) {
      return Response.json({ success: false, reason: 'Transaction missing company_id' });
    }

    // ── LOOKUP BUILDR INTEGRATION CONFIG FOR THIS COMPANY ────────────────────
    const configList = await base44.asServiceRole.entities.BuildrIntegrationConfig.filter({ 
      company_id: tx.company_id,
      is_active: true
    });
    if (!configList || configList.length === 0) {
      return Response.json({ success: false, reason: `No active BuildrIntegrationConfig found for company ${tx.company_id}` });
    }
    const config = configList[0];

    // ── READ PER-COMPANY SECRETS ───────────────────────────────────────────────
    const receiverUrl = config.buildr_receiver_url;
    const sharedSecretRef = config.buildr_shared_secret_ref;
    const sharedSecret = Deno.env.get(sharedSecretRef);
    
    if (!receiverUrl || !sharedSecret) {
      return Response.json({ error: `Missing Buildr config for company ${tx.company_id}: receiverUrl or secret not set` }, { status: 500 });
    }

    // ── VALIDATE TRANSACTION ──────────────────────────────────────────────────
    if (tx.type !== 'use') {
      return Response.json({ success: false, reason: 'Only use transactions are synced to Buildr' });
    }

    if (!tx.buildr_project_id) {
      return Response.json({ success: false, reason: 'Transaction missing buildr_project_id' });
    }

    // ── ALREADY SYNCED ────────────────────────────────────────────────────────
    if (tx.synced_to_buildr && tx.buildr_expense_id) {
      return Response.json({ success: true, reason: 'Already synced', buildr_expense_id: tx.buildr_expense_id });
    }

    // ── FETCH MATERIAL ────────────────────────────────────────────────────────
    const matList = await base44.asServiceRole.entities.Material.filter({ id: tx.material_id });
    if (!matList || matList.length === 0) {
      return Response.json({ success: false, reason: 'Material not found' });
    }
    const material = matList[0];

    if (!(material.unit_cost > 0)) {
      return Response.json({ success: false, reason: 'Material unit_cost must be > 0' });
    }

    if (!(tx.quantity > 0)) {
      return Response.json({ success: false, reason: 'Transaction quantity must be > 0' });
    }

    // ── BUILD PAYLOAD ─────────────────────────────────────────────────────────
    const amount = Math.round(tx.quantity * material.unit_cost * 100) / 100;
    const now = new Date().toISOString();

    const payload = {
      company_id: tx.company_id,
      stockr_transaction_id: tx.id,
      stockr_material_id: tx.material_id,
      buildr_project_id: tx.buildr_project_id,
      material_name: material.name,
      quantity: tx.quantity,
      unit: material.unit || 'each',
      unit_cost: material.unit_cost,
      amount,
      date: tx.created_date || now,
      notes: tx.notes || null,
      vendor: material.supplier || null
    };

    // ── POST TO BUILDR RECEIVER ───────────────────────────────────────────────
    console.log(`[SYNC DEBUG] Sending to Buildr receiver: ${receiverUrl}`);
    console.log(`[SYNC DEBUG] Payload:`, JSON.stringify(payload));
    
    const response = await fetch(receiverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sharedSecret}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`[SYNC DEBUG] Buildr response status: ${response.status}`);

    // ── PARSE RESPONSE SAFELY ─────────────────────────────────────────────────
    const rawText = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch { /* non-JSON response */ }

    // ── SUCCESS ───────────────────────────────────────────────────────────────
    if (response.ok && parsed?.expense_id) {
      await base44.asServiceRole.entities.Transaction.update(transactionId, {
        synced_to_buildr: true,
        buildr_expense_id: parsed.expense_id,
        sync_error: null,
        last_sync_attempt_date: now,
        sync_retry_count: 0
      });

      console.log(`[SYNC SUCCESS] Transaction ${transactionId} → Buildr expense ${parsed.expense_id}`);
      return Response.json({ success: true, buildr_expense_id: parsed.expense_id });
    }

    // ── FAILURE ───────────────────────────────────────────────────────────────
    const errorMsg = parsed?.error || parsed?.message || rawText.slice(0, 300) || `HTTP ${response.status}`;
    console.error(`[SYNC FAILED] Transaction ${transactionId}: ${errorMsg}`);

    await base44.asServiceRole.entities.Transaction.update(transactionId, {
      synced_to_buildr: false,
      sync_error: errorMsg,
      last_sync_attempt_date: now,
      sync_retry_count: (tx.sync_retry_count || 0) + 1
    });

    return Response.json({ success: false, error: errorMsg }, { status: 400 });

  } catch (error) {
    console.error('[syncTransactionToBuildr ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});