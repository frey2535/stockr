import assert from "node:assert/strict";
import test from "node:test";
import { buildProductSearchQuery, isWeakIdentity, photoFallbackProduct, resolvePhotoIdentity } from "./identify-photo.ts";

test("weak identities are the scan and photo placeholders", () => {
  assert.equal(isWeakIdentity(photoFallbackProduct("123")), true);
  assert.equal(isWeakIdentity({ name: "3/4\" EMT", barcode: "123", source: "upcitemdb" }), false);
  assert.equal(buildProductSearchQuery({ brand: "Southwire", name: "12/2 NM-B", mpn: "SW122" }), "Southwire 12/2 NM-B SW122");
});

test("prefers an online barcode hit over a photo guess", async () => {
  const found = await resolvePhotoIdentity(
    "012345678905",
    { name: "Mystery coil", barcode: "", source: "photo" },
    async () => ({ name: "Diet Coke", barcode: "012345678905", source: "upcitemdb" }),
    async () => {
      throw new Error("should not search");
    },
  );
  assert.equal(found.name, "Diet Coke");
});

test("searches online from vision when the barcode is unknown", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "3/4 EMT conduit", brand: "Allied", barcode: "", source: "photo-vision" },
    async () => ({ name: "Scanned item", barcode: "", source: "scan" }),
    async (query) => ({ name: "3/4 in EMT", barcode: "034EMT", source: "open-products-facts", description: query }),
  );
  assert.equal(found.name, "3/4 in EMT");
  assert.equal(found.barcode, "034EMT");
});

test("always returns a catalog-ready product for a blank camera shot", async () => {
  const found = await resolvePhotoIdentity("", null, async () => null, async () => null);
  assert.equal(found.source, "photo");
  assert.match(found.name, /photo/i);
});
