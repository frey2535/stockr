# Stockr review of Buildr–Stockr shared procurement contract

Status: REVIEW REQUIRED, not approved or implemented. Source proposal: https://github.com/frey2535/Buildr/pull/135 ; coordinating issues: Stockr #60 and Buildr #134.

## Ownership
Buildr alone owns material requests, project assignments, approval authority and purchasing authorization. Stockr alone owns catalog items, SKUs, inventory records, on-hand/reserved stock quantities and immutable inventory transactions. Stockr may only act on a protected issue/reservation with validated Buildr authorization. Never fake supplier pricing or purchase confirmation.

## Contract prerequisites
Agree on versioned request/event JSON schemas, stable cross-app IDs, explicit company mapping, authenticated tenant-scoped endpoints, permission/entitlement checks, catalog unit-of-measure and price provenance, durable outbox/inbox, event deduplication, idempotent commands, monotonic revisions, retries, visible errors, ledger reversals and reconciliation. Neither app directly edits the other's database.

## Required Stockr signoff
Review Buildr PR #135 proposal and document concrete Stockr catalog, reservation, issue and ledger APIs, exact event fields, error behavior, duplicate constraints and company-ID validation. Add executable contract tests: cross-tenant forgery rejection, duplicate/retry/concurrent movement exactly once, unapproved request denial, stale event handling, outage recovery and quantity reconciliation. Do not modify shared integration behavior until both agents agree on contract and acceptance tests.

## Release gate
No merge, deploy, destructive migration or production data changes without explicit user approval. This review note does not constitute agent signoff or verified tests.
