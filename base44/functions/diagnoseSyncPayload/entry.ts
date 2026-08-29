import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const transactionId = body.transactionId || body.transaction_id;
    if (!transactionId) {
      return Response.json({ error: 'transactionId is required' }, { status: 400 });
    }

    // 1. Load Transaction
    const txList = await base44.asServiceRole.entities.Transaction.filter({ id: transactionId });
    if (!txList || txList.length === 0) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const tx = txList[0];

    // 2. Load Material
    const matList = await base44.asServiceRole.entities.Material.filter({ id: tx.material_id });
    if (!matList || matList.length === 0) {
      return Response.json({ error: 'Material not found' }, { status: 404 });
    }
    const material = matList[0];

    // 3. Load BuildrIntegrationConfig
    const configList = await base44.asServiceRole.entities.BuildrIntegrationConfig.filter({
      company_id: tx.company_id,
      is_active: true
    });
    if (!configList || configList.length === 0) {
      return Response.json({ error: `No active BuildrIntegrationConfig found for company ${tx.company_id}` }, { status: 404 });
    }
    const config = configList[0];

    // 4. Resolve secret
    const receiverUrl = config.buildr_receiver_url;
    const sharedSecretRef = config.buildr_shared_secret_ref;
    const sharedSecret = Deno.env.get(sharedSecretRef);

    // 5. Build exact payload (mirrors syncTransactionToBuildr)
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

    // 6. POST to Buildr receiver
    const response = await fetch(receiverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sharedSecret}`
      },
      body: JSON.stringify(payload)
    });

    // 7. Capture full response
    const rawText = await response.text();
    let parsedJson = null;
    try { parsedJson = JSON.parse(rawText); } catch { /* not JSON */ }

    // Capture response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return Response.json({
      diagnostic: {
        request: {
          url: receiverUrl,
          payload,
          auth_header_present: !!sharedSecret,
          secret_ref_used: sharedSecretRef
        },
        transaction: {
          company_id: tx.company_id,
          buildr_project_id: tx.buildr_project_id,
          type: tx.type,
          quantity: tx.quantity
        },
        response: {
          http_status: response.status,
          headers: responseHeaders,
          raw_text: rawText,
          parsed_json: parsedJson
        }
      }
    });

  } catch (error) {
    console.error('[diagnoseSyncPayload ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});