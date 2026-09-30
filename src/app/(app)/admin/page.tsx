import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAccount } from "@/lib/auth";
import { CompanyDirectory } from "./company-directory";

export default async function AdminPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (!account.platformOwner) redirect("/dashboard");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform"
        description="CurrentFlow owner console. Search and open any company workspace."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Companies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyDirectory />
        </CardContent>
      </Card>
    </div>
  );
}
