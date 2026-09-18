import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: boolean;
  tone?: "default" | "ok" | "watch" | "action";
}) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {title}
          </p>
          <p
            className={cn(
              "mt-1 font-heading text-2xl font-bold tracking-tight",
              accent && "text-primary",
              tone === "ok" && "text-emerald-700 dark:text-emerald-400",
              tone === "watch" && "text-amber-700 dark:text-amber-400",
              tone === "action" && "text-red-700 dark:text-red-400",
            )}
          >
            {value}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              "bg-primary/10 text-primary",
              tone === "ok" && "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
              tone === "watch" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
              tone === "action" && "bg-red-600/10 text-red-700 dark:text-red-400",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
