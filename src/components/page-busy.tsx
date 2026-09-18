export function PageBusy() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
