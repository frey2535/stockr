import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { actionType, materialId, quantity, fromLocationId, toLocationId, projectName, buildrProjectId, notes, company_id } = await req.json();
        
        // ── AUTHENTICATE USER ────────────────────────────────────────────────────
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }, { status: 401 });
        }
        
        // ── RESOLVE COMPANY ID ───────────────────────────────────────────────────
        // For tenant users: use User.company_id
        // For platform admins: require explicit company_id in payload
        let validatedCompanyId;
        
        const fullUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const fullUser = fullUsers.length > 0 ? fullUsers[0] : null;
        const isPlatformAdmin = fullUser?.is_platform_admin === true;
        
        if (isPlatformAdmin) {
            // Platform admin must provide company_id
            if (!company_id) {
                return Response.json({ error: { code: 'INVALID_REQUEST', message: 'Platform admin must provide company_id' } }, { status: 400 });
            }
            // Validate against CompanyDirectory
            const companyDirs = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id, is_active: true });
            if (companyDirs.length === 0) {
                return Response.json({ error: { code: 'INVALID_COMPANY', message: 'Company not found or inactive' } }, { status: 400 });
            }
            validatedCompanyId = company_id;
        } else {
            // Tenant user: use assigned company_id
            validatedCompanyId = fullUser?.company_id;
            if (!validatedCompanyId) {
                return Response.json({ error: { code: 'NO_COMPANY_ACCESS', message: 'User has no assigned company' } }, { status: 403 });
            }
        }

        // ── Shared Validations ──────────────────────────────────────────────────
        if (!actionType || !['add', 'transfer', 'use', 'adjust', 'shrink'].includes(actionType)) {
            return Response.json({ error: { code: 'INVALID_ACTION', message: 'actionType must be add, transfer, use, adjust, or shrink' } }, { status: 400 });
        }

        if (!quantity || quantity <= 0) {
            return Response.json({ error: { code: 'INVALID_QUANTITY', message: 'Quantity must be greater than 0' } }, { status: 400 });
        }

        if (!materialId) {
            return Response.json({ error: { code: 'INVALID_MATERIAL', message: 'materialId is required' } }, { status: 400 });
        }

        // ── ADD ─────────────────────────────────────────────────────────────────
        if (actionType === 'add') {
            if (!toLocationId) {
                return Response.json({ error: { code: 'INVALID_LOCATION', message: 'toLocationId is required for add' } }, { status: 400 });
            }

            const existingItems = await base44.asServiceRole.entities.InventoryItem.filter({ material_id: materialId, location_id: toLocationId, company_id: validatedCompanyId });
            if (existingItems.length > 0) {
                await base44.asServiceRole.entities.InventoryItem.update(existingItems[0].id, { quantity: existingItems[0].quantity + quantity });
            } else {
                await base44.asServiceRole.entities.InventoryItem.create({ material_id: materialId, location_id: toLocationId, quantity, company_id: validatedCompanyId });
            }

            await base44.asServiceRole.entities.Transaction.create({ type: 'add', material_id: materialId, to_location_id: toLocationId, quantity, company_id: validatedCompanyId });

            return Response.json({ success: true });
        }

        // ── TRANSFER ────────────────────────────────────────────────────────────
        if (actionType === 'transfer') {
            if (!fromLocationId) {
                return Response.json({ error: { code: 'INVALID_LOCATION', message: 'fromLocationId is required for transfer' } }, { status: 400 });
            }
            if (!toLocationId) {
                return Response.json({ error: { code: 'INVALID_LOCATION', message: 'toLocationId is required for transfer' } }, { status: 400 });
            }
            if (fromLocationId === toLocationId) {
                return Response.json({ error: { code: 'SAME_SOURCE_DESTINATION', message: 'Source and destination cannot be the same location' } }, { status: 400 });
            }

            // SERVER-SIDE stock check — final authority, no negative stock allowed
            const sourceItems = await base44.asServiceRole.entities.InventoryItem.filter({ material_id: materialId, location_id: fromLocationId, company_id: validatedCompanyId });
            if (sourceItems.length === 0 || sourceItems[0].quantity < quantity) {
                const available = sourceItems.length > 0 ? sourceItems[0].quantity : 0;
                return Response.json({ error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock: ${available} available, ${quantity} requested` } }, { status: 400 });
            }

            const sourceItem = sourceItems[0];

            // Deduct source first
            await base44.asServiceRole.entities.InventoryItem.update(sourceItem.id, { quantity: sourceItem.quantity - quantity });

            // Add to destination
            const destItems = await base44.asServiceRole.entities.InventoryItem.filter({ material_id: materialId, location_id: toLocationId, company_id: validatedCompanyId });
            if (destItems.length > 0) {
                await base44.asServiceRole.entities.InventoryItem.update(destItems[0].id, { quantity: destItems[0].quantity + quantity });
            } else {
                await base44.asServiceRole.entities.InventoryItem.create({ material_id: materialId, location_id: toLocationId, quantity, company_id: validatedCompanyId });
            }

            await base44.asServiceRole.entities.Transaction.create({ type: 'transfer', material_id: materialId, from_location_id: fromLocationId, to_location_id: toLocationId, quantity, company_id: validatedCompanyId });

            return Response.json({ success: true });
        }

        // ── USE ─────────────────────────────────────────────────────────────────
        if (actionType === 'use') {
            if (!fromLocationId) {
                return Response.json({ error: { code: 'INVALID_LOCATION', message: 'fromLocationId is required for use' } }, { status: 400 });
            }

            // SERVER-SIDE stock check — final authority, no negative stock allowed
            const sourceItems = await base44.asServiceRole.entities.InventoryItem.filter({ material_id: materialId, location_id: fromLocationId, company_id: validatedCompanyId });
            if (sourceItems.length === 0 || sourceItems[0].quantity < quantity) {
                const available = sourceItems.length > 0 ? sourceItems[0].quantity : 0;
                return Response.json({ error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock: ${available} available, ${quantity} requested` } }, { status: 400 });
            }

            const sourceItem = sourceItems[0];
            await base44.asServiceRole.entities.InventoryItem.update(sourceItem.id, { quantity: sourceItem.quantity - quantity });

            const useTx = await base44.asServiceRole.entities.Transaction.create({ 
              type: 'use', 
              material_id: materialId, 
              from_location_id: fromLocationId, 
              quantity, 
              project_name: projectName || '',
              buildr_project_id: buildrProjectId || null,
              company_id: validatedCompanyId
            });

            // Trigger async Buildr sync only if buildrProjectId is provided (validated upfront)
            if (buildrProjectId && useTx.id) {
              base44.functions.invoke('syncTransactionToBuildr', { transactionId: useTx.id, operation: 'create' }).catch(err => {
                console.warn(`Background sync failed for transaction ${useTx.id}:`, err.message);
              });
            }

            return Response.json({ success: true });
        }

        // ── ADJUST / SHRINK ────────────────────────────────────────────────────
        // Both deduct stock from a location like 'use', but are NOT consumed on a
        // job (no project, no Buildr sync). 'adjust' = correction; 'shrink' = loss.
        if (actionType === 'adjust' || actionType === 'shrink') {
            if (!fromLocationId) {
                return Response.json({ error: { code: 'INVALID_LOCATION', message: `fromLocationId is required for ${actionType}` } }, { status: 400 });
            }

            // SERVER-SIDE stock check — final authority, no negative stock allowed
            const sourceItems = await base44.asServiceRole.entities.InventoryItem.filter({ material_id: materialId, location_id: fromLocationId, company_id: validatedCompanyId });
            if (sourceItems.length === 0 || sourceItems[0].quantity < quantity) {
                const available = sourceItems.length > 0 ? sourceItems[0].quantity : 0;
                return Response.json({ error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock: ${available} available, ${quantity} requested` } }, { status: 400 });
            }

            const sourceItem = sourceItems[0];
            await base44.asServiceRole.entities.InventoryItem.update(sourceItem.id, { quantity: sourceItem.quantity - quantity });

            await base44.asServiceRole.entities.Transaction.create({
                type: actionType,
                material_id: materialId,
                from_location_id: fromLocationId,
                quantity,
                notes: notes || '',
                company_id: validatedCompanyId
            });

            return Response.json({ success: true });
        }

    } catch (error) {
        console.error('processInventoryAction error:', error);
        return Response.json({ error: { code: 'SERVER_ERROR', message: error.message || 'Unexpected server error' } }, { status: 500 });
    }
});