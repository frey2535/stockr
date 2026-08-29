import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({
        authorized: false,
        is_platform_admin: false,
        app_type: null,
        reason: "Not authenticated",
        debug: { user_from_auth_me: null }
      });
    }

    // 2. Debug log what auth.me() returns
    const authDebug = {
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      is_platform_admin: user.is_platform_admin,
      data_company_id: user.data?.company_id,
      data_is_platform_admin: user.data?.is_platform_admin,
      full_user_keys: Object.keys(user)
    };
    console.error("[validateUserAccess] auth.me() debug:", authDebug);
    console.error("[validateUserAccess] Full auth.me() object:", user);

    // 3. Resolve is_platform_admin (try multiple sources)
    const isPlatformAdmin = user.is_platform_admin === true || user.data?.is_platform_admin === true;

    // 4. Resolve company_id (try both root and nested)
    const resolvedCompanyId = user.company_id || user.data?.company_id || null;

    // 5. If platform admin, return immediately
    if (isPlatformAdmin) {
      console.log("[validateUserAccess] Platform admin detected");
      return Response.json({
        authorized: true,
        is_platform_admin: true,
        app_type: "platform",
        reason: "Platform admin access",
        debug: { resolved_from: "auth.me", isPlatformAdmin, resolvedCompanyId }
      });
    }

    // 6. For tenant users, require company_id
    if (!resolvedCompanyId) {
      console.log("[validateUserAccess] Tenant user missing company_id");
      return Response.json({
        authorized: false,
        is_platform_admin: false,
        app_type: "company",
        reason: "User missing company_id assignment",
        debug: { resolved_from: "auth.me", isPlatformAdmin, resolvedCompanyId }
      });
    }

    // 7. Validate company exists and is active
    console.log(`[validateUserAccess] Validating company: ${resolvedCompanyId}`);
    const companyRecords = await base44.asServiceRole.entities.CompanyDirectory.filter({
      company_id: resolvedCompanyId,
      is_active: true
    });

    if (!companyRecords || companyRecords.length === 0) {
      console.log("[validateUserAccess] Company not found or inactive");
      return Response.json({
        authorized: false,
        is_platform_admin: false,
        app_type: "company",
        app_bound_company_id: resolvedCompanyId,
        reason: "Company not found or inactive",
        debug: { resolved_from: "auth.me", isPlatformAdmin, resolvedCompanyId }
      });
    }

    // 8. Return authorized for valid tenant user
    console.log("[validateUserAccess] Tenant user authorized");
    return Response.json({
      authorized: true,
      is_platform_admin: false,
      app_type: "company",
      reason: "Company user access granted",
      debug: { resolved_from: "auth.me", isPlatformAdmin, resolvedCompanyId }
    });

  } catch (error) {
    console.error("[validateUserAccess] Error:", error.message || error);
    return Response.json({
      authorized: false,
      is_platform_admin: false,
      app_type: null,
      reason: "Server error during validation",
      error_message: error.message || String(error)
    }, { status: 500 });
  }
});