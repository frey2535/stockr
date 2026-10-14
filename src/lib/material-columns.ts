export function materialColumnsToOmit(message: string) {
  const text = message.toLowerCase();
  const omit: string[] = [];
  if (/\bnpm\b/.test(text) || /\bmpn\b/.test(text)) omit.push("mpn");
  if (/\bupc\b/.test(text)) omit.push("upc");
  if (/\bsupplier_number\b/.test(text)) omit.push("supplier_number");
  if (/\baliases\b/.test(text)) omit.push("aliases");
  if (/schema cache|does not exist|could not find/.test(text) && omit.length === 0) {
    omit.push("mpn", "upc", "supplier_number");
  }
  return omit;
}
