import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAccount } from "@/lib/auth";
import { listCompanies } from "@/lib/db";
import { OpenCompanyButton } from "./open-company-button";

export default async function AdminPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.platformOwner) redirect("/dashboard");

  const companies = await listCompanies();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform"
        description="CurrentFlow owner console. Open any company workspace."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Companies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No companies yet.</p>
          ) : (
            companies.map((company) => (
              <div
                key={company.id}
                className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {company.memberCount} {company.memberCount === 1 ? "seat" : "seats"} · {company.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{company.plan}</Badge>
                  <Badge variant="outline">{company.planStatus}</Badge>
                  <OpenCompanyButton companyId={company.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
