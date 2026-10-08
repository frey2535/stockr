import assert from "node:assert/strict";
import test from "node:test";
import { exactIdentityMatch, verifiedPriceHasEvidence } from "./supplier-price-policy.ts";

test("matching manufacturer part numbers ignores punctuation and case", () => {
  assert.equal(exactIdentityMatch({ mpn: "LEV-123 A" }, { mpn: "lev123a" }), true);
});

test("matching UPC works when manufacturer part number is missing", () => {
  assert.equal(exactIdentityMatch({ barcode: "012345678901" }, { upc: "012345678901" }), true);
});

test("unrelated identifiers cannot qualify as an exact match", () => {
  assert.equal(exactIdentityMatch({ mpn: "ABC", upc: "123" }, { mpn: "DEF", upc: "456" }), false);
});

test("product name alone is not sufficient for an exact match", () => {
  assert.equal(exactIdentityMatch({ name: "20A receptacle" }, { product_name: "20A receptacle" }), false);
});

test("priced offers require a source reference or product URL", () => {
  assert.equal(verifiedPriceHasEvidence({ price: 19.95 }), false);
  assert.equal(verifiedPriceHasEvidence({ price: 19.95, source_reference: "Supplier quote Q-12" }), true);
  assert.equal(verifiedPriceHasEvidence({ price: 19.95, product_url: "https://example.com/item" }), true);
});

test("unknown prices remain valid without fabricated evidence", () => {
  assert.equal(verifiedPriceHasEvidence({ price: null }), true);
});
