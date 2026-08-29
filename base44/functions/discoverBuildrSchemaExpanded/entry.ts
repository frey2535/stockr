Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("BUILDR_API_KEY");
    if (!apiKey) return Response.json({ error: "BUILDR_API_KEY not set" }, { status: 500 });

    const results = {};
    const BUILDR_APP_ID = "69b40ba8df9a8d2fcbd24d0d";
    const BUILDR_API_BASE = "https://buildrpm.base44.app/api";
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "x-app-id": BUILDR_APP_ID };

    // Fetch projects
    const projectsResponse = await fetch(`${BUILDR_API_BASE}/entities/Project?limit=10`, {
      method: "GET",
      headers: headers,
    });
    
    if (!projectsResponse.ok) {
      return Response.json({ error: "Failed to fetch projects", status: projectsResponse.status }, { status: 500 });
    }

    const projects = await projectsResponse.json();
    if (projects.length === 0) {
      return Response.json({ error: "No projects found in Buildr" }, { status: 400 });
    }

    const projectId = projects[0].id;
    const projectNumber = projects[0].project_number;
    results.confirmed_project_id = projectId;
    results.project_number = projectNumber;
    results.creation_tests = [];

    const today = new Date().toISOString().split('T')[0];

    // Progressive payload testing
    const testPayloads = [
      { payload: {}, label: "Empty payload" },
      { payload: { project_id: projectId }, label: "Only project_id" },
      { payload: { description: "Test" }, label: "Only description" },
      { payload: { amount: 100 }, label: "Only amount" },
      { payload: { date: today }, label: "Only date" },
      { payload: { project_id: projectId, description: "Test Expense" }, label: "project_id + description" },
      { payload: { project_id: projectId, amount: 100 }, label: "project_id + amount" },
      { payload: { project_id: projectId, date: today }, label: "project_id + date" },
      { payload: { project_id: projectId, description: "Test Expense", amount: 100 }, label: "project_id + description + amount" },
      { payload: { project_id: projectId, description: "Test Expense", date: today }, label: "project_id + description + date" },
      { payload: { project_id: projectId, amount: 100, date: today }, label: "project_id + amount + date" },
      { payload: { project_id: projectId, description: "Test Expense", amount: 100, date: today }, label: "project_id + description + amount + date" },
      { payload: { project_id: projectId, description: "Office Supplies", amount: 50.25, date: today, category: "Office" }, label: "... + category" },
      { payload: { project_id: projectId, description: "Office Supplies", amount: 50.25, date: today, category: "Office", vendor: "Staples" }, label: "... + vendor" },
      { payload: { project_id: projectId, description: "Travel", amount: 200, date: today, category: "Travel", vendor: "Airline", notes: "Flight" }, label: "... + notes" },
      { payload: { project_id: projectId, description: "Test", amount: 100, date: today, currency: "USD" }, label: "... + currency" },
      { payload: { project_id: projectId, description: "Test", amount: 100, date: today, status: "pending" }, label: "... + status" },
    ];

    // Execute tests sequentially, recording all results
    for (const testCase of testPayloads) {
      const testResponse = await fetch(`${BUILDR_API_BASE}/entities/Expense`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(testCase.payload),
      });
      
      let responseBody = "";
      try {
        responseBody = await testResponse.json();
      } catch {
        responseBody = await testResponse.text();
      }

      results.creation_tests.push({
        label: testCase.label,
        payload: testCase.payload,
        status: testResponse.status,
        response: typeof responseBody === 'string' ? responseBody.slice(0, 500) : responseBody,
        success: testResponse.ok
      });
    }

    // Identify closest-to-valid and first success
    const successfulTests = results.creation_tests.filter(t => t.success);
    if (successfulTests.length > 0) {
      results.first_successful_payload = successfulTests[0];
      results.closest_to_valid_index = results.creation_tests.indexOf(successfulTests[0]);
    }

    // Find most complete failed payload (highest status code before success)
    const failedTests = results.creation_tests.filter(t => !t.success);
    if (failedTests.length > 0) {
      const sortedByStatus = failedTests.sort((a, b) => b.status - a.status);
      results.closest_failed_payload = sortedByStatus[0];
    }

    return Response.json(results);
  } catch (err) {
    return Response.json({ fatal: err.message }, { status: 500 });
  }
});