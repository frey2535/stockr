"use client";

import { useState } from "react";
import { ClipboardList, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/lib/store";
import { usePagedApi } from "@/lib/use-api";
import { actorLabel, downloadCsv, TX_META } from "@/lib/inventory";
import { formatDate, qty } from "@/lib/format";
import type { ActivityListPayload } from "@/lib/workspace-types";

export default function ActivityPage() {
  const { workspace } = useStore();
  const { settings, locations } = workspace;
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type !== "all") params.set("type", type);
  const { data, hasMore, loadMore, loading } = usePagedApi<ActivityListPayload>(
    `/api/activity?${params.toString()}`,
  );
  const rows = data?.rows || [];
  const materialNames = data?.materialNames || {};

  const exportCsv = () => {
    downloadCsv(
      "inventory-log.csv",
      ["When", "Type", "Material", "Qty", "From", "To", "Project", "Notes", "User"],
      rows.map((tx) => [
        formatDate(tx.created_at),
        (TX_META[tx.type] || { label: tx.type }).label,
        materialNames[tx.material_id] || "",
        tx.quantity,
        locations.find((row) => row.id === tx.from_location_id)?.name || "",
        locations.find((row) => row.id === tx.to_location_id)?.name || "",
        tx.project || "",
        tx.notes || "",
        actorLabel(tx.created_by),
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="Inventory Log"
        description={`Every charge, transfer, receive, and count — ${rows.length} of ${data?.total || 0} records`}
        actions={
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
            ) : null}
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search materials, locations, projects..."
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

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-12" />}
          title={(data?.total || 0) === 0 ? "No activity yet. Scan some materials to get started!" : "No matching activity"}
          description={(data?.total || 0) === 0 ? undefined : "Try adjusting your search or filters"}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tx) => {
                const meta = TX_META[tx.type] || { label: tx.type, color: "bg-muted text-foreground border" };
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={meta.color}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {materialNames[tx.material_id] || "Unknown"}
                    </TableCell>
                    <TableCell>{qty(tx.quantity)}</TableCell>
                    <TableCell>
                      {locations.find((row) => row.id === tx.from_location_id)?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {locations.find((row) => row.id === tx.to_location_id)?.name || "—"}
                    </TableCell>
                    <TableCell>{tx.project || tx.notes || "—"}</TableCell>
                    <TableCell>{actorLabel(tx.created_by)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasMore ? (
            <Button variant="outline" className="mt-3 w-full" onClick={loadMore} disabled={loading}>
              {loading ? "Loading…" : `Load more (${rows.length} of ${data?.total || 0})`}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
