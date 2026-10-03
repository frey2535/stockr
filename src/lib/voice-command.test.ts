import assert from "node:assert/strict";
import test from "node:test";
import { planVoiceCommand, voiceSearchQuery } from "./voice-command.ts";

const materials = [
  { id: "mat_1", name: "12/2 NM-B Romex", unit: "ft", aliases: ["romex"], barcode: "032886902245", mpn: "288290" },
];
const locations = [{ id: "loc_shop", name: "Main Warehouse", type: "warehouse" as const }];
const projects = [{ id: "job_1", name: "Oak Street Retrofit", status: "active" as const }];

test("voice add to the only location executes immediately", () => {
  const plan = planVoiceCommand("add 10 romex on the shop", materials, locations, projects);
  assert.equal(plan.ok, true);
  if (!plan.ok || plan.kind !== "action") throw new Error("expected action");
  assert.equal(plan.action.type, "add");
  assert.equal(plan.action.quantity, 10);
  assert.equal(plan.action.toLocationId, "loc_shop");
  assert.match(plan.action.notes || "", /^Voice:/);
});

test("unknown spoken items prompt a catalog create", () => {
  const plan = planVoiceCommand("add 4 mystery widget to shop", materials, locations, projects);
  assert.equal(plan.ok, false);
  if (plan.ok) throw new Error("expected create prompt");
  assert.equal(plan.create, true);
  assert.match(plan.parsed.itemQuery, /mystery widget/i);
});

test("voice catalog search uses the item, not the whole sentence", () => {
  assert.equal(voiceSearchQuery("transfer 5 emt from Truck 12 to Main Warehouse"), "emt");
  assert.equal(voiceSearchQuery("use 10 romex from truck 12 on Riverside"), "romex");
});
