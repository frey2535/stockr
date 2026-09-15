"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { BulkInventoryDialog } from "@/components/bulk-inventory-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ActivityItem } from "@/components/activity-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageBusy } from "@/components/page-busy";
import { useStore } from "@/lib/store";
import { useApi } from "@/lib/use-api";
import type { ActivityListPayload } from "@/lib/workspace-types";

export default function TransfersPage() {
  const { workspace } = useStore();
  const { settings, locations } = workspace;
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type !== "all") params.set("type", type);
  const { data, loading, reload } = useApi<ActivityListPayload>(`/api/activity?${params.toString()}`);
  const rows = data?.rows || [];
  const materials = Object.entries(data?.materialNames || {}).map(([id, name]) => ({ id, name, unit: "each" }));
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="All inventory movements and usage records"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Bulk transfer / add / use
            </Button>
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search materials, projects..."
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="add">Added</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
            <SelectItem value="use">Usage</SelectItem>
            <SelectItem value="receive">Received</SelectItem>
            <SelectItem value="return">Returned</SelectItem>
            <SelectItem value="count">Counted</SelectItem>
            <SelectItem value="adjust">Adjusted</SelectItem>
            <SelectItem value="shrink">Shrinkage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <PageBusy />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-12" />}
          title="No transactions found"
          description={query || type !== "all" ? "Try adjusting your filters" : "Start scanning materials to record transfers."}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((tx) => (
            <ActivityItem key={tx.id} tx={tx} materials={materials} locations={locations} />
          ))}
        </div>
      )}
      <BulkInventoryDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        materials={materials}
        onDone={reload}
      />
    </div>
  );
}
