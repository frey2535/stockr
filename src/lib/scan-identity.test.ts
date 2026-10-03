import assert from "node:assert/strict";
import test from "node:test";
import { preferScannedIdentity } from "./scan-identity.ts";

test("a scanned barcode keeps a complete remote identity", () => {
  const found = preferScannedIdentity("785901001201", "", {
    name: "Square D QO120 20A Single Pole Breaker",
    barcode: "785901001201",
    mpn: "QO120",
    manufacturer: "Square D",
    source: "upcitemdb",
  });
  assert.equal(found.name.includes("QO120"), true);
  assert.equal(found.barcode, "785901001201");
  assert.equal(found.mpn, "QO120");
});

test("an unknown barcode still returns a create-ready draft", () => {
  const found = preferScannedIdentity("999000111222");
  assert.equal(found.barcode, "999000111222");
  assert.equal(found.source, "scan");
  assert.equal(found.name, "");
});
