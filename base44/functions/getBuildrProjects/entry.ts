import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── USER AUTHENTICATION ────────────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      console.error('[AUTH] No user authenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── RESOLVE COMPANY ID ─────────────────────────────────────────────────────
    // Fetch full user record
    const fullUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const fullUser = fullUsers.length > 0 ? fullUsers[0] : null;
    const userCompanyId = fullUser?.company_id || null;
    const isPlatformAdmin = fullUser?.is_platform_admin === true;

    // Get company_id from request body (for platform admins)
    const body = await req.json().catch(() => ({}));
    const requestCompanyId = body.company_id;

    let validatedCompanyId;

    if (isPlatformAdmin) {
      // Platform admin must provide company_id in request
      if (!requestCompanyId) {
        console.warn(`[COMPANY ACCESS] Platform admin ${user.email} did not provide company_id`);
        return Response.json({ projects: [] }, { status: 200 });
      }
      // Validate against CompanyDirectory
      const companyDirs = await base44.asServiceRole.entities.CompanyDirectory.filter({ company_id: requestCompanyId, is_active: true });
      if (companyDirs.length === 0) {
        console.warn(`[COMPANY ACCESS] Platform admin ${user.email} requested invalid company ${requestCompanyId}`);
        return Response.json({ projects: [] }, { status: 200 });
      }
      validatedCompanyId = requestCompanyId;
      console.log(`[PLATFORM_ADMIN_OVERRIDE] User ${user.email} accessing company ${validatedCompanyId}`);
    } else {
      // Tenant user: use assigned company_id
      if (!userCompanyId) {
        console.warn(`[COMPANY ACCESS] User ${user.email} has no assigned company`);
        return Response.json({ projects: [] }, { status: 200 });
      }
      validatedCompanyId = userCompanyId;
      console.log(`[COMPANY_ACCESS] User ${user.email} accessing company ${validatedCompanyId}`);
    }

    // ── FETCH BUILDR CONFIG FOR THIS COMPANY ──────────────────────────────────
    const configRecords = await base44.asServiceRole.entities.BuildrIntegrationConfig.filter({
      company_id: validatedCompanyId,
      is_active: true
    });
    
    if (configRecords.length === 0) {
      console.error(`[BUILDR SYNC] No active BuildrIntegrationConfig for company ${validatedCompanyId}`);
      return Response.json({ error: 'Buildr integration not configured for this company' }, { status: 400 });
    }
    
    const config = configRecords[0];
    const buildrAppId = config.buildr_app_id;
    const apiKeySecretRef = config.buildr_api_key_secret_ref || 'BUILDR_API_KEY_DAYONE';
    const buildrApiKey = Deno.env.get(apiKeySecretRef);

    console.log(`[BUILDR SYNC] company_id: ${validatedCompanyId}, buildr_app_id: ${buildrAppId}, api_key_ref: ${apiKeySecretRef}, api_key_present: ${!!buildrApiKey}`);
    
    if (!buildrAppId) {
      console.error(`[BUILDR SYNC] No buildr_app_id in config for company ${validatedCompanyId}`);
      return Response.json({ error: 'Buildr app ID not configured' }, { status: 400 });
    }
    if (!buildrApiKey) {
      console.error(`[BUILDR SYNC] Secret ${apiKeySecretRef} not set`);
      return Response.json({ error: `API key secret '${apiKeySecretRef}' not configured` }, { status: 500 });
    }

    // ── FETCH PROJECTS USING SDK SCOPED TO THIS COMPANY'S BUILDR APP ──────────
    const buildrClient = createClient({
      appId: buildrAppId,
      headers: { "api_key": buildrApiKey }
    });

    console.log(`[BUILDR SYNC] Fetching projects from Buildr app ${buildrAppId} using SDK...`);
    const allProjects = await buildrClient.entities.Project.list('-created_date', 1000);
    console.log(`[BUILDR SYNC] Fetched ${allProjects.length} projects from Buildr app ${buildrAppId}`);

    // Return project list for dropdown
    const projectList = allProjects.map(p => ({
      id: p.id,
      name: p.name,
      project_number: p.project_number,
      status: p.status,
      company_id: p.company_id
    }));
    
    console.log(`[BUILDR SYNC] Returning ${projectList.length} projects to frontend`);
    

    return Response.json({ projects: projectList });

  } catch (error) {
    console.error('[TENANT SCOPE] Error in getBuildrProjects:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});