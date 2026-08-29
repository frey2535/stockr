import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import { AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CompanyAccessGate({ userEmail, children }) {
  const [state, setState] = useState({ status: 'checking' });
  const { activeCompanyId, selectCompany } = useUserCompanyId();

  // Validate access on mount / email change
  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await base44.functions.invoke('validateUserAccess', {});
        const { authorized, is_platform_admin, app_type, app_bound_company_id, reason, debug, error_message } = response.data;

        console.log("[COMPANY ACCESS GATE] validateUserAccess response:", {
          authorized, is_platform_admin, app_type, reason, debug, error_message,
          full_response: response.data
        });

        if (authorized) {
          setState({ status: 'authorized', isPlatformAdmin: is_platform_admin, appType: app_type, reason, debug, rawResponse: response.data });
        } else {
          setState({ status: 'denied', isPlatformAdmin: is_platform_admin, appType: app_type, appBoundCompanyId: app_bound_company_id, reason, debug, rawResponse: response.data });
        }
      } catch (error) {
        console.error("[COMPANY ACCESS GATE] Error:", error);
        setState({ status: 'error', reason: error.message || 'Access validation failed', errorObject: error, rawResponse: null });
      }
    };

    validateAccess();
  }, [userEmail]);

  // Auto-select company for platform admins — must run unconditionally (Rules of Hooks)
  useEffect(() => {
    if (state.status === 'authorized' && state.isPlatformAdmin && !activeCompanyId) {
      selectCompany?.('co_dayoneelectric');
    }
  }, [state.status, state.isPlatformAdmin, activeCompanyId, selectCompany]);

  // Checking
  if (state.status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Validating access...</p>
      </div>
    );
  }

  // Error
  if (state.status === 'error') {
    return (
      <Card className="border-2 border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Validation Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive/80">Failed to validate access. Please contact support.</p>
          <div className="space-y-1 bg-destructive/10 p-3 rounded text-xs font-mono text-destructive/70">
            <p><strong>Error:</strong> {state.reason}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Platform admin waiting for company selection
  if (state.status === 'authorized' && state.isPlatformAdmin && !activeCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Denied
  if (state.status === 'denied') {
    return (
      <Card className="border-2 border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Lock className="w-5 h-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive/80">
            {state.appType === 'company'
              ? 'Your account does not have access to this company instance. Please contact your administrator.'
              : 'You must be marked as a platform admin to access this instance.'}
          </p>
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700"><strong>Reason:</strong> {state.reason || 'Unknown'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Authorized
  return <>{children}</>;
}