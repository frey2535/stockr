import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductSearchQuery,
  identityGaps,
  isCompleteIdentity,
  isWeakIdentity,
  parseVisionObjects,
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

test("resolves leftover barcodes as extra items in the same photo", async () => {
  const items = await resolvePhotoIdentities(
    [{ name: "QO120", barcode: "785901001201", mpn: "QO120", source: "photo-vision" }],
    ["785901001201", "032886902245"],
    async (code) =>
      code === "032886902245"
        ? { name: "12/2 NM-B", barcode: code, mpn: "288290", source: "upcitemdb" }
        : null,
    async () => null,
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]?.identified?.mpn, "QO120");
  assert.equal(items[1]?.identified?.name, "12/2 NM-B");
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
