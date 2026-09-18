export type StockStatus = "out" | "critical" | "low" | "ok";

export function stockStatus(opts: {
  quantity: number;
  min?: number | null;
  reorder?: number | null;
  belowMin?: boolean;
}): StockStatus {
  const qty = Number(opts.quantity) || 0;
  if (qty <= 0) return "out";
  if (opts.belowMin) return "critical";
  if (opts.min != null && qty <= opts.min) return "critical";
  if (opts.reorder != null && qty <= opts.reorder) return "low";
  return "ok";
}

export function stockStatusLabel(status: StockStatus) {
  if (status === "out") return "Out";
  if (status === "critical") return "Critical";
  if (status === "low") return "Low";
  return "In stock";
}
