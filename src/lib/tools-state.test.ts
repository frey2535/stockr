import assert from "node:assert/strict";
import test from "node:test";
import { nextToolNumber, toolConditionLabel } from "./tools-state.ts";

test("next tool number increments from the highest existing number", () => {
  assert.equal(nextToolNumber([]), "T-001");
  assert.equal(nextToolNumber([{ tool_number: "T-007" } as never]), "T-008");
});

test("condition labels cover field states", () => {
  assert.equal(toolConditionLabel("good"), "Good");
  assert.equal(toolConditionLabel("operating_issues"), "Operating but has issues");
  assert.equal(toolConditionLabel("stolen"), "Stolen");
});
