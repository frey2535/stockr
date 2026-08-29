import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only admin can run this
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = body.email || 'mfrey@dayoneelectric.com';

    console.log(`[VERIFY USER] Looking for user: ${targetEmail}`);

    // Query User entity for this email
    const users = await base44.asServiceRole.entities.User.filter({ 
      email: targetEmail 
    });

    if (!users || users.length === 0) {
      return Response.json({
        found: false,
        email: targetEmail,
        message: `User not found: ${targetEmail}`
      });
    }

    const targetUser = users[0];
    console.log(`[VERIFY USER] User found:`, {
      email: targetUser.email,
      company_id: targetUser.company_id,
      data_company_id: targetUser.data?.company_id,
      is_platform_admin: targetUser.is_platform_admin,
      role: targetUser.role
    });

    // Check if company_id is missing
    const needsUpdate = !targetUser.company_id || !targetUser.data?.company_id;

    if (needsUpdate) {
      console.log(`[VERIFY USER] User missing company_id, updating...`);
      
      // Update with both root and data.company_id
      const updateData = {
        company_id: 'co_dayoneelectric'
      };

      // If user has data field, merge it
      if (targetUser.data) {
        updateData.data = { ...targetUser.data, company_id: 'co_dayoneelectric' };
      } else {
        updateData.data = { company_id: 'co_dayoneelectric' };
      }

      const updated = await base44.asServiceRole.entities.User.update(targetUser.id, updateData);
      
      console.log(`[VERIFY USER] User updated:`, {
        email: updated.email,
        company_id: updated.company_id,
        data_company_id: updated.data?.company_id,
        is_platform_admin: updated.is_platform_admin,
        role: updated.role
      });

      return Response.json({
        found: true,
        updated: true,
        email: updated.email,
        company_id: updated.company_id,
        data_company_id: updated.data?.company_id,
        is_platform_admin: updated.is_platform_admin,
        role: updated.role,
        message: `User ${targetEmail} updated with company_id = co_dayoneelectric`
      });
    } else {
      console.log(`[VERIFY USER] User already has company_id set`);
      return Response.json({
        found: true,
        updated: false,
        email: targetUser.email,
        company_id: targetUser.company_id,
        data_company_id: targetUser.data?.company_id,
        is_platform_admin: targetUser.is_platform_admin,
        role: targetUser.role,
        message: `User ${targetEmail} already has company_id set`
      });
    }

  } catch (error) {
    console.error('[VERIFY USER] Error:', error.message);
    return Response.json({ 
      error: error.message || 'Server error',
      fullError: String(error)
    }, { status: 500 });
  }
});