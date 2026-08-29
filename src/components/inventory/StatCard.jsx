import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, accent }) {
  return (
    <Card className="p-4 relative overflow-hidden group hover:shadow-lg transition-shadow flex flex-col justify-between">
      <div className="flex justify-between items-start gap-2">
        <p className="text-xs text-muted-foreground font-medium line-clamp-1 flex-1">{title}</p>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          accent ? "bg-secondary/10" : "bg-primary/5"
        )}>
          <Icon className={cn("w-4 h-4", accent ? "text-secondary" : "text-primary")} />
        </div>
      </div>
      <p className="text-xl font-bold tracking-tight break-words">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
      )}
    </Card>
  );
}