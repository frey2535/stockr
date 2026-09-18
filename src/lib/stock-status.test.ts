import assert from "node:assert/strict";
import test from "node:test";
import { stockStatus, stockStatusLabel } from "./stock-status.ts";

test("zero quantity is out", () => {
  assert.equal(stockStatus({ quantity: 0, min: 5 }), "out");
  assert.equal(stockStatusLabel("out"), "Out");
});

test("at or below min is critical", () => {
  assert.equal(stockStatus({ quantity: 4, min: 5 }), "critical");
  assert.equal(stockStatus({ quantity: 8, belowMin: true }), "critical");
});

test("at reorder point is low", () => {
  assert.equal(stockStatus({ quantity: 10, min: 4, reorder: 12 }), "low");
});

test("healthy stock is in stock", () => {
  assert.equal(stockStatus({ quantity: 40, min: 10, reorder: 15 }), "ok");
  assert.equal(stockStatusLabel("ok"), "In stock");
});
