Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("BUILDR_API_KEY");
    if (!apiKey) return Response.json({ error: "BUILDR_API_KEY not set" }, { status: 500 });

    const results = {};
    const BUILDR_APP_ID = "69b40ba8df9a8d2fcbd24d0d";
    const BUILDR_API_BASE = "https://buildrpm.base44.app/api";
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "x-app-id": BUILDR_APP_ID };

    // --- Fetch sample Expenses to infer schema ---
    const expenseListResponse = await fetch(`${BUILDR_API_BASE}/entities/Expense?limit=10`, {
      method: "GET",
      headers: headers,
    });
    
    if (expenseListResponse.ok) {
      const expenseList = await expenseListResponse.json();
      results.sample_expenses = expenseList;
      if (expenseList.length > 0) {
        results.inferred_fields = Object.keys(expenseList[0]);
        results.first_expense_sample = expenseList[0];
      } else {
        results.note = "No Expense records exist yet in Buildr.";
      }
    } else {
      results.expense_list_error = { status: expenseListResponse.status, body: (await expenseListResponse.text()).slice(0, 300) };
    }

    // --- Fetch projects ---
    const projectsResponse = await fetch(`${BUILDR_API_BASE}/entities/Project?limit=10`, {
      method: "GET",
      headers: headers,
    });
    
    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      results.projects = projects;
      results.projects_count = projects.length;
      if (projects.length > 0) {
        results.first_project = projects[0];
      }
    } else {
      results.projects_error = { status: projectsResponse.status };
    }

    // --- Try creating a minimal Expense to see what fields are required ---
    if (results.projects_count > 0) {
      const testPayloads = [
        { project_id: results.first_project.id, description: "Test 1" },
        { project_id: results.first_project.id, description: "Test 2", amount: 100 },
        { project_id: results.first_project.id, description: "Test 3", amount: 100, date: new Date().toISOString().split('T')[0] },
      ];

      results.creation_tests = [];

      for (let i = 0; i < testPayloads.length; i++) {
        const testResponse = await fetch(`${BUILDR_API_BASE}/entities/Expense`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(testPayloads[i]),
        });
        
        const responseBody = await testResponse.text();
        results.creation_tests.push({
          payload: testPayloads[i],
          status: testResponse.status,
          response: responseBody.slice(0, 400)
        });

        // Stop if we get a success
        if (testResponse.ok) {
          results.successful_payload_index = i;
          break;
        }
      }
    }

    return Response.json(results);
  } catch (err) {
    return Response.json({ fatal: err.message }, { status: 500 });
  }
});