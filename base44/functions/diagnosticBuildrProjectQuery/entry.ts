import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const fullUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const fullUser = fullUsers.length > 0 ? fullUsers[0] : null;
    if (fullUser?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const buildrApiKey = Deno.env.get('BUILDR_API_KEY_DAYONE');
    if (!buildrApiKey) {
      return Response.json({ error: 'BUILDR_API_KEY_DAYONE not configured' }, { status: 500 });
    }

    const buildrAppId = '69e3fb7649fce12fad774ad9';
    const projectNames = ['Vandy', 'Stockr Sync Test Project', 'Thompson Station Elem/Mid', 'Woodland Middle'];

    console.log(`[DIAGNOSTIC] Querying Buildr app ${buildrAppId} for specific projects...`);
    console.log(`[DIAGNOSTIC] Using API key secret: BUILDR_API_KEY_DAYONE`);
    console.log(`[DIAGNOSTIC] x-api-key present: ${!!buildrApiKey}`);

    // Fetch all projects from Buildr
    const response = await fetch(
      `https://buildrpm.base44.app/api/entities/Project?limit=1000`,
      {
        method: 'GET',
        headers: {
          'x-api-key': buildrApiKey,
          'x-app-id': buildrAppId,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`[DIAGNOSTIC] Buildr API error: ${response.status}`);
      return Response.json({ 
        error: `Buildr API error: ${response.status}`,
        diagnostic: {
          buildr_app_id: buildrAppId,
          x_api_key_present: !!buildrApiKey,
          http_status: response.status
        }
      }, { status: response.status });
    }

    const allProjects = await response.json();
    console.log(`[DIAGNOSTIC] Total projects in Buildr: ${allProjects.length}`);

    // Filter to requested project names
    const results = {};
    for (const name of projectNames) {
      const found = allProjects.find(p => p.name === name);
      results[name] = found ? {
        id: found.id,
        name: found.name,
        project_number: found.project_number,
        company_id: found.company_id,
        created_date: found.created_date,
        found: true
      } : {
        found: false,
        message: `Project "${name}" not found in Buildr app ${buildrAppId}`
      };
    }

    console.log(`[DIAGNOSTIC] Query results:`, results);

    return Response.json({
      diagnostic_info: {
        buildr_app_id: buildrAppId,
        api_key_secret_ref: 'BUILDR_API_KEY_DAYONE',
        x_api_key_present: !!buildrApiKey,
        total_projects_in_buildr: allProjects.length
      },
      project_queries: results,
      all_projects: allProjects.map(p => ({
        id: p.id,
        name: p.name,
        project_number: p.project_number,
        company_id: p.company_id,
        created_date: p.created_date
      }))
    });

  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});