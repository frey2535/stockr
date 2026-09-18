export function uid(prefix = "id") {
  const raw =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${raw.replace(/-/g, "").slice(0, 10)}`;
}

export function stockBarcode(id: string) {
  return `STK${id.replace(/[^a-f0-9]/gi, "").slice(-8).toUpperCase().padStart(8, "0")}`;
}

export function materialBarcode(material: { id: string; barcode?: string }) {
  return material.barcode || stockBarcode(material.id);
}
