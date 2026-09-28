import assert from "node:assert/strict";
import test from "node:test";
import { matchKnownProduct } from "./known-products.ts";
import { parseVisionText } from "./identify-photo.ts";

test("matches a Square D breaker from a visual name with no barcode", () => {
  const found = matchKnownProduct("Square D 20A single pole breaker on a truck shelf");
  assert.equal(found?.mpn, "QO120");
  assert.ok(found?.barcode);
});

test("matches Romex from appearance wording", () => {
  const found = matchKnownProduct("yellow 12/2 NM-B coil");
  assert.equal(found?.name.includes("Romex"), true);
});

test("parses a free-text Lens caption into product names", () => {
  const objects = parseVisionText("Square D QO120 20A breaker\nSouthwire 12/2 NM-B Romex");
  assert.equal(objects.length, 2);
  assert.equal(objects[0]?.name.includes("QO120"), true);
});

test("does not treat a generic word as a catalog SKU", () => {
  assert.equal(matchKnownProduct("emt"), null);
  assert.equal(matchKnownProduct("thhn"), null);
  assert.equal(matchKnownProduct("square box"), null);
});
