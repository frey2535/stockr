import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011_reservation_cycle_integrity.sql", import.meta.url),
  "utf8",
);

test("reservation allocation serializes on the inventory row", () => {
  assert.match(migration, /stockr_create_inventory_reservation/);
  assert.match(migration, /from stockr_inventory[sS]*for update/i);
  assert.match(migration, /sum(quantity)[sS]*status = 'active'/i);
  assert.match(migration, /Only % are available after existing reservations/);
});

test("cycle count line edits lock the session and reject submitted counts", () => {
  assert.match(migration, /stockr_set_cycle_count_line/);
  assert.match(migration, /from stockr_cycle_count_sessions[sS]*for update/i);
  assert.match(migration, /status <> 'open'/i);
  assert.match(migration, /Cycle count is already submitted/);
});

test("cycle count submit is transactional and replay-safe", () => {
  assert.match(migration, /stockr_submit_cycle_count_once/);
  assert.match(migration, /status = 'submitted'/i);
  assert.match(migration, /duplicate', true/);
  assert.match(migration, /perform stockr_apply_inventory_action/);
});
