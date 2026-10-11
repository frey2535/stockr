# Buildr ↔ Stockr Integration Contract

**Status:** Draft for joint approval by the Buildr and Stockr engineering agents.  
**Rule:** No shared integration behavior may change until both sides implement the same contract version.

## 1. System ownership

### Buildr is authoritative for
- material requests
- project assignments
- request approval authority
- approval decisions/status
- purchasing authorization
- project/user/request identity for procurement workflows

### Stockr is authoritative for
- catalog/material master records
- supplier mappings attached to Stockr catalog records
- inventory locations/zones/bins
- on-hand quantities
- reservations against Stockr inventory
- inventory transactions/movement audit history
- receiving effects on inventory

Neither application may directly overwrite the other application's owned records.

## 2. Shared identifiers

Every cross-app payload must include:

- `contract_version`
- `company_id`
- `event_id` or `idempotency_key`
- `occurred_at`
- `source_app`
- stable external object ID, e.g. `buildr_request_id`, `buildr_project_id`, `stockr_material_id`
- actor/user identity where authorization/audit requires it

A receiving app must reject a payload whose `company_id` does not match the authenticated/linked company context.

## 3. Idempotency

- Replaying the same `event_id` must not create a duplicate request, approval, PO, reservation, receipt, or inventory transaction.
- Cross-app mutations must persist the external event ID and enforce uniqueness at the company boundary.
- Network retry, timeout retry, and webhook replay must be safe.

## 4. Material-request lifecycle

1. Buildr creates and owns the material request.
2. Buildr associates the request to its project and requester.
3. Buildr applies approval routing and records the approval decision.
4. Once approved, Buildr may ask Stockr for availability/reservation information.
5. Stockr may reserve available stock and report shortage quantities.
6. Buildr remains the authority that decides whether a shortage is authorized for purchase.
7. Stockr must not independently turn an unapproved Buildr request into a purchase.

### Minimum request payload from Buildr to Stockr

```json
{
  "contract_version": "1.0",
  "event_id": "evt_...",
  "company_id": "co_...",
  "buildr_request_id": "mr_...",
  "buildr_project_id": "prj_...",
  "status": "approved",
  "purchasing_authorized": false,
  "requested_by": "user/email",
  "lines": [
    {
      "external_line_id": "mrl_...",
      "stockr_material_id": "mat_...",
      "manufacturer": null,
      "mpn": null,
      "upc": null,
      "description": "Item description",
      "quantity": 10,
      "unit": "ea"
    }
  ],
  "occurred_at": "ISO-8601"
}
```

Stockr must not infer approval or purchasing authorization from request presence alone.

## 5. Inventory response

Stockr may return:

- on hand
- reserved
- available
- shortage
- candidate source locations
- reservation IDs
- fulfillment state

Stockr quantity data is authoritative.

### Minimum availability response

```json
{
  "contract_version": "1.0",
  "company_id": "co_...",
  "buildr_request_id": "mr_...",
  "lines": [
    {
      "external_line_id": "mrl_...",
      "stockr_material_id": "mat_...",
      "on_hand": 25,
      "reserved": 5,
      "available": 20,
      "requested": 30,
      "shortage": 10,
      "reservation_id": "res_..."
    }
  ]
}
```

## 6. Purchasing authorization

Buildr owns authorization.

Stockr may:
- calculate shortage
- expose supplier/catalog/verified-price information
- prepare purchasing data

Stockr must not:
- mark a Buildr request purchasing-authorized
- create an externally actionable purchase order for a Buildr-owned request unless the contract carries Buildr authorization

Any purchasing handoff must include:
- `buildr_request_id`
- `authorization_id`
- `authorized_by`
- `authorized_at`
- `company_id`
- authorized line quantities

## 7. Receiving and fulfillment

Stockr owns the resulting inventory movement.

Receiving flow:
1. authorized purchase/receipt is identified
2. Stockr records receipt exactly once
3. Stockr updates inventory transactionally
4. Stockr reports receipt/fulfillment status back to Buildr
5. Buildr updates its request/procurement status from the returned event, but does not directly alter Stockr quantities

## 8. Project sync

Buildr is authoritative for project identity/assignment.

Stockr may cache project references required for inventory usage, reservations, receiving, and reporting.

Project sync must:
- update only Stockr project-reference rows
- never use whole-company state replacement
- preserve concurrent Stockr inventory/catalog writes
- treat missing/archived Buildr projects explicitly rather than deleting history

## 9. Failure behavior

- Missing/invalid company mapping: reject.
- Unknown external request ID: reject or quarantine; never silently create unrelated state.
- Duplicate event ID: acknowledge as already processed without applying again.
- Buildr unavailable: Stockr core inventory remains operational.
- Stockr unavailable: Buildr core project/request/approval features remain operational.
- Conflict: preserve both audit trails and require explicit reconciliation; never silently overwrite quantities or authorization.

## 10. Security

- Server-to-server authentication is mandatory.
- Client-provided `company_id` alone is never sufficient authorization.
- Each system resolves the authenticated integration to the expected company mapping.
- Cross-company IDs are rejected at API and persistence layers.
- Purchasing authorization is checked server-side.
- Inventory ownership/reference validation is checked server-side.

## 11. Versioning

Initial contract version: `1.0`.

Breaking changes require a new contract version and coordinated rollout. Both apps must accept the previous version during a defined compatibility window.

## 12. Acceptance tests required before enabling integration changes

- same-company happy path request → approval → availability → reservation → authorization → receipt
- rejected/unapproved request cannot purchase
- mismatched company ID rejected
- replayed request event creates no duplicate
- replayed authorization creates no duplicate
- replayed receipt creates no duplicate inventory transaction
- Buildr outage does not block standalone Stockr inventory
- Stockr outage does not block standalone Buildr requests/approvals
- project sync cannot overwrite concurrent Stockr inventory/catalog changes
- quantity shortage calculation matches Stockr ledger
- unauthorized user/role cannot trigger purchasing
