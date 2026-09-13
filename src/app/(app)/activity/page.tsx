"use client";

import { useMemo, useState } from "react";
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
import { actorLabel, downloadCsv, TX_META } from "@/lib/inventory";
import { formatDate, qty } from "@/lib/format";

export default function ActivityPage() {
  const { state } = useStore();
  const { settings, transactions, materials, locations } = state;
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (type !== "all" && tx.type !== type) return false;
      if (!q) return true;
      const material = materials.find((row) => row.id === tx.material_id);
      const from = locations.find((row) => row.id === tx.from_location_id);
      const to = locations.find((row) => row.id === tx.to_location_id);
      const hay = [
        material?.name,
        from?.name,
        to?.name,
        tx.project,
        tx.notes,
        tx.created_by,
        TX_META[tx.type].label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [transactions, materials, locations, query, type]);

  const exportCsv = () => {
    downloadCsv(
      "inventory-log.csv",
      ["When", "Type", "Material", "Qty", "From", "To", "Project", "Notes", "User"],
      rows.map((tx) => [
        formatDate(tx.created_at),
        TX_META[tx.type].label,
        materials.find((row) => row.id === tx.material_id)?.name || "",
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
        title="Inventory Log"
        description={`Full audit trail — ${rows.length} of ${transactions.length} records`}
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
            <SelectItem value="adjust">Adjusted</SelectItem>
            <SelectItem value="shrink">Shrinkage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-12" />}
          title={transactions.length === 0 ? "No activity yet. Scan some materials to get started!" : "No matching activity"}
          description={transactions.length === 0 ? undefined : "Try adjusting your search or filters"}
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
                const meta = TX_META[tx.type];
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
                      {materials.find((row) => row.id === tx.material_id)?.name || "Unknown"}
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
        </div>
      )}
    </div>
  );
}
