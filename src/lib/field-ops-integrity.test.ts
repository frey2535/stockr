import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011_reservation_cycle_integrity.sql", import.meta.url),
  "utf8",
);

function functionBody(name: string, nextName?: string) {
  const start = migration.indexOf("create or replace function " + name);
  assert.notEqual(start, -1, name + " must exist in the migration");
  const end = nextName
    ? migration.indexOf("create or replace function " + nextName, start + 1)
    : migration.length;
  return migration.slice(start, end === -1 ? migration.length : end);
}

test("reservation allocation serializes on the inventory row", () => {
  const body = functionBody("stockr_create_inventory_reservation", "stockr_set_cycle_count_line");
  assert.equal(body.includes("from stockr_inventory"), true);
  assert.equal(body.includes("for update"), true);
  assert.equal(body.includes("status = 'active'"), true);
  assert.equal(body.includes("Only % are available after existing reservations"), true);
});

test("cycle count line edits lock the session and reject submitted counts", () => {
  const body = functionBody("stockr_set_cycle_count_line", "stockr_submit_cycle_count_once");
  assert.equal(body.includes("from stockr_cycle_count_sessions"), true);
  assert.equal(body.includes("for update"), true);
  assert.equal(body.includes("status <> 'open'"), true);
  assert.equal(body.includes("Cycle count is already submitted"), true);
});

test("cycle count submit is transactional and replay-safe", () => {
  const body = functionBody("stockr_submit_cycle_count_once");
  assert.equal(body.includes("status = 'submitted'"), true);
  assert.equal(body.includes("'duplicate', true"), true);
  assert.equal(body.includes("perform stockr_apply_inventory_action"), true);
});
