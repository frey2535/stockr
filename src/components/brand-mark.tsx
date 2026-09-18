import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  subtitle = "Inventory Mgmt",
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Stockr"
        width={compact ? 28 : 36}
        height={compact ? 28 : 36}
        className="rounded-xl object-cover"
        style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}
      />
      <div>
        <div
          className={cn(
            "font-extrabold tracking-wide text-foreground",
            compact ? "text-[15px]" : "text-base",
          )}
        >
          STOCK<span className="text-brand">R</span>
        </div>
        {!compact && subtitle ? (
          <p className="text-[9px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
