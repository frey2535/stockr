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

test("parses add onto a location and take as transfer", () => {
  const added = parseInventoryEnglish("put 25 screws on truck 12");
  assert.equal(added.action, "add");
  assert.equal(added.quantity, 25);
  assert.match(added.itemQuery, /screws/i);
  assert.match(added.toLocationName.toLowerCase(), /truck 12/);
  assert.equal(parseInventoryEnglish("take 4 romex from shop to truck 7").action, "transfer");
});

test("use from a van on a job keeps the item name clean", () => {
  const used = parseInventoryEnglish("use 10 romex from truck 12 on Riverside");
  assert.equal(used.action, "use");
  assert.equal(used.quantity, 10);
  assert.equal(used.itemQuery.toLowerCase(), "romex");
  assert.match(used.fromLocationName.toLowerCase(), /truck 12/);
  assert.match(used.projectName.toLowerCase(), /riverside/);
});

test("field verbs and wake words still execute", () => {
  assert.equal(parseInventoryEnglish("hey stockr grab 4 breakers from truck 12 on Riverside").action, "use");
  assert.equal(parseInventoryEnglish("load 12 romex on Main Warehouse").action, "add");
  assert.equal(parseInventoryEnglish("restock 20 emt to shop").action, "receive");
});
