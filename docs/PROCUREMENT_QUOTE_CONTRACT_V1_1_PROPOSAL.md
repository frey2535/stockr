# Buildr–Stockr Quote and Procurement Contract Extension (proposal v1.1)

Status: **Stockr implements v1.1**. Official RFQ delivery evidence and quote comparison remain Buildr-owned. Coordinate Buildr #157 and Stockr #72 before claiming cross-app completion.

## Ownership
Buildr owns request intent, project, requester, official RFQ dispatch and responses, quote comparison, approval, purchasing authorization and PO lifecycle. Stockr owns trade-neutral material identities, supplier SKU mappings, verified online price observations, inventory availability, reservations, and inventory ledger. No cross-app direct writes to the other owner's records.

## Request intent
`request_type`: `QUOTE_ONLY` or `PROCUREMENT`. Explicit selection is mandatory. Quote-only cannot reserve, authorize purchases, or submit orders. Conversion to procurement creates an audited intent transition and triggers fresh authorization; it never inherits purchasing authorization.

## Parallel workflows on submission
1. Buildr persists request and immutable requested lines; creates idempotent jobs for online-price collection and official RFQ dispatch.
2. Stockr matches items by manufacturer/MPN/UPC and supplier SKU, unit, pack size, specification and approved equivalent rules. Uncertain matches require review.
3. Online baseline captures verified source URL, retrieval timestamp, account scope, supplier, SKU, currency, unit, package quantity, net unit price, available quantity if verified, and source method. Missing/unverifiable prices remain NULL and explicitly unpriced. Supplier web retrieval must be authorized and respect supplier restrictions.
4. Buildr dispatches official RFQ to configured company-approved suppliers using supported channels, with per-supplier message IDs and retry-safe outbox; delivery is not assumed without evidence.
5. Official quotes are ingested and matched by item, unit and package quantity. Compare item and delivered totals, freight, taxes, substitutions, availability, quote expiry and lead time. Preserve original documents and snapshots.
6. Procurement requests check inventory, then require server-side purchasing authorization before any reservation/order. An approved request is not itself purchasing authorization. Quote-only ends at comparison and may convert.

## Event envelope
Every cross-app message includes `contract_version`, `event_id`, `company_id`, `source_app`, `occurred_at`, authenticated integration identity, stable request and line IDs, and optional `correlation_id`. Tenant linkage must be resolved server-side, not trusted from client-provided company_id. Persist uniqueness for (company_id,event_id) and separately for RFQ dispatch, PO submission, reservation and receipt business keys.

## Safety
No fabricated or stale-as-live pricing, no unauthorized website scraping, no unconfirmed orders labeled submitted, no duplicate supplier RFQs after retries, no inventory movement from quote-only, no cross-company reads. When suppliers lack API or permitted authenticated access, online-price observation is unavailable and RFQ continues. Stockr must remain operational without Buildr and vice versa.

## Required acceptance tests
- Quote-only request triggers pricing + RFQ but cannot reserve or order, even with crafted API calls.
- Procurement request triggers both jobs and cannot order without authorization.
- Converting quote-only to procurement resets authorization.
- Online missing price remains null; UOM/pack mismatches cannot silently compare.
- Supplier RFQ retries send at most once per supplier/request/revision (or reconcile ambiguous send result before retry).
- Duplicate events, purchase attempts and receipts do not duplicate effects.
- Cross-tenant and unlinked-company requests rejected.
- Supplier quote uploads cannot overwrite immutable baseline; comparison preserves source snapshots.
- Outages, partial quotes, substitutions and supplier unavailability display honest status.
- Existing project sync and Stockr ledger regression tests pass.

Implementation sequencing: audit existing code and tests; approve contract; add additive schema migrations; implement pricing adapters and RFQ outbox; add UI and comparison; test both apps; separate PRs; **no merge or deployment without owner approval**.
