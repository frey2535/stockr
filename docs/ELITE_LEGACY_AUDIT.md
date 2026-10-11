# Stockr Elite Legacy Engineering Audit

**Standard:** `.cursor/rules/elite-engineering.mdc`  
**Scope:** Entire existing Stockr application, retroactive to legacy code.  
**Commercial-readiness status:** **NOT READY FOR UNRESTRICTED COMMERCIAL ROLLOUT**. Critical tenant-isolation, transactional, integration, scale, and verification gaps remain.

## Status legend

- **Verified** — implementation and relevant automated evidence reviewed.
- **Partially compliant** — working foundation exists, but required edge cases/coverage are incomplete.
- **Failing** — current implementation conflicts with an explicit requirement or creates a release-blocking risk.
- **Untested** — implementation exists but required proof has not been executed.
- **N/A** — not applicable.

## Codebase inventory

Current repository contains approximately 300 tracked files, including:

- 34 API route files under `src/app/api`
- 16 authenticated application pages under `src/app/(app)`
- inventory/catalog/purchasing/supplier/auth/integration logic under `src/lib`
- Supabase schema plus production migrations under `supabase/`
- CI and deploy workflows under `.github/workflows/`
- existing unit/regression tests under `src/lib/*.test.ts`

## Module-by-module audit

| Area | Status | Evidence / current behavior | Required remediation |
|---|---|---|---|
| Authentication/session | Partially compliant | `src/lib/auth.ts` uses HttpOnly session cookie, secure on HTTPS/canonical host, SameSite=Lax, server-side session lookup. | Add adversarial session tests, CSRF review for all state-changing routes, session fixation/rotation verification, brute-force/rate-limit verification. |
| Company tenant isolation | **Failing** | Most reads scope by authenticated `account.company.id`, but several write paths accept caller-supplied record/reference IDs without proving those IDs belong to the authenticated company. | Centralize ownership assertions and add live-database cross-tenant integration tests. |
| Material/catalog writes | **Failing** | `src/lib/persist-command.ts::persistMaterial` loads an existing material by `id + company_id`; if not found, the supplied ID can still flow into an upsert. Because material `id` is a global PK, a guessed ID from another tenant can conflict with another company's row. | Reject edits whose ID is not owned by the current company; never let client-supplied IDs create/claim records. Add regression test. |
| Supplier writes | **Failing** | Supplier and sourcing-rule APIs are company-authenticated, but save helpers accept an optional caller-supplied ID. Global PK upsert behavior must not be allowed to reassign another tenant's record. | Scoped update-or-generated-create semantics. Add cross-company supplier/rule tests. |
| Field operations references | **Failing** | `createZone`, `createBin`, `startCycleCount`, and some count-line paths write `company_id` but do not consistently prove referenced location/material IDs belong to that company before insert/update. | Add ownership checks and preferably composite tenant foreign-key constraints where practical. |
| Inventory single actions | Partially compliant | `stockr_apply_inventory_action` provides atomic single-action inventory + transaction posting and validates material/location ownership. | Remove/disable legacy race-prone fallbacks on production write paths; add idempotency key support and concurrent execution tests. |
| Inventory bulk actions | **Failing** | `applyBulkActions` loops through actions and commits each separately. If line N fails, prior lines remain committed. | Add atomic bulk RPC/transaction or explicit all-or-none command semantics. |
| Inventory transaction deletion | Partially compliant | Delete is tenant-scoped, but deleting audit history can undermine traceability. | Replace destructive delete with reversal/correction workflow or admin-only immutable audit semantics. |
| Inventory reservations | Partially compliant | Availability calculation exists and tenant query is scoped. | Make reservation allocation atomic with inventory availability to avoid race oversubscription. |
| Cycle counts | Partially compliant | Counts post through atomic inventory action path. | Submit entire count session atomically; prevent double submission; lock/transition state with compare-and-set. |
| Catalog listing/search | Partially compliant | Server pagination exists; filters/search exist. | Prove behavior/performance at 10k/50k+ materials; add trigram/full-text/index strategy as required by measured results. |
| Bulk catalog import | Partially compliant | UI/import workflow exists. | Validate streaming/batched insertion, duplicate identity handling, rollback/error reporting, thousands-row performance. |
| Purchasing / POs | Partially compliant | PO creation and atomic receiving RPC exist. | Enforce explicit purchasing permission distinct from generic warehouse roles; add idempotency and duplicate receive protection tests; prevent unauthorized supplier/order actions. |
| Supplier pricing | Partially compliant | `supplier-price-policy` requires evidence; supplier page extraction requires exact MPN/UPC before accepting structured offer price; UI can show Price unavailable. | Audit all import/manual/API paths, source freshness, currency/unit normalization, negotiated-vs-public price labeling; never infer missing prices. |
| Preferred suppliers | Partially compliant | Company supplier list, priority, approval/enabled flags, category/manufacturer rules exist. | Add scalable catalog ingestion and supplier-specific mapping/normalization; add permission/audit history. |
| All-trades support | Partially compliant | Core models are generic and supplier/category rules are trade-neutral. | Remove electrical-biased sample/default wording where it can affect production behavior; test plumbing/HVAC/concrete/general-trade catalogs. |
| Buildr project sync | **Failing requirement** | `src/app/api/buildr/sync/route.ts` syncs project/job list only. | Replace with explicit, versioned integration contracts for material requests, approvals, purchasing, reservations, fulfillment, and inventory events. |
| Buildr sync persistence | **Failing** | Current route reads full company state, merges projects, then calls `setCompanyState`; this can conflict with concurrent Stockr mutations and is broader than necessary. | Target project rows only; remove whole-state replacement from sync. |
| Duplicate Buildr/Stockr records | Untested | No demonstrated end-to-end idempotency contract for material requests or procurement events. | Add external event IDs/idempotency keys, unique constraints, replay tests. |
| Authorization model | Partially compliant | Server-side command and field-ops role gates exist. | Separate purchasing approval/ordering permissions; audit every API route against explicit permission matrix. |
| Admin/platform switching | Untested | Platform/admin routes exist. | Add tenant escape tests, owner/admin-only enforcement tests, audit logging. |
| Billing | Partially compliant | Stripe webhook signature validation exists. | Add webhook replay/idempotency tracking and subscription transition regression tests. |
| Offline behavior | **Failing enterprise target** | Current `offline-queue.ts` queues mutations but is not a full offline inventory/catalog mirror. | Add local data cache, conflict model, idempotent replay, stale-data indicators, sync telemetry. |
| Mobile/tablet UI | Partially compliant | Mobile bottom nav and responsive screens exist. | Execute viewport/accessibility/field-use audit; large touch targets, camera/scanner, dialogs, long lists, offline state, landscape tablet. |
| Company branding | Partially compliant | Logo/settings support exists. | Verify sidebar-only presentation and mobile consistency after pending UI PRs. |
| Database migrations | Partially compliant | Schema and ad-hoc migrations exist. | Establish ordered migration ledger/version table, deployment preflight, migration compatibility tests, rollback guidance. |
| RLS / service role model | Partially compliant | RLS is enabled with deny policies; server service role performs data access. | Since service role bypasses RLS, server scoping is the primary isolation boundary; every query/write must be reviewed and integration-tested. |
| Backups/recovery | Untested | No evidence in current audit of a tested tenant restore drill. | Define backup/restore RPO/RTO and execute restore test before commercial readiness. |
| Observability | Partially compliant | Client error API and server logging exist. | Add correlation IDs, structured mutation/audit logs, sync failure metrics, supplier lookup provenance metrics. |
| Performance | **Untested** | Pagination and indexes exist, but no measured large-tenant benchmark evidence. | Benchmark 10k/50k catalog items, 100k+ inventory transactions, concurrent scanners, supplier search, exports. |
| Automated tests | Partially compliant | Existing unit/regression suite covers parsing, tenant helpers, permissions, pricing policy, production flags, etc. | Add database integration, API authorization, concurrency, migration, Buildr contract, performance, UI/E2E tests. |

## Critical release blockers discovered in baseline audit

### CRITICAL-01 — Cross-tenant record-ID upsert risk
**Files:** `src/lib/persist-command.ts`, `src/lib/supplier-intelligence.ts`  
**Reproduction concept:** authenticated Company A submits an edit/create payload containing an ID that belongs to Company B. Some paths scope the initial read, but then use a global-PK upsert if no Company A row is found.  
**Required result:** operation must return not-found/forbidden and Company B row must remain byte-for-byte unchanged.

### CRITICAL-02 — Field-operation cross-tenant reference integrity
**Files:** `src/lib/field-ops.ts`, `supabase/schema.sql`  
**Reproduction concept:** Company A supplies a Company B location/material ID to a zone/bin/count operation.  
**Required result:** write is rejected before insert/update; no cross-tenant FK relationship can exist.

### CRITICAL-03 — Buildr integration does not satisfy required workflow
**Files:** `src/app/api/buildr/sync/route.ts`, `src/lib/buildr.ts`  
**Current behavior:** project list sync only.  
**Required result:** independently operable apps with idempotent, tenant-scoped material-request, approval, purchasing, reservation/fulfillment, and inventory synchronization.

### HIGH-01 — Bulk inventory is not all-or-none
**File:** `src/lib/persist-command.ts`  
**Current behavior:** actions commit sequentially.  
**Required result:** if any line fails validation/posting, no line from the bulk command changes inventory or audit history.

### HIGH-02 — Reservation race
**File:** `src/lib/field-ops.ts`  
**Current behavior:** on-hand and reserved totals are read before reservation insert without a single database transaction/lock.  
**Required result:** simultaneous reservations cannot allocate more than available quantity.

### HIGH-03 — Whole-company state replacement in Buildr sync
**File:** `src/app/api/buildr/sync/route.ts`  
**Current behavior:** get state → replace projects in memory → save state.  
**Required result:** only project/integration rows are mutated; concurrent inventory/catalog activity cannot be overwritten.

## Baseline acceptance evidence

Existing CI scripts execute:
- `npm test`
- `npm run lint`
- `npm run build`

These are necessary but **not sufficient** for enterprise readiness. No claim is made here that live Supabase isolation, concurrent mutation, large-tenant performance, or Buildr end-to-end integration has passed.

## Commercial-readiness decision

**Blocked.** Stockr must not be declared commercially ready until:
1. all critical/high data-integrity and tenant-isolation findings are corrected,
2. required database/API integration tests pass,
3. Buildr procurement integration is complete and idempotent,
4. large-catalog/load targets are measured and met,
5. backup/restore and migration procedures are verified,
6. final release is explicitly authorized.
