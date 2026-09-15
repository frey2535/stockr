"use client";

import Link from "next/link";
import { ArrowRightLeft, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { qty } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { RestockNeed } from "@/lib/types";

export function RestockBoard({
  rows,
  onDone,
  compact = false,
}: {
  rows: RestockNeed[];
  onDone?: () => Promise<void> | void;
  compact?: boolean;
}) {
  const { applyRestock } = useStore();

  const apply = async (row: RestockNeed) => {
    const result = await applyRestock(
      row.suggestion.kind === "transfer"
        ? {
            kind: "transfer",
            materialId: row.materialId,
            locationId: row.locationId,
            fromLocationId: row.suggestion.fromLocationId,
            quantity: row.suggestion.quantity,
          }
        : {
            kind: "draft_po",
            materialId: row.materialId,
            locationId: row.locationId,
            quantity: row.suggestion.quantity,
            supplier: row.suggestion.supplier,
          },
    );
    if (!result.ok) {
      toast.error(result.error || "Could not apply restock.");
      return;
    }
    toast.success(
      row.suggestion.kind === "transfer"
        ? `Transferred ${qty(row.suggestion.quantity)} ${row.materialName} to ${row.locationName}`
        : `Draft PO added for ${qty(row.suggestion.quantity)} ${row.materialName}`,
    );
    await onDone?.();
  };

  if (!rows.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Truck restock</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Every location is at or above min. Set per-location min/max from Inventory to get suggested transfers
            and draft POs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const shown = compact ? rows.slice(0, 6) : rows;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            Truck restock
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          {compact ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/restock">View all</Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {shown.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.materialName}</p>
              <p className="text-xs text-muted-foreground">
                {row.locationName}: {qty(row.onHand)} {row.unit} on hand · min {qty(row.min)}
                {row.max !== row.min ? ` · max ${qty(row.max)}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.suggestion.kind === "transfer"
                  ? `Move ${qty(row.suggestion.quantity)} from ${row.suggestion.fromLocationName}`
                  : `Draft PO ${qty(row.suggestion.quantity)} from ${row.suggestion.supplier}`}
              </p>
            </div>
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={() => apply(row)}
            >
              {row.suggestion.kind === "transfer" ? (
                <>
                  <ArrowRightLeft className="mr-2 size-4" />
                  Transfer
                </>
              ) : (
                <>
                  <PackagePlus className="mr-2 size-4" />
                  Draft PO
                </>
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
