# Stockr

Multi-tenant field inventory for warehouses and service fleets. Each company gets its own workspace, team, and plan. Scan barcodes, move material between shops and trucks, receive purchase orders, and export valuation, usage, and shrinkage reports.

Company data belongs in **Supabase** (Postgres). Tables are named `stockr_*` so they can live in the same project as another app. If Supabase keys are missing, the app falls back to a local SQLite file (`data/stockr.db`) so preview still works. Stripe is not required — plan upgrades use a mock checkout.

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

On production (`next start` or Vercel), session cookies are marked `Secure` and scoped to that host. Local `npm run dev` keeps host-only cookies so http://127.0.0.1:43151 still signs in.

## Supabase

Use the same Supabase project as your other app. Stockr only creates `stockr_*` tables.

1. In Supabase: **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql)
2. **Project Settings → API**: copy the project URL and the **service role** key (server only, never ship it to the browser)
3. Put them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

4. Restart the app. Settings will say the workspace database is Supabase. The demo company is created there on first boot if it does not exist.

Invite codes are indexed by code, so joining a company does not scan every tenant.

## Put this app on stockr.currentflowconsulting.org

The domain already exists. It still opens the old Base44 site. These three steps switch it to this app.

### 1. Publish this repo to Vercel

Use the **Publish** button in Cursor, or run `npx vercel` while logged in.

In the Vercel project, add these environment variables (same values as `.env.local`):

```bash
NEXT_PUBLIC_STOCKR_HOST=stockr.currentflowconsulting.org
NEXT_PUBLIC_APP_URL=https://stockr.currentflowconsulting.org
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

SQLite cannot persist on Vercel. The two Supabase keys are required there.

### 2. Attach the domain in Vercel

**Project → Settings → Domains → Add** `stockr.currentflowconsulting.org`.

Vercel will show a CNAME target, usually `cname.vercel-dns.com`.

### 3. Point Cloudflare at Vercel (not Base44)

In Cloudflare, for the `currentflowconsulting.org` zone:

| Field | Value |
| ----- | ----- |
| Type | CNAME |
| Name | `stockr` |
| Target | `cname.vercel-dns.com` (or the target Vercel shows) |
| Proxy | DNS only (grey cloud), or Proxied with SSL mode **Full (strict)** |

Save. After DNS updates, `https://stockr.currentflowconsulting.org` and `/login` should open this Next.js app, not the Base44 Vite page.

Keep the service role key on the server only. Use real Stripe when you are ready to charge.
