# Stockr Elite Remediation Plan

This plan executes the mandatory legacy remediation program from `.cursor/rules/elite-engineering.mdc`. Changes are deliberately split into targeted reviewable PRs. No PR is to be merged or deployed without explicit user authorization.

## Engineering budgets / acceptance targets

These are engineering targets to validate, not claims of current performance.

- Tenant isolation: **0** cross-company reads/writes in adversarial test matrix.
- Inventory integrity: no negative stock unless explicitly supported; every successful mutation has exactly one corresponding audit event; duplicate/replayed commands do not double-apply.
- Bulk operations: all-or-none for a submitted batch.
- Purchasing: only explicitly authorized purchasing roles can create/approve/order/receive as defined by the permission matrix.
- Pricing: no numeric supplier price without verifiable provenance; missing price renders unavailable.
- Catalog scale: validate at **10,000** and **50,000** materials per company.
- Activity scale: validate at **100,000+** transactions per company.
- Concurrent field use: validate simultaneous inventory actions/reservations/receipts without lost updates or duplicate postings.
- API list endpoints: server-paginated; no unbounded tenant table loads on hot paths.
- Mobile: core receive/use/transfer/request flows usable at phone width without clipped controls or blocking menus.

## Remediation batches

### PR A — Legacy audit and release-gate baseline
**Priority:** P0  
**Changes:** audit docs, module inventory, risk register, test matrix.  
**Acceptance:** CI green; no production behavior changed.  
**Status:** In progress.

### PR B — Tenant-isolation write hardening
**Priority:** P0 / security  
**Files:** material/catalog persistence, supplier/rule persistence, field-ops ownership validation, tool/project write review.  
**Acceptance tests:**
- Company A cannot update/create using Company B material ID.
- Company A cannot update/create using Company B supplier/rule ID.
- Company A cannot create zones/bins/counts referencing Company B locations.
- Company A cannot count/reference Company B materials.
- Existing legitimate same-company edits still pass.

### PR C — Atomic inventory and reservation semantics
**Priority:** P0 / data integrity  
**Changes:** atomic bulk action RPC, atomic reservation allocation/release, idempotency keys, cycle-count double-submit protection.  
**Acceptance tests:**
- batch line failure rolls back entire batch,
- replayed idempotency key creates no duplicate transaction,
- two simultaneous reservations cannot exceed available,
- cycle-count submission is applied once.

### PR D — Purchasing authorization and transaction integrity
**Priority:** P0  
**Changes:** explicit purchasing permissions, PO create/update/receive authorization, immutable/reversal audit model, PO idempotency.  
**Acceptance tests:** unauthorized roles receive 403; repeated receipt does not double-stock; supplier/PO tenant IDs validated.

### PR E — Buildr integration contract
**Priority:** P0  
**Changes:** remove whole-company state replacement; define versioned endpoints/events for projects, material requests, approvals, purchasing, reservations, fulfillment; external IDs + unique constraints.  
**Acceptance tests:** standalone Stockr works without Buildr; standalone Buildr works without Stockr; linked companies sync once; replay is harmless; mismatched company IDs rejected.

### PR F — Catalog/import and all-trades hardening
**Priority:** P1  
**Changes:** robust CSV/XLSX catalog ingestion, validation/error report, duplicate identity resolution, custom categories/units, trade-neutral onboarding/sample data.  
**Acceptance:** representative electrical, plumbing, HVAC, concrete, general construction catalogs import correctly; no fake prices.

### PR G — Supplier intelligence hardening
**Priority:** P1  
**Changes:** provenance normalization, price freshness/expiry, currency/unit handling, public-vs-account price labels, supplier catalog mappings.  
**Acceptance:** price with missing evidence rejected; stale/expired price labeled; exact identity rules preserved.

### PR H — Large-tenant performance
**Priority:** P1  
**Changes:** benchmark harness, query/index tuning, pagination/search improvements, export streaming/batching.  
**Acceptance:** measured results for 10k/50k materials and 100k+ transactions are documented; no unbounded hot-path table scans.

### PR I — Offline-first field reliability
**Priority:** P1  
**Changes:** local catalog/inventory/location cache, mutation outbox, idempotent reconciliation, conflict UX, stale-data indicator.  
**Acceptance:** receive/use/transfer/request can be captured offline and sync exactly once after reconnect.

### PR J — Desktop/tablet/mobile UX
**Priority:** P1  
**Changes:** responsive field-mode audit, scanner flow, dialogs, bottom nav/sidebar, touch targets, accessibility.  
**Acceptance:** phone/tablet/desktop regression matrix completed; no clipped critical controls.

### PR K — Recovery, migrations, observability
**Priority:** P1  
**Changes:** ordered migration/version checks, readiness endpoint migration verification, structured audit/error IDs, backup/restore runbook.  
**Acceptance:** restore drill documented; deployment blocks on missing mandatory schema functions/tables.

### PR L — Final release gate
**Priority:** P0 before commercial declaration  
**Acceptance:** all critical/high findings closed, CI + DB integration + security + concurrency + performance + E2E evidence attached, no unresolved release blocker, explicit merge/deploy authorization.

## Test matrix to add

1. **Unit:** validation, permissions, pricing provenance, mappings.
2. **Database integration:** tenant isolation, FKs/ownership, transaction rollback, idempotency.
3. **API integration:** auth/403/404 behavior, company scoping, pagination.
4. **Security:** IDOR/cross-tenant IDs, role escalation, webhook signature/replay, SSO company mismatch.
5. **Concurrency:** inventory decrement/transfer, PO receipt, reservation, cycle counts.
6. **Performance:** large catalog, large activity ledger, search/filter, bulk import/export.
7. **Regression:** scanner, catalog CRUD, inventory CRUD, PO receiving, supplier management, Buildr sync.
8. **E2E/UI:** desktop/tablet/mobile core field workflows.
9. **Recovery/migration:** schema preflight, migration idempotence, backup restore.

## Remaining evidence required

- Staging Supabase credentials/environment for live integration tests.
- A non-production Buildr integration endpoint/tenant for end-to-end contract tests.
- Representative large catalog files or generated fixtures for performance testing.
- Backup/restore environment for destructive recovery drill.
