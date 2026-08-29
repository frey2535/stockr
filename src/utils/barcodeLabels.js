import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";

// Generates a Stockr-internal Code-128-compatible barcode for materials that
// don't have a manufacturer UPC. Format: "STK" + last 8 hex chars of the
// material id (zero-padded). Unique per material.
export function generateInternalBarcode(materialId) {
  if (!materialId) return null;
  const hex = materialId.replace(/[^a-f0-9]/gi, "").slice(-8).toUpperCase().padStart(8, "0");
  return `STK${hex}`;
}

// Generates a PDF of Code-128 barcode labels for the given materials.
// Materials without a barcode get an internal one auto-assigned.
// Layout: 3 columns × 10 rows per Letter page (Avery 5160 style).
// Returns { count } on success or { error } on failure.
export function printLabels(materials) {
  if (!materials || materials.length === 0) {
    return { error: "No materials to print labels for" };
  }

  const labelW = 66;   // mm
  const labelH = 25;   // mm
  const gapX = 3;
  const gapY = 2;
  const marginX = 8;
  const marginY = 10;
  const cols = 3;
  const rows = 10;
  const perPage = cols * rows;

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 100;

  let idx = 0;
  for (const mat of materials) {
    const barcode = mat.barcode || generateInternalBarcode(mat.id);
    if (!barcode) continue;

    try {
      JsBarcode(canvas, barcode, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 4,
      });
    } catch (e) {
      console.warn("Barcode render failed for", mat.name, e);
      continue;
    }

    const localIdx = idx % perPage;
    if (idx > 0 && localIdx === 0) {
      doc.addPage();
    }

    const col = localIdx % cols;
    const row = Math.floor(localIdx / cols);
    const x = marginX + col * (labelW + gapX);
    const y = marginY + row * (labelH + gapY);

    // Material name (small, top of label)
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const name = (mat.name || "").slice(0, 42);
    doc.text(name, x + 2, y + 4);

    // Barcode image
    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", x + 2, y + 5, labelW - 4, labelH - 7);

    idx++;
  }

  if (idx === 0) {
    return { error: "No valid materials to print" };
  }

  doc.save("stockr-labels.pdf");
  return { count: idx };
}