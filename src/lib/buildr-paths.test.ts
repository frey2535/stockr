import assert from "node:assert/strict";
import test from "node:test";
import { buildrProjectPaths } from "./buildr-paths.ts";

test("project sync uses only company-scoped Buildr routes", () => {
  assert.deepEqual(buildrProjectPaths("co_123"), ["/companies/co_123/projects", "/stockr/projects?company_id=co_123"]);
});

test("company IDs are encoded for both routes", () => {
  assert.deepEqual(buildrProjectPaths("a/b"), ["/companies/a%2Fb/projects", "/stockr/projects?company_id=a%2Fb"]);
});
