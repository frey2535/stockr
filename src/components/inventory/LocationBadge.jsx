import React from "react";
import { Warehouse, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LocationBadge({ location, className }) {
  if (!location) return null;
  
  const isWarehouse = location.type === "warehouse";
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        isWarehouse 
          ? "border-primary/30 text-primary bg-primary/5" 
          : "border-secondary/30 text-secondary bg-secondary/5",
        className
      )}
    >
      {isWarehouse ? <Warehouse className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
      {location.name}
    </Badge>
  );
}