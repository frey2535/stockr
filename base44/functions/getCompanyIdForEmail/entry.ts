import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    // Fetch the User record
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found', email }, { status: 404 });
    }

    const targetUser = users[0];
    const companyId = targetUser.company_id || targetUser.data?.company_id;

    return Response.json({
      email: targetUser.email,
      full_name: targetUser.full_name,
      company_id: companyId,
      company_id_source: targetUser.company_id ? 'user.company_id' : 'user.data.company_id',
      is_platform_admin: targetUser.is_platform_admin,
      role: targetUser.role
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});