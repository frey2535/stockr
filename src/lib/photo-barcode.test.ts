import assert from "node:assert/strict";
import test from "node:test";
import { plausibleBarcode } from "./photo-barcode.ts";

test("accepts camera-read UPC and Code 128 values", () => {
  assert.equal(plausibleBarcode("012345678905"), true);
  assert.equal(plausibleBarcode("EMT-075-10"), true);
});

test("rejects empty or noise reads", () => {
  assert.equal(plausibleBarcode(""), false);
  assert.equal(plausibleBarcode("   "), false);
  assert.equal(plausibleBarcode("ab"), false);
  assert.equal(plausibleBarcode("@@@"), false);
});
