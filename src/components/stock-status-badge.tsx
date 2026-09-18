import { Badge } from "@/components/ui/badge";
import { stockStatusLabel, type StockStatus } from "@/lib/stock-status";
import { cn } from "@/lib/utils";

const TONE: Record<StockStatus, string> = {
  out: "border-transparent bg-red-600/15 text-red-700 dark:text-red-400",
  critical: "border-transparent bg-red-600/15 text-red-700 dark:text-red-400",
  low: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-400",
  ok: "border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
};

export function StockStatusBadge({
  status,
  className,
}: {
  status: StockStatus;
  className?: string;
}) {
  return (
    <Badge className={cn("font-semibold tracking-wide uppercase", TONE[status], className)}>
      {stockStatusLabel(status)}
    </Badge>
  );
}
