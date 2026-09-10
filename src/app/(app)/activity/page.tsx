"use client";

import { ClipboardList, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const exportCsv = () => {
    downloadCsv(
      "inventory-log.csv",
      ["When", "Type", "Material", "Qty", "From", "To", "Project", "Notes", "User"],
      transactions.map((tx) => [
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
        description={`Full audit trail — ${transactions.length} records`}
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

      {transactions.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-12" />}
          title="No activity yet. Scan some materials to get started!"
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
              {transactions.map((tx) => {
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
