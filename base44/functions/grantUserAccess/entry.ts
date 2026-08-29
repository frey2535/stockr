import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, company_id, company_name } = await req.json();

    if (!email || !company_id) {
      return Response.json({ error: 'email and company_id are required' }, { status: 400 });
    }

    if (!company_id.startsWith('co_')) {
      return Response.json({ error: 'company_id must start with co_' }, { status: 400 });
    }

    // 1. Find the target user
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({ error: `No user found with email: ${email}` }, { status: 404 });
    }
    const targetUser = users[0];

    // 2. Update user's company_id
    await base44.asServiceRole.entities.User.update(targetUser.id, { company_id });

    // 3. Ensure CompanyDirectory entry exists and is active
    const existing = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id });
    if (existing.length > 0) {
      if (!existing[0].is_active) {
        await base44.asServiceRole.entities.CompanyDirectory.update(existing[0].id, { is_active: true });
      }
    } else {
      await base44.asServiceRole.entities.CompanyDirectory.create({
        company_id,
        company_name: company_name || company_id,
        is_active: true
      });
    }

    console.log(`[grantUserAccess] Granted access: ${email} → ${company_id}`);
    return Response.json({ success: true, email, company_id });

  } catch (error) {
    console.error('[grantUserAccess ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});