import JsBarcode from "jsbarcode";
import type { Material } from "./types";
import { materialBarcode } from "./id";

export function renderBarcodePng(value: string) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 14,
    margin: 4,
  });
  return canvas.toDataURL("image/png");
}

export function printLabels(materials: Material[]) {
  if (materials.length === 0) return { error: "No materials to print labels for" };
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return { error: "Pop-up blocked. Allow pop-ups to print labels." };

  const cards = materials
    .map((material) => {
      const code = materialBarcode(material);
      const img = renderBarcodePng(code);
      return `<article class="label"><div class="name">${escapeHtml(material.name)}</div><img src="${img}" alt="${escapeHtml(code)}" /><div class="meta">${escapeHtml(material.category || "")}${material.sub_category ? " · " + escapeHtml(material.sub_category) : ""}</div></article>`;
    })
    .join("");

  win.document.write(`<!doctype html>
<html>
<head>
  <title>Stockr labels</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 16px; color: #111; }
    h1 { font-size: 14px; margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .label { border: 1px solid #d4d4d8; border-radius: 8px; padding: 8px; break-inside: avoid; }
    .name { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #71717a; }
    img { width: 100%; height: auto; }
    @media print { body { margin: 8px; } }
  </style>
</head>
<body>
  <h1>Stockr labels — ${materials.length}</h1>
  <div class="grid">${cards}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 250)<\/script>
</body>
</html>`);
  win.document.close();
  return { count: materials.length };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}
