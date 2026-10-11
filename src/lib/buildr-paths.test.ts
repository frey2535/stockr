import assert from "node:assert/strict";
import test from "node:test";
import { buildrProjectPaths } from "./buildr-paths.ts";

test("project sync uses only explicitly company-scoped Buildr routes", () => {
  const paths = buildrProjectPaths("co_123");
  assert.deepEqual(paths, ["/companies/co_123/projects", "/stockr/projects?company_id=co_123"]);
  assert.ok(paths.every((path) => path !== "/projects"));
});

test("company ID is URL-encoded in both paths", () => {
  assert.deepEqual(buildrProjectPaths("a/b"), ["/companies/a%2Fb/projects", "/stockr/projects?company_id=a%2Fb"]);
});
