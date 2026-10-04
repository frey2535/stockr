# Stockr production-readiness rollout

This branch hardens the highest-risk multi-contractor paths before a broad rollout.

## Required production migration

Run the latest `supabase/schema.sql` in the Stockr Supabase project before deploying this application build. The application intentionally refuses Supabase inventory mutations when the atomic `stockr_apply_inventory_action` RPC is missing instead of falling back to a race-prone read/modify/write path.

## Release gates

- CI must pass on the production-readiness PR.
- Verify two unrelated test companies cannot read or mutate each other's IDs through inventory, materials, locations, field ops, purchase orders, projects, tools, or workspace switching.
- Verify simultaneous USE operations cannot drive stock negative.
- Verify simultaneous TRANSFER operations debit the source and credit the destination exactly once and create one activity row per successful action.
- Verify viewer accounts cannot mutate data.
- Verify technicians can use/transfer inventory and submit material requests but cannot alter company setup.
- Verify foremen can perform field/restock work without company-admin access.
- Verify warehouse managers and inventory admins can perform their assigned operational controls.
- Verify a zero physical cycle count clears an inventory row correctly.
- Verify new-company signup creates an isolated empty Starter workspace and invite joins honor seat limits.
- Verify Stripe webhook signing and production price IDs before charging outside beta.

## Still required before unrestricted rollout

- Automated live-database tenant-isolation suite against a staging Supabase project.
- Atomic purchase-order receiving (PO line update + inventory + activity in one database transaction).
- Tested backup/restore drill.
- Offline local inventory mirror and conflict-safe synchronization.
- Soft-delete/archive policy for destructive catalog/location administration.
- Load test with concurrent users across multiple tenants.
