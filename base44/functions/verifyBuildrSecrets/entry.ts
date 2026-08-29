import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const secretNames = [
      'STOCKR_BUILDR_SECRET_DAYONE',
      'BUILDR_API_KEY_DAYONE',
      'STOCKR_BUILDR_SHARED_SECRET',
      'BUILDR_RECEIVE_EXPENSE_URL',
      'BUILDR_API_KEY'
    ];

    const status = {};
    secretNames.forEach(name => {
      const value = Deno.env.get(name);
      status[name] = {
        exists: !!value,
        length: value ? value.length : 0,
        preview: value ? value.slice(0, 10) + '...' : 'NOT SET'
      };
    });

    return Response.json({ secrets_status: status });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});