# Procurement Implementation Audit — 2026-10-14

Related: Buildr #157, Stockr #72. This is a source inspection, not a runtime verification.

## Verified from default branch source
- Buildr README identifies Vite/React + Fastify + Prisma/Postgres + Redis. `server/prisma/schema.prisma` defines company-scoped `Company`, `Project`, `MaterialCatalogItem` and `MaterialOrder` relations. Exact material request routes and permissions require deeper review.
- Stockr `src/app/api/catalog/route.ts` resolves authenticated account and calls `listCatalog(account.company.id,...)`.
- Stockr `src/lib/supplier-intelligence.ts` scopes supplier and supplier-offer reads/writes to `company_id` and validates supplier/material association within tenant.
- Stockr `src/lib/supplier-price-policy.ts` checks MPN/UPC matching and requires a source URL/reference for non-null price; this is evidence presence, NOT proof of live/current pricing.
- Existing `docs/BUILDR_STOCKR_INTEGRATION_CONTRACT.md` is explicitly draft v1.0. Contract proposal v1.1 is in the coordinated draft PRs.

## Critical scope rule
The electrical starter catalog belongs only to the **existing Day One Electric company tenant**, after verifying its actual Buildr and Stockr linked company IDs. Do not seed or expose it as a global or generic catalog. No production import has been authorized. Other companies remain free to create their own trade-neutral catalogs.

## Open blockers before runtime implementation
1. Locate Buildr material request endpoints/components and confirm role/project approver enforcement.
2. Confirm Stockr supplier pricing sources, permitted access methods, freshness and account-specific prices.
3. Verify both companies' server-side tenant mapping and RLS policies; negative cross-tenant tests are required.
4. Design idempotent official RFQ dispatch outbox with supplier communication consent, templates and sender settings.
5. Determine exact migration approach, historical data compatibility, and tests for quote-only versus procurement.
6. Verify Day One Electric tenant mapping without guessing or hardcoding an ID.

## Release gate
No claims of automatic live pricing, RFQ delivery or purchasing until end-to-end verification. No merging, deployment or production data changes without owner approval.
