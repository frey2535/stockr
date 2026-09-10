# Stockr

Multi-tenant field inventory for warehouses and service fleets. Each company gets its own workspace, team, and plan. Scan barcodes, move material between shops and trucks, receive purchase orders, and export valuation, usage, and shrinkage reports.

Data lives in a local SQLite database (`data/stockr.db`). There is no Base44 SDK. Stripe is not required — plan upgrades use a mock checkout so you can test limits without a billing key.

## Run locally

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:43151** for local preview.

Production hostname is **https://stockr.currentflowconsulting.org**. Point that name at this app (CNAME or A record) and serve it over HTTPS so camera scanning and session cookies work.

### Demo company

- Email: `demo@stockr.app`
- Password: `demo1234`
- Company: Summit Electric on the Fleet plan, with sample warehouses, trucks, catalog, POs, and activity

### New company

Sign up from the marketing page to create an empty Starter workspace (2 locations, 50 materials, 2 seats). Invite a teammate from **Settings** and have them join with the code on `/signup`.

## Plans

| Plan    | Price | Locations | Materials | Seats |
| ------- | ----- | --------- | --------- | ----- |
| Starter | $0    | 2         | 50        | 2     |
| Pro     | $49   | 15        | 2,000     | 15    |
| Fleet   | $149  | Unlimited | Unlimited | Unlimited |

Upgrade from **Billing**. In this repo the checkout immediately activates the plan.

## What is included

- **Marketing, login, signup** — company workspace or join via invite code
- **Dashboard** — on-hand totals, estimated value, low-stock alerts, recent activity
- **Scanner** — camera barcode (Chromium `BarcodeDetector`), manual lookup, and plain-English actions (`add 25 screws to Main Warehouse`)
- **Inventory** — quantities by location, add / transfer / use / adjust / shrink
- **Locations** — warehouses and vehicles
- **Transfers & Activity Log** — full audit trail with CSV export
- **Catalog** — materials, barcodes, reorder points, printable CODE128 labels
- **Purchase Orders** — draft through received, with receive-into-location
- **Reports** — valuation by location, usage by project, shrinkage
- **Billing** — plan and seat/location limits
- **Settings** — branding, team list, invite codes, optional Buildr company ID

Camera scanning needs HTTPS or `localhost` and a browser that implements `BarcodeDetector`. Demo barcodes include `012345678901` (3/4" EMT) and `099887766554` (screws).

## Domain

Canonical host: **stockr.currentflowconsulting.org**

```bash
NEXT_PUBLIC_STOCKR_HOST=stockr.currentflowconsulting.org
NEXT_PUBLIC_APP_URL=https://stockr.currentflowconsulting.org
```

On production (`next start`), session cookies are marked `Secure` and scoped to that host. Local `npm run dev` keeps host-only cookies so http://127.0.0.1:43151 still signs in.

## Production notes

This slice is a self-hosted SaaS: accounts, sessions (httpOnly cookie), and per-company JSON state in SQLite. Before a public launch you will still want HTTPS on this domain, a hosted database, real Stripe keys, a privacy policy, and backups of `data/stockr.db`.
