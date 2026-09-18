import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ListChecks, Minus, Plus, TriangleAlert, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { actorLabel, txMeta } from "@/lib/inventory";
import { formatDate, qty } from "@/lib/format";
import type { Location, Material, Transaction, TxType } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<TxType, LucideIcon> = {
  add: Plus,
  receive: ArrowDownToLine,
  return: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  use: Wrench,
  count: ListChecks,
  adjust: TriangleAlert,
  shrink: Minus,
};

export function ActivityItem({
  tx,
  materials,
  locations,
}: {
  tx: Transaction;
  materials: Material[];
  locations: Location[];
}) {
  const meta = txMeta(tx.type);
  const Icon = ICONS[tx.type] || TriangleAlert;
  const material = materials.find((row) => row.id === tx.material_id);
  const from = locations.find((row) => row.id === tx.from_location_id);
  const to = locations.find((row) => row.id === tx.to_location_id);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 transition-colors hover:bg-muted/50">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {material?.name || "Unknown material"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.type === "transfer"
            ? `${from?.name || "Unknown"} → ${to?.name || "Unknown"}`
            : tx.type === "add" || tx.type === "adjust" || tx.type === "receive" || tx.type === "return" || tx.type === "count"
              ? to?.name || from?.name || "Location"
              : from?.name || "Location"}
          {tx.project ? ` · ${tx.project}` : ""}
          {tx.notes ? ` · ${tx.notes}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Badge variant="outline" className={`border ${meta.color}`}>
          {meta.label} {qty(tx.quantity)}
        </Badge>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {actorLabel(tx.created_by)} · {formatDate(tx.created_at)}
        </p>
      </div>
    </div>
  );
}
