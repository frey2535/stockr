import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LowStockAlerts({ materials = [], inventoryItems = [] }) {
  const lowStockItems = useMemo(() => {
    return materials
      .map((mat) => {
        const totalQty = inventoryItems
          .filter((i) => i.material_id === mat.id)
          .reduce((sum, i) => sum + (i.quantity || 0), 0);
        const reorderPoint = mat.reorder_point ?? null;
        const minStock = mat.min_stock_level ?? null;
        let status = null;
        if (minStock != null && totalQty <= minStock) status = "critical";
        else if (reorderPoint != null && totalQty <= reorderPoint) status = "reorder";
        return { ...mat, totalQty, reorderPoint, minStock, status };
      })
      .filter((m) => m.status !== null)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "critical" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [materials, inventoryItems]);

  if (lowStockItems.length === 0) return null;

  const criticalCount = lowStockItems.filter((i) => i.status === "critical").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Low Stock Alerts
          <Badge variant="secondary" className="ml-1">{lowStockItems.length}</Badge>
          {criticalCount > 0 && (
            <Badge className="bg-red-100 text-red-700">{criticalCount} critical</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lowStockItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 min-w-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                On hand: {item.totalQty} {item.unit || "units"}
                {item.reorderPoint != null && ` · Reorder at: ${item.reorderPoint}`}
              </p>
            </div>
            <Badge
              className={
                item.status === "critical"
                  ? "bg-red-100 text-red-700 flex-shrink-0"
                  : "bg-orange-100 text-orange-700 flex-shrink-0"
              }
            >
              {item.status === "critical" ? "Critical" : "Reorder"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}