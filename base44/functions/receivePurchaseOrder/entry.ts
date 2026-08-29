import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Receives some or all lines of a purchase order into a destination location.
// For each received line: adds stock to inventory, creates an 'add' transaction
// stamped with the PO number, and updates the line's received_quantity.
// Updates the PO status to 'partial' or 'received' accordingly.
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { purchaseOrderId, receivedLines, toLocationId, company_id } = await req.json();

        // ── AUTHENTICATE USER ────────────────────────────────────────────────────
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }, { status: 401 });
        }

        // ── RESOLVE COMPANY ID ───────────────────────────────────────────────────
        const fullUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const fullUser = fullUsers.length > 0 ? fullUsers[0] : null;
        const isPlatformAdmin = fullUser?.is_platform_admin === true;

        let validatedCompanyId;
        if (isPlatformAdmin) {
            if (!company_id) {
                return Response.json({ error: { code: 'INVALID_REQUEST', message: 'Platform admin must provide company_id' } }, { status: 400 });
            }
            const companyDirs = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id, is_active: true });
            if (companyDirs.length === 0) {
                return Response.json({ error: { code: 'INVALID_COMPANY', message: 'Company not found or inactive' } }, { status: 400 });
            }
            validatedCompanyId = company_id;
        } else {
            validatedCompanyId = fullUser?.company_id;
            if (!validatedCompanyId) {
                return Response.json({ error: { code: 'NO_COMPANY_ACCESS', message: 'User has no assigned company' } }, { status: 403 });
            }
        }

        // ── VALIDATE INPUT ──────────────────────────────────────────────────────
        if (!purchaseOrderId) {
            return Response.json({ error: { code: 'INVALID_REQUEST', message: 'purchaseOrderId is required' } }, { status: 400 });
        }
        if (!toLocationId) {
            return Response.json({ error: { code: 'INVALID_LOCATION', message: 'toLocationId is required' } }, { status: 400 });
        }
        if (!Array.isArray(receivedLines) || receivedLines.length === 0) {
            return Response.json({ error: { code: 'INVALID_REQUEST', message: 'receivedLines must be a non-empty array' } }, { status: 400 });
        }

        // ── LOAD AND VERIFY PO ───────────────────────────────────────────────────
        const po = await base44.asServiceRole.entities.PurchaseOrder.get(purchaseOrderId);
        if (!po) {
            return Response.json({ error: { code: 'NOT_FOUND', message: 'Purchase order not found' } }, { status: 404 });
        }
        if (po.company_id !== validatedCompanyId) {
            return Response.json({ error: { code: 'FORBIDDEN', message: 'PO belongs to another company' } }, { status: 403 });
        }
        if (po.status === 'received' || po.status === 'cancelled') {
            return Response.json({ error: { code: 'INVALID_STATUS', message: `PO is already ${po.status}` } }, { status: 400 });
        }

        // ── PROCESS EACH RECEIVED LINE ──────────────────────────────────────────
        const updatedLines = [...(po.lines || [])];
        let totalReceived = 0;

        for (const rl of receivedLines) {
            const idx = rl.lineIndex;
            const line = updatedLines[idx];
            if (!line) continue;
            const qty = Number(rl.receivedQuantity) || 0;
            if (qty <= 0) continue;

            // Add to inventory at destination
            const existingItems = await base44.asServiceRole.entities.InventoryItem.filter({
                material_id: line.material_id,
                location_id: toLocationId,
                company_id: validatedCompanyId
            });
            if (existingItems.length > 0) {
                await base44.asServiceRole.entities.InventoryItem.update(existingItems[0].id, {
                    quantity: existingItems[0].quantity + qty
                });
            } else {
                await base44.asServiceRole.entities.InventoryItem.create({
                    material_id: line.material_id,
                    location_id: toLocationId,
                    quantity: qty,
                    company_id: validatedCompanyId
                });
            }

            // Create an 'add' transaction stamped with the PO number
            await base44.asServiceRole.entities.Transaction.create({
                type: 'add',
                material_id: line.material_id,
                to_location_id: toLocationId,
                quantity: qty,
                notes: `PO ${po.po_number}`,
                company_id: validatedCompanyId
            });

            updatedLines[idx] = {
                ...line,
                received_quantity: (line.received_quantity || 0) + qty
            };
            totalReceived += qty;
        }

        // ── UPDATE PO STATUS ─────────────────────────────────────────────────────
        const allReceived = updatedLines.length > 0 && updatedLines.every(l => (l.received_quantity || 0) >= (l.expected_quantity || 0));
        const anyReceived = updatedLines.some(l => (l.received_quantity || 0) > 0);
        let newStatus = po.status;
        if (allReceived) newStatus = 'received';
        else if (anyReceived) newStatus = 'partial';
        else if (po.status === 'draft') newStatus = 'ordered';

        await base44.asServiceRole.entities.PurchaseOrder.update(purchaseOrderId, {
            lines: updatedLines,
            status: newStatus
        });

        return Response.json({ success: true, status: newStatus, totalReceived });

    } catch (error) {
        console.error('receivePurchaseOrder error:', error);
        return Response.json({ error: { code: 'SERVER_ERROR', message: error.message || 'Unexpected server error' } }, { status: 500 });
    }
});