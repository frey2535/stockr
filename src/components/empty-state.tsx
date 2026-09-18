import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-12 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex justify-center text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}
