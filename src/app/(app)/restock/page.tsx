"use client";

import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RestockBoard } from "@/components/restock-board";
import { useApi } from "@/lib/use-api";
import type { RestockPayload } from "@/lib/workspace-types";

export default function RestockPage() {
  const { data, loading, reload } = useApi<RestockPayload>("/api/restock");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restock"
        description="Locations below min. Transfer from the fullest warehouse, or draft a PO when nothing is left to pull."
        icon={<RefreshCw className="size-8 text-secondary" />}
      />
      {loading && !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <RestockBoard rows={data?.rows || []} onDone={reload} />
      )}
    </div>
  );
}
