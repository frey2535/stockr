import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductSearchQuery,
  collapseVisionObjects,
  identityGaps,
  isCompleteIdentity,
  isWeakIdentity,
  inferCatalogNumber,
  listingAgrees,
  parseVisionObjects,
  parseVisionText,
  resolvePhotoIdentities,
  resolvePhotoIdentity,
} from "./identify-photo.ts";

test("complete identity requires a real name, barcode, and manufacturer number", () => {
  assert.deepEqual(identityGaps({ name: "Item from camera photo", barcode: "123", source: "photo" }), ["name", "mpn"]);
  assert.equal(
    isCompleteIdentity({ name: "12/2 NM-B Romex", barcode: "032886902245", mpn: "288290", source: "upcitemdb" }),
    true,
  );
  assert.equal(isWeakIdentity({ name: "Scanned item 123", barcode: "123", source: "scan" }), true);
  assert.equal(buildProductSearchQuery({ brand: "Southwire", name: "12/2 NM-B", mpn: "SW122" }), "Southwire 12/2 NM-B SW122");
});

test("names a product from appearance and fills barcode without a scanned code", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "Square D QO120 20A breaker", brand: "Square D", barcode: "", source: "photo-vision" },
    async () => null,
    async () => null,
    async () => ({ name: "Square D QO120", barcode: "785901001201", mpn: "QO120", source: "photo-knowledge" }),
  );
  assert.equal(found.identified?.name.includes("QO120"), true);
  assert.equal(found.identified?.barcode, "785901001201");
  assert.equal(found.identified?.mpn, "QO120");
});

test("infers a catalog number from a visual name when MPN is blank", () => {
  assert.equal(inferCatalogNumber({ name: "Square D QO120 20A single pole", source: "photo-vision" }), "QO120");
});

test("does not call a placeholder identified when nothing is online", async () => {
  const result = await resolvePhotoIdentity("", null, async () => null, async () => null);
  assert.equal(result.identified, null);
  assert.deepEqual(result.missing.sort(), ["barcode", "mpn", "name"]);
});

test("prefers an online listing and still requires manufacturer number", async () => {
  const incomplete = await resolvePhotoIdentity(
    "012345678905",
    { name: "Mystery coil", barcode: "", source: "photo" },
    async () => ({ name: "Diet Coke", barcode: "012345678905", source: "upcitemdb" }),
    async () => null,
  );
  assert.equal(incomplete.identified, null);
  assert.deepEqual(incomplete.missing, ["mpn"]);
  assert.equal(incomplete.draft.name, "Diet Coke");
  assert.equal(incomplete.draft.barcode, "012345678905");
});

test("looks the item up online from a Lens-style name until barcode and MPN appear", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "Square D QO 20A breaker", brand: "Square D", barcode: "", source: "photo-vision", search_queries: ["Square D QO120"] },
    async () => null,
    async (query) =>
      query.includes("QO120")
        ? { name: "QO120", barcode: "785901001201", mpn: "QO120", source: "upcitemdb" }
        : null,
  );
  assert.equal(found.identified?.mpn, "QO120");
  assert.equal(found.identified?.barcode, "785901001201");
});

test("identifies only after name, barcode, and MPN are known", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "3/4 EMT conduit", brand: "Allied", barcode: "", mpn: "EMT-075-10", source: "photo-vision" },
    async () => null,
    async () => ({ name: "3/4 in EMT", barcode: "034EMT", mpn: "EMT-075-10", source: "open-products-facts" }),
  );
  assert.equal(found.identified?.name, "3/4 in EMT");
  assert.equal(found.identified?.barcode, "034EMT");
  assert.equal(found.identified?.mpn, "EMT-075-10");
});

test("parses a vision object that uses product_name instead of name", () => {
  const objects = parseVisionObjects({ objects: [{ product_name: "Square D QO120", brand: "Square D" }] });
  assert.equal(objects[0]?.name, "Square D QO120");
});

test("parses numerous objects from one vision payload", () => {
  const objects = parseVisionObjects({
    objects: [
      { name: "QO120", brand: "Square D", mpn: "QO120", barcode: "785901001201", quantity: 2, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.4 } },
      { name: "12/2 NM-B", brand: "Southwire", mpn: "288290", barcode: "032886902245" },
      { name: "QO120", brand: "Square D", mpn: "QO120", barcode: "785901001201" },
    ],
  });
  assert.equal(objects.length, 2);
  assert.equal(objects[0]?.quantity, 2);
  assert.equal(objects[0]?.box?.w, 0.3);
});

test("does not treat leftover camera barcodes as extra items when the photo already named the product", async () => {
  const items = await resolvePhotoIdentities(
    [{ name: "QO120", barcode: "785901001201", mpn: "QO120", source: "photo-vision" }],
    ["785901001201", "049000028911"],
    async (code) =>
      code === "049000028911" ? { name: "Diet Coke", barcode: code, mpn: "COKE", source: "upcitemdb" } : null,
    async () => null,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.identified?.mpn, "QO120");
});

test("uses a leftover barcode only when vision saw nothing", async () => {
  const items = await resolvePhotoIdentities(
    [],
    ["032886902245"],
    async (code) => ({ name: "12/2 NM-B", barcode: code, mpn: "288290", source: "upcitemdb" }),
    async () => null,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.identified?.name, "12/2 NM-B");
});

test("collapses eight guesses of the same breaker into one identity", () => {
  const objects = collapseVisionObjects(
    parseVisionText(
      [
        "Circuit breaker",
        "Square D QO120 20A single pole",
        "20A breaker",
        "QO120",
        "black handle",
        "Square D QO115 maybe",
        "electrical breaker",
        "20 amp Square D",
      ].join("\n"),
    ),
  );
  assert.equal(objects.length, 1);
  assert.equal(objects[0]?.name.toLowerCase().includes("qo") || objects[0]?.name.toLowerCase().includes("breaker"), true);
});

test("keeps two physically different products from one caption", () => {
  const objects = parseVisionText("Square D QO120 20A breaker\nSouthwire 12/2 NM-B Romex");
  assert.equal(objects.length, 2);
});

test("does not merge an unrelated catalog hit onto a vision identity", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "Square D QO 20A breaker", brand: "Square D", barcode: "", mpn: "QO120", source: "photo-vision" },
    async () => null,
    async () => ({ name: "Diet Coke", barcode: "049000042566", source: "open-food-facts" }),
  );
  assert.equal(found.draft.name, "Square D QO 20A breaker");
  assert.notEqual(found.draft.barcode, "049000042566");
  assert.equal(found.identified, null);
  assert.equal(
    listingAgrees(
      { name: "Square D QO 20A breaker", brand: "Square D", search_queries: ["Square D QO120"] },
      { name: "QO120", barcode: "785901001201", mpn: "QO120", source: "upcitemdb" },
    ),
    true,
  );
});

test("fills barcode and MPN from product knowledge when catalogs miss", async () => {
  const found = await resolvePhotoIdentity(
    "",
    { name: "Square D QO 20A breaker", brand: "Square D", barcode: "", source: "photo-vision" },
    async () => null,
    async () => null,
    async () => ({ name: "Square D QO120", barcode: "785901001201", mpn: "QO120", source: "photo-knowledge" }),
  );
  assert.equal(found.identified?.mpn, "QO120");
  assert.equal(found.identified?.barcode, "785901001201");
});

test("label-read name, barcode, and MPN count as identified", async () => {
  const found = await resolvePhotoIdentity(
    "032886902245",
    { name: "12/2 NM-B Romex", barcode: "032886902245", mpn: "288290", source: "photo-vision" },
    async () => null,
    async () => null,
  );
  assert.equal(isCompleteIdentity(found.identified), true);
  assert.equal(found.identified?.mpn, "288290");
});
