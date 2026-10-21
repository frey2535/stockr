import assert from "node:assert/strict";
import test from "node:test";
import { groupToolsForView, nextToolNumber, toolConditionLabel, toolsVisibleInView } from "./tools-state.ts";
import type { Location, Tool } from "./types.ts";

const truck: Location = { id: "loc_truck", name: "Bryce's truck", type: "vehicle", assigned_to: "Bryce" };
const shop: Location = { id: "loc_shop", name: "Shop", type: "warehouse" };

function tool(partial: Partial<Tool> & { id: string; name: string }): Tool {
  return {
    assigned_location_id: "",
    status: "available",
    condition: "good",
    ...partial,
  };
}

test("next tool number increments from the highest existing number", () => {
  assert.equal(nextToolNumber([]), "T-001");
  assert.equal(nextToolNumber([{ tool_number: "T-007" } as never]), "T-008");
});

test("condition labels cover field states", () => {
  assert.equal(toolConditionLabel("good"), "Good");
  assert.equal(toolConditionLabel("operating_issues"), "Operating but has issues");
  assert.equal(toolConditionLabel("stolen"), "Stolen");
});

test("a tool with employee and location is one entry in each view", () => {
  const drill = tool({
    id: "tool_1",
    name: "Impact driver",
    assigned_to: "Bryce",
    assigned_location_id: "loc_truck",
  });
  const byEmployee = groupToolsForView([drill], [truck, shop], "employee");
  assert.equal(byEmployee.employeeGroups.length, 1);
  assert.equal(byEmployee.employeeGroups[0].name, "Bryce");
  assert.equal(byEmployee.employeeGroups[0].tools.length, 1);
  assert.equal(byEmployee.locationGroups.length, 0);
  assert.equal(byEmployee.employeeOnly.length, 0);

  const byLocation = groupToolsForView([drill], [truck, shop], "location");
  assert.equal(byLocation.locationGroups.find((row) => row.location.id === "loc_truck")?.tools.length, 1);
  assert.equal(byLocation.employeeGroups.length, 0);
  assert.equal(byLocation.employeeOnly.length, 0);
});

test("employee-only groups are created only when no location is assigned", () => {
  const handheld = tool({ id: "tool_2", name: "Meter", assigned_to: "Bryce" });
  const drill = tool({
    id: "tool_3",
    name: "Drill",
    assigned_to: "Bryce",
    assigned_location_id: "loc_truck",
  });
  const byLocation = groupToolsForView([handheld, drill], [truck], "location");
  assert.deepEqual(
    byLocation.employeeOnly.map((row) => row.id),
    ["tool_2"],
  );
  assert.equal(byLocation.employeeGroups.length, 1);
  assert.equal(byLocation.employeeGroups[0].name, "Bryce");
  assert.deepEqual(
    byLocation.employeeGroups[0].tools.map((row) => row.id),
    ["tool_2"],
  );
  assert.deepEqual(
    byLocation.locationGroups.find((row) => row.location.id === "loc_truck")?.tools.map((row) => row.id),
    ["tool_3"],
  );
});

test("each view shows every tool exactly once", () => {
  const rows = [
    tool({
      id: "tool_truck",
      name: "Impact driver",
      assigned_to: "Bryce",
      assigned_location_id: "loc_truck",
    }),
    tool({ id: "tool_handheld", name: "Meter", assigned_to: "Bryce" }),
    tool({ id: "tool_shop", name: "Saw", assigned_location_id: "loc_shop" }),
    tool({ id: "tool_orphan", name: "Spare bit" }),
  ];

  for (const view of ["employee", "location"] as const) {
    const grouped = groupToolsForView(rows, [truck, shop], view);
    const visible = toolsVisibleInView(grouped);
    const ids = visible.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length, `${view} view duplicated a tool`);
    assert.equal(ids.length, rows.length, `${view} view dropped a tool`);
  }
});
