import assert from "node:assert/strict";
import test from "node:test";
import { matchLocation, parseInventoryEnglish } from "./nlp.ts";

test("parses a field transfer with fraction trade size and possessives", () => {
  const parsed = parseInventoryEnglish(`transfer 10 3/4" lb's from noahs van to matts truck`);
  assert.equal(parsed.action, "transfer");
  assert.equal(parsed.quantity, 10);
  assert.match(parsed.itemQuery, /3\/4/);
  assert.match(parsed.fromLocationName.toLowerCase(), /noah/);
  assert.match(parsed.toLocationName.toLowerCase(), /matt/);
});

test("matches Noahs van to Noah's Van", () => {
  const loc = matchLocation("noahs van", [
    { name: "Shop", assigned_to: "" },
    { name: "Noah's Van", assigned_to: "Noah" },
    { name: "Matt's Truck", assigned_to: "Matt" },
  ]);
  assert.equal(loc?.name, "Noah's Van");
});

test("parses shrink and find", () => {
  assert.equal(parseInventoryEnglish("shrink 2 emt from truck 12").action, "shrink");
  assert.equal(parseInventoryEnglish("where is 3/4 locknut").action, "find");
});
