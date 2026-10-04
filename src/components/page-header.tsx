import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="flex items-start gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <span className="min-w-0 leading-tight break-words">{title}</span>
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
