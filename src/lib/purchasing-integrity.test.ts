import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011_purchasing_integrity.sql", import.meta.url),
  "utf8",
);

test("PO creation serializes duplicate PO numbers within a company", () => {
  assert.match(migration, /stockr_create_purchase_order/);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /lower\(trim\(po_number\)\)/i);
  assert.match(migration, /purchase order with this PO number already exists/i);
});

test("PO creation rejects cross-company materials and invalid quantities", () => {
  assert.match(migration, /stockr_materials[\s\S]*company_id = p_company_id/i);
  assert.match(migration, /Expected quantity must be greater than zero/i);
  assert.match(migration, /Unit cost cannot be negative/i);
});

test("PO receiving uses an operation key so replay is harmless", () => {
  assert.match(migration, /stockr_receive_purchase_order_once/);
  assert.match(migration, /stockr_operation_keys/);
  assert.match(migration, /purchase_order_receive/);
  assert.match(migration, /duplicate', true/);
});
