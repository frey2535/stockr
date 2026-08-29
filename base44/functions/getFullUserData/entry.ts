import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch full User entity record with company_id
    const fullUserRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const fullUser = fullUserRecords.length > 0 ? fullUserRecords[0] : null;

    if (!fullUser) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    return Response.json({
      id: fullUser.id,
      email: fullUser.email,
      full_name: fullUser.full_name,
      company_id: fullUser.company_id || null,
      is_platform_admin: fullUser.is_platform_admin || false,
      role: fullUser.role || 'user'
    });
  } catch (error) {
    console.error('[getFullUserData ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});