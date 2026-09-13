# Stockr

Multi-tenant field inventory for warehouses and service fleets. Each company gets its own workspace, team, and plan. Scan barcodes, move material between shops and trucks, receive purchase orders, and export valuation, usage, and shrinkage reports.

Company data belongs in **Stockr’s own Supabase project** (Postgres). Do not reuse the NECalcul8r or The Truth project — those apps have their own databases. The browser only loads the current page of inventory, activity, or catalog — not the whole company. If Supabase keys are missing, the app falls back to a local SQLite file (`data/stockr.db`) so preview still works. Production must use Supabase. Stripe is not required — plan upgrades use a mock checkout.

## GitHub

Public repo: [github.com/frey2535/stockr](https://github.com/frey2535/stockr)

Open a pull request for app changes. GitHub Actions runs lint and `next build` on every PR (`.github/workflows/ci.yml`). Merging to `main` deploys this Next.js app to Cloudflare Pages project `stockr` (`.github/workflows/deploy.yml`). Do not pick the Webpack, Deno, or Jekyll Action templates. There is no Base44 or Vite deploy path.

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

Create a **dedicated Supabase project for Stockr** (CurrentFlow Consulting org is fine; the project must not be NECalcul8r or The Truth).

In that project’s SQL Editor, paste and run **only** [`supabase/schema.sql`](supabase/schema.sql). That file creates `stockr_*` tables. It does **not** use `public.profiles`. If you see `type "public.profiles" does not exist` / `actor public.profiles`, you pasted a NECalcul8r fix — stop and run this repo’s schema instead.

1. **Project Settings → API**: copy this Stockr project’s URL and the **service role** key (server only, never ship it to the browser)
2. Put them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STOCKR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

3. Restart the app. Settings will say the workspace database is Supabase. The demo company is created there on first boot if it does not exist.

Invite codes are indexed by code, so joining a company does not scan every tenant.

## Deploy (GitHub PR → Cloudflare)

Same loop as The Truth: open a PR, merge `main`, Actions publishes the site.

1. **CI** (every PR and every push to `main`) — lint + `next build`
2. **Deploy** (push to `main` only) — OpenNext build, then `wrangler pages deploy` to Pages project **`stockr`** (same target as The Truth’s `thetruth`)

Add these GitHub Actions secrets (repo **Settings → Secrets and variables → Actions**):

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Same Pages token The Truth uses |
| `CLOUDFLARE_ACCOUNT_ID` | Same account as The Truth |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_REF.supabase.co` (not the dashboard URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Stockr service-role key (server only) |

In the Cloudflare dashboard, **turn off automatic Git builds** on Pages project `stockr`. Actions uploads the Next.js build; the old Vite/Base44 Git builder is what fails the extra “Cloudflare Pages” check.

Custom domain: `stockr.currentflowconsulting.org` → `stockr.pages.dev`. Target is **not** `frey2535.github.io` and **not** `cname.vercel-dns.com`.

Keep the service role key on the server only. Use real Stripe when you are ready to charge.

## Google Play and selling outside the store

Package name (type this in Play Console, never change it):

```
org.currentflowconsulting.stockr
```

The Android app is a Capacitor wrapper that opens the live site. People subscribe on the website (Starter / Pro / Fleet). Play is only the install channel.

### One-time machine setup

```bash
npm install
npm run android:sdk
npm run android:keystore
```

Back up `android/keystore/` (the `.jks` and `key.properties`). If you lose that folder you cannot update the Play app.

### Build files

```bash
npm run android:bundle   # dist/android/stockr-release.aab  → upload in Play Console
npm run android:apk      # public/downloads/stockr.apk     → sideload / website
```

Play listing copy, privacy URL, and screenshot notes: [`store/google-play/LISTING.md`](store/google-play/LISTING.md).

### Sell without Play

1. Create the company and pick a plan at `/signup` and `/billing` (or `/download`).
2. Install the APK from `/download` (allow unknown sources) or use the browser.
3. Privacy and terms for stores and sideload: `/privacy` and `/terms`.

The website must be live on HTTPS (`stockr.currentflowconsulting.org`) before the Android wrapper is useful on a phone.
