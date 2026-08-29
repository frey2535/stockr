import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Ensures CompanyDirectory has a valid active record for co_dayonelectric
 * - Checks if record exists
 * - If missing, creates it with is_active = true
 * - If exists but inactive, updates to active
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if record exists
    const existing = await base44.asServiceRole.entities.CompanyDirectory.filter({
      company_id: 'co_dayoneelectric'
    });

    if (existing.length > 0) {
      const record = existing[0];
      
      // If already active, return success
      if (record.is_active) {
        return Response.json({
          status: 'already_exists_active',
          company_id: record.company_id,
          company_name: record.company_name,
          is_active: record.is_active
        });
      }

      // If inactive, activate it
      const updated = await base44.asServiceRole.entities.CompanyDirectory.update(record.id, {
        is_active: true
      });

      return Response.json({
        status: 'activated',
        company_id: updated.company_id,
        company_name: updated.company_name,
        is_active: updated.is_active
      });
    }

    // Create new record
    const created = await base44.asServiceRole.entities.CompanyDirectory.create({
      company_id: 'co_dayoneelectric',
      company_name: 'Day One Electric',
      is_active: true
    });

    return Response.json({
      status: 'created',
      company_id: created.company_id,
      company_name: created.company_name,
      is_active: created.is_active
    });

  } catch (error) {
    return Response.json({ 
      error: error.message || 'Server error'
    }, { status: 500 });
  }
});