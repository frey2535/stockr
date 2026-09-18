import assert from "node:assert/strict";
import test from "node:test";
import { barcodeVariants, codesMatch, expandUpcE, isGtin, withGtinCheckDigit } from "./barcode.ts";

test("Diet Coke UPC variants include EAN-13", () => {
  const variants = barcodeVariants("049000028911");
  assert.ok(variants.includes("049000028911"));
  assert.ok(variants.includes("0049000028911"));
  assert.equal(isGtin("049000028911"), true);
  assert.equal(isGtin("EMT-075-10"), false);
});

test("leading-zero EAN-13 matches stored UPC-A", () => {
  assert.equal(codesMatch("012345678901", "0012345678901"), true);
  assert.equal(codesMatch("012345678901", "012345678901"), true);
  assert.equal(codesMatch("012345678901", "999999999999"), false);
});

test("spaces and dashes do not break a match", () => {
  assert.equal(codesMatch("012345678901", "01234 5678901"), true);
  assert.equal(codesMatch("EMT-075-10", "EMT-075-10"), true);
});

test("UPC-E expands to a 12-digit UPC-A", () => {
  const upcA = expandUpcE("04252614");
  assert.equal(upcA.length, 12);
  assert.equal(withGtinCheckDigit(upcA.slice(0, 11)), upcA);
});
