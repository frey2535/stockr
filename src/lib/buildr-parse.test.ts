import assert from "node:assert/strict";
import test from "node:test";
import { mapProject, mapStatus, scopeProjects, unwrapProjects } from "./buildr-parse.ts";

test("unwraps nested Buildr payloads", () => {
  const rows = unwrapProjects({ data: { projects: [{ name: "Riverside", id: "1" }] } });
  assert.equal(rows[0]?.name, "Riverside");
});

test("reads job_name when name is missing", () => {
  const project = mapProject({ job_name: "Oak Street", job_number: "P-9" }, 0, () => "prj_1");
  assert.equal(project?.name, "Oak Street");
  assert.equal(project?.project_number, "P-9");
  assert.equal(project?.status, "active");
});

test("uses job number when Buildr omits a name", () => {
  const project = mapProject({ jobNumber: "J-42" }, 0, () => "prj_1");
  assert.equal(project?.name, "J-42");
});

test("only treats explicit closed statuses as completed", () => {
  assert.equal(mapStatus("in progress"), "active");
  assert.equal(mapStatus("Closed"), "completed");
  assert.equal(mapStatus("abandoned"), "active");
});

test("scopes by company when that field exists", () => {
  const rows = scopeProjects(
    [
      { name: "A", company_id: "co_1" },
      { name: "B", company_id: "co_2" },
    ],
    "co_2",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "B");
});
