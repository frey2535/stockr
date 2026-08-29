import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_SYNC_RETRIES = 5;
const RETRY_DELAY_MINUTES = 15;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── AUTH: allow scheduler (no user) or admin users only ──────────────────
    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      console.warn(`[RETRY] Unauthorized direct call by non-admin: ${user.email}`);
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ── FETCH ALL ACTIVE COMPANIES ────────────────────────────────────────────
    const companies = await base44.asServiceRole.entities.CompanyDirectory.filter({ is_active: true });
    if (!companies || companies.length === 0) {
      console.log('[RETRY] No active companies found.');
      return Response.json({ success: true, retried: 0, reason: 'No active companies', companies: [] });
    }

    console.log(`[RETRY] Processing ${companies.length} active company/companies: ${companies.map(c => c.company_id).join(', ')}`);

    const now = new Date();
    const allResults = [];

    // ── PROCESS EACH COMPANY IN ISOLATION ─────────────────────────────────────
    for (const company of companies) {
      const companyId = company.company_id;

      // Fetch only this company's unsynced "use" transactions with a project id
      const unsynced = await base44.asServiceRole.entities.Transaction.filter({
        company_id: companyId,
        synced_to_buildr: false,
        type: 'use'
      });

      const useWithProject = unsynced.filter(tx => tx.buildr_project_id);
      const useWithoutProject = unsynced.filter(tx => !tx.buildr_project_id);

      console.log(`[RETRY][${companyId}] Total unsynced use txs: ${unsynced.length}, with project: ${useWithProject.length}, without: ${useWithoutProject.length}`);

      const companyResult = {
        company_id: companyId,
        company_name: company.company_name,
        eligible: useWithProject.length,
        skipped_no_project: useWithoutProject.length,
        retried: 0,
        succeeded: 0,
        failed: 0,
        details: []
      };

      if (useWithProject.length === 0) {
        console.log(`[RETRY][${companyId}] No eligible transactions.`);
        allResults.push(companyResult);
        continue;
      }

      // ── LOAD BUILDR CONFIG FOR THIS COMPANY ──────────────────────────────────
      const configList = await base44.asServiceRole.entities.BuildrIntegrationConfig.filter({
        company_id: companyId,
        is_active: true
      });

      if (!configList || configList.length === 0) {
        console.warn(`[RETRY][${companyId}] No active BuildrIntegrationConfig — skipping all transactions.`);
        companyResult.details.push({ result: 'SKIPPED', reason: 'No active BuildrIntegrationConfig' });
        allResults.push(companyResult);
        continue;
      }

      const config = configList[0];
      const receiverUrl = config.buildr_receiver_url;
      const sharedSecret = Deno.env.get(config.buildr_shared_secret_ref);

      if (!receiverUrl || !sharedSecret) {
        console.warn(`[RETRY][${companyId}] Missing receiverUrl or secret — skipping.`);
        companyResult.details.push({ result: 'SKIPPED', reason: 'Missing receiverUrl or shared secret' });
        allResults.push(companyResult);
        continue;
      }

      // ── PROCESS EACH TRANSACTION FOR THIS COMPANY ────────────────────────────
      for (const txStale of useWithProject) {
        // Reload fresh copy to avoid stale retry count
        const freshList = await base44.asServiceRole.entities.Transaction.filter({ id: txStale.id });
        if (!freshList || freshList.length === 0) {
          console.warn(`[RETRY][${companyId}] Transaction ${txStale.id} not found on reload — skipping.`);
          continue;
        }
        const tx = freshList[0];

        // Confirm company_id still matches (safety check)
        if (tx.company_id !== companyId) {
          console.error(`[RETRY][${companyId}] company_id mismatch on tx ${tx.id} — skipping.`);
          continue;
        }

        // Skip if max retries exceeded
        if ((tx.sync_retry_count || 0) >= MAX_SYNC_RETRIES) {
          console.log(`[RETRY][${companyId}] Transaction ${tx.id}: Max retries exceeded.`);
          continue;
        }

        // Skip if within backoff window
        if (tx.last_sync_attempt_date) {
          const minutesSince = (now - new Date(tx.last_sync_attempt_date)) / (1000 * 60);
          if (minutesSince < RETRY_DELAY_MINUTES) {
            console.log(`[RETRY][${companyId}] Transaction ${tx.id}: Backoff ${minutesSince.toFixed(1)}/${RETRY_DELAY_MINUTES} min.`);
            continue;
          }
        }

        companyResult.retried++;
        console.log(`[RETRY][${companyId}] Attempting tx ${tx.id}, retry count ${tx.sync_retry_count || 0}/${MAX_SYNC_RETRIES}`);

        // Load material — scoped by company_id for safety
        const matList = await base44.asServiceRole.entities.Material.filter({ id: tx.material_id, company_id: companyId });
        if (!matList || matList.length === 0) {
          companyResult.failed++;
          companyResult.details.push({ transaction_id: tx.id, result: 'FAILED', reason: 'Material not found' });
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            sync_error: 'Material not found',
            sync_retry_count: (tx.sync_retry_count || 0) + 1,
            last_sync_attempt_date: now.toISOString()
          });
          continue;
        }
        const material = matList[0];

        if (!(material.unit_cost > 0)) {
          companyResult.failed++;
          companyResult.details.push({ transaction_id: tx.id, result: 'FAILED', reason: 'Material unit_cost must be > 0' });
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            sync_error: 'Material unit_cost must be > 0',
            sync_retry_count: (tx.sync_retry_count || 0) + 1,
            last_sync_attempt_date: now.toISOString()
          });
          continue;
        }

        // Build payload
        const amount = Math.round(tx.quantity * material.unit_cost * 100) / 100;
        const payload = {
          company_id: companyId,
          stockr_transaction_id: tx.id,
          stockr_material_id: tx.material_id,
          buildr_project_id: tx.buildr_project_id,
          material_name: material.name,
          quantity: tx.quantity,
          unit: material.unit || 'each',
          unit_cost: material.unit_cost,
          amount,
          date: tx.created_date || now.toISOString(),
          notes: tx.notes || null,
          vendor: material.supplier || null
        };

        console.log(`[RETRY][${companyId}] Posting tx ${tx.id} to ${receiverUrl}`);

        const response = await fetch(receiverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sharedSecret}`
          },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(rawText); } catch { /* non-JSON */ }

        console.log(`[RETRY][${companyId}] Response for tx ${tx.id}: HTTP ${response.status}`);

        if (response.ok && parsed?.expense_id) {
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            synced_to_buildr: true,
            buildr_expense_id: parsed.expense_id,
            sync_error: null,
            sync_retry_count: 0,
            last_sync_attempt_date: now.toISOString()
          });
          companyResult.succeeded++;
          companyResult.details.push({ transaction_id: tx.id, result: 'SUCCESS', buildr_expense_id: parsed.expense_id });
          console.log(`[RETRY][${companyId}] SUCCESS tx ${tx.id} → Buildr expense ${parsed.expense_id}`);
        } else {
          const errorMsg = parsed?.error || parsed?.message || rawText.slice(0, 300) || `HTTP ${response.status}`;
          await base44.asServiceRole.entities.Transaction.update(tx.id, {
            sync_error: errorMsg,
            sync_retry_count: (tx.sync_retry_count || 0) + 1,
            last_sync_attempt_date: now.toISOString()
          });
          companyResult.failed++;
          companyResult.details.push({ transaction_id: tx.id, result: 'FAILED', sync_error: errorMsg });
          console.warn(`[RETRY][${companyId}] FAILED tx ${tx.id}: ${errorMsg}`);
        }
      }

      allResults.push(companyResult);
    }

    const totalRetried = allResults.reduce((s, r) => s + r.retried, 0);
    const totalSucceeded = allResults.reduce((s, r) => s + r.succeeded, 0);
    const totalFailed = allResults.reduce((s, r) => s + r.failed, 0);

    console.log(`[RETRY COMPLETE] Companies: ${companies.length}, Retried: ${totalRetried}, Succeeded: ${totalSucceeded}, Failed: ${totalFailed}`);

    return Response.json({
      success: true,
      companies_processed: companies.length,
      total_retried: totalRetried,
      total_succeeded: totalSucceeded,
      total_failed: totalFailed,
      per_company: allResults
    });

  } catch (error) {
    console.error('[retryFailedBuildrSyncs ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});