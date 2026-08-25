"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ActivityItem } from "@/components/activity-item";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";

export default function TransfersPage() {
  const { state } = useStore();
  const { settings, transactions, materials, locations } = state;
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    return transactions.filter((tx) => {
      if (type !== "all" && tx.type !== type) return false;
      const material = materials.find((row) => row.id === tx.material_id);
      const hay = `${material?.name || ""} ${tx.project || ""} ${tx.notes || ""}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });
  }, [transactions, materials, query, type]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="All inventory movements and usage records"
        actions={
          settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
          ) : null
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
            <SelectItem value="adjust">Adjusted</SelectItem>
            <SelectItem value="shrink">Shrinkage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
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
    </div>
  );
}
