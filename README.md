# Stockr

Field inventory for warehouses and service fleets. Scan barcodes, move material between shops and trucks, receive purchase orders, and export valuation, usage, and shrinkage reports.

This is a standalone Cursor copy of the Base44 Stockr app. It does **not** call Base44. Data lives in the browser (`localStorage`), so you can delete the Base44 project after you are comfortable with this version.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43151](http://localhost:43151). The first visit loads Summit Electric demo stock (warehouses, trucks, catalog, POs, and an activity log). Use **Settings → Reset demo data** to restore it.

## What is included

- **Dashboard** — on-hand totals, estimated value, low-stock alerts, recent activity
- **Scanner** — camera barcode (Chromium `BarcodeDetector`), manual lookup, and plain-English actions (`add 25 screws to Main Warehouse`)
- **Inventory** — quantities by location, add / transfer / use / adjust / shrink
- **Locations** — warehouses and vehicles
- **Transfers & Activity Log** — full audit trail with CSV export
- **Catalog** — materials, barcodes, reorder points, printable CODE128 labels
- **Purchase Orders** — draft through received, with receive-into-location
- **Reports** — valuation by location, usage by project, shrinkage
- **Settings** — company branding, Buildr company ID (stored locally), access codes

Camera scanning needs HTTPS or `localhost` and a browser that implements `BarcodeDetector`. If the camera is unavailable, type or paste the barcode — demo codes include `012345678901` (3/4" EMT) and `099887766554` (screws).
