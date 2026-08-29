import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const buildrApiKey = Deno.env.get('BUILDR_API_KEY');
    const buildrAppId = '69b40ba8df9a8d2fcbd24d0d';
    const projectId = '69d3ed2b7344ad9a51654673';
    const payloadCompanyId = 'co_dayoneelectric';

    // Fetch ALL projects from Buildr
    const res = await fetch(`https://buildrpm.base44.app/api/entities/Project?limit=1000`, {
      headers: {
        'x-api-key': buildrApiKey,
        'x-app-id': buildrAppId,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return Response.json({ error: `Buildr API error: ${res.status}` }, { status: res.status });
    }

    const allProjects = await res.json();

    // Find by ID
    const byId = allProjects.find(p => p.id === projectId);

    // Find all for this company_id (as Stockr sends it)
    const byCompanyId = allProjects.filter(p => p.company_id === payloadCompanyId);

    // Find all company_id values that exist in Buildr projects
    const allCompanyIds = [...new Set(allProjects.map(p => p.company_id).filter(Boolean))];

    return Response.json({
      lookup: {
        searched_project_id: projectId,
        searched_company_id: payloadCompanyId
      },
      project_found_by_id: byId ? {
        id: byId.id,
        name: byId.name,
        project_number: byId.project_number,
        company_id: byId.company_id,
        company_id_type: typeof byId.company_id,
        company_id_json: JSON.stringify(byId.company_id),
        status: byId.status
      } : null,
      company_id_match: byId ? byId.company_id === payloadCompanyId : false,
      company_id_exact_comparison: byId ? {
        buildr_value: byId.company_id,
        stockr_value: payloadCompanyId,
        are_equal: byId.company_id === payloadCompanyId,
        buildr_length: byId.company_id?.length,
        stockr_length: payloadCompanyId.length
      } : null,
      projects_with_matching_company_id: byCompanyId.length,
      all_company_ids_in_buildr: allCompanyIds,
      total_projects_in_buildr: allProjects.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});