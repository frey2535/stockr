# Buildr and Stockr integration plan

Buildr owns project requests and approvals. Stockr owns inventory, supplier catalog, purchasing, receiving, and invoices. Supplyr is not a runtime dependency.

## Phases
1. Audit the current Buildr approval flow and Stockr inventory and purchasing data paths.
2. Define authenticated tenant mapping and idempotent request intake.
3. Connect approved Buildr requests to Stockr without duplicating orders.
4. Add supplier quote verification and purchase approval checks.
5. Enable supplier-specific dispatch only after staged testing.
6. Reconcile deliveries and invoices back to Buildr project costs.

## Nonnegotiable tests
- Two companies cannot access each other's data.
- Duplicate requests and retries do not create duplicate orders.
- Concurrent inventory reservations cannot oversubscribe stock.
- Unverified prices are never presented as confirmed prices.
- Existing Stockr inventory and Buildr integration continue working.
- Purchasing errors do not block normal project and inventory workflows.

Live supplier dispatch must remain disabled until integration and regression testing pass.
