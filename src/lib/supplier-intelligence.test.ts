import assert from "node:assert/strict";
import test from "node:test";
import { exactIdentityMatch, verifiedPriceHasEvidence } from "./supplier-price-policy.ts";

test("supplier match requires an exact MPN or UPC", () => {
  assert.equal(
    exactIdentityMatch(
      { name: "Valve", barcode: "012345678905", upc: "012345678905", mpn: "ABC-100", source: "photo" },
      { upc: "012345678905", mpn: "ZZZ-9" },
    ),
    true,
  );
  assert.equal(
    exactIdentityMatch(
      { name: "Valve", barcode: "012345678905", upc: "012345678905", mpn: "ABC-100", source: "photo" },
      { upc: "999999999999", mpn: "ABC-999" },
    ),
    false,
  );
});

test("Stockr never accepts an unproven supplier price", () => {
  assert.equal(verifiedPriceHasEvidence({ price: 12.34 }), false);
  assert.equal(verifiedPriceHasEvidence({ price: 12.34, product_url: "https://supplier.example/item" }), true);
  assert.equal(verifiedPriceHasEvidence({ price: 12.34, source_reference: "Invoice 123" }), true);
  assert.equal(verifiedPriceHasEvidence({ price: null }), true);
});
