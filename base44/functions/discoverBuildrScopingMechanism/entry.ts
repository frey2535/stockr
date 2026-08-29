import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("BUILDR_API_KEY");
    if (!apiKey) return Response.json({ error: "BUILDR_API_KEY not set" }, { status: 500 });

    const BUILDR_APP_ID = "69b40ba8df9a8d2fcbd24d0d";
    const BUILDR_API_BASE = "https://buildrpm.base44.app/api";
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "x-app-id": BUILDR_APP_ID };

    const results = {
      api_key_scope_test: null,
      filter_parameter_tests: [],
      alternative_endpoints: [],
      project_payload_inspection: null,
      recommended_mechanism: null
    };

    // ── TEST 1: Check if API key is platform-wide or app/tenant-scoped ──
    console.log('[SCOPING TEST] Testing API key scope...');
    const projectsResponse = await fetch(`${BUILDR_API_BASE}/entities/Project?limit=5`, {
      method: "GET",
      headers: headers,
    });

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      results.api_key_scope_test = {
        status: "SUCCESS",
        total_projects: projects.length,
        sample_fields: projects.length > 0 ? Object.keys(projects[0]) : [],
        first_project: projects.length > 0 ? projects[0] : null
      };

      // Inspect first project for ownership/tenant fields
      if (projects.length > 0) {
        const proj = projects[0];
        results.project_payload_inspection = {
          has_company_id: 'company_id' in proj,
          has_owning_company_id: 'owning_company_id' in proj,
          has_tenant_id: 'tenant_id' in proj,
          has_account_id: 'account_id' in proj,
          has_app_id: 'app_id' in proj,
          has_owner: 'owner' in proj,
          has_organization: 'organization' in proj,
          all_fields: Object.keys(proj)
        };
      }
    } else {
      results.api_key_scope_test = { status: "FAILED", error: projectsResponse.status };
    }

    // ── TEST 2: Try server-side filter parameters ──
    console.log('[SCOPING TEST] Testing server-side filter parameters...');
    const filterTests = [
      { param: "?company_id=day-one-electric", name: "company_id" },
      { param: "?tenant_id=day-one-electric", name: "tenant_id" },
      { param: "?account_id=69b40ba8df9a8d2fcbd24d0d", name: "account_id (app_id)" },
      { param: "?owning_company=day-one-electric", name: "owning_company" },
      { param: "?filter=company_id:day-one-electric", name: "filter param (company_id)" },
      { param: "", name: "no filter (baseline)" }
    ];

    for (const test of filterTests) {
      const testUrl = `${BUILDR_API_BASE}/entities/Project${test.param}`;
      const response = await fetch(testUrl, { method: "GET", headers: headers });
      
      if (response.ok) {
        const data = await response.json();
        results.filter_parameter_tests.push({
          parameter: test.name,
          status: "OK",
          returned_count: Array.isArray(data) ? data.length : 0,
          url_attempted: testUrl
        });
      } else {
        results.filter_parameter_tests.push({
          parameter: test.name,
          status: `HTTP ${response.status}`,
          url_attempted: testUrl
        });
      }
    }

    // ── TEST 3: Check for alternative endpoints ──
    console.log('[SCOPING TEST] Testing alternative endpoints...');
    const alternativeEndpoints = [
      "/entities/Company",
      "/entities/Account",
      "/entities/Organization",
      "/entities/Tenant",
      "/entities/App",
      "/apps",
      "/accounts",
      "/companies",
      "/me"
    ];

    for (const endpoint of alternativeEndpoints) {
      const response = await fetch(`${BUILDR_API_BASE}${endpoint}`, { method: "GET", headers: headers });
      
      results.alternative_endpoints.push({
        endpoint: endpoint,
        status: response.status,
        exists: response.ok
      });
    }

    // ── TEST 4: Check if x-app-id header is tenant-scoping ──
    console.log('[SCOPING TEST] Testing if x-app-id provides tenant scope...');
    const noAppIdResponse = await fetch(`${BUILDR_API_BASE}/entities/Project?limit=5`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey }
    });

    results.app_id_requirement = {
      with_app_id: projectsResponse.ok ? "SUCCESS" : "FAILED",
      without_app_id: noAppIdResponse.ok ? "SUCCESS" : "FAILED",
      indicates_scoping: projectsResponse.ok && !noAppIdResponse.ok ? "x-app-id may provide scoping" : "unclear"
    };

    // ── RECOMMENDATION ──
    results.recommended_mechanism = {
      finding: "API key appears to be platform-scoped without tenant filter mechanism in payload",
      options: [
        "1. Check if x-app-id is the tenant-scoping mechanism (try different app IDs for different accounts)",
        "2. Check if Buildr API documentation specifies server-side filter parameters",
        "3. Request Buildr to add company_id/account_id field to Project payload",
        "4. Inquire if separate API keys are issued per tenant/company in Buildr",
        "5. Check if there's a Buildr Dashboard API vs Platform API distinction"
      ]
    };

    return Response.json(results);

  } catch (err) {
    return Response.json({ fatal: err.message, stack: err.stack }, { status: 500 });
  }
});