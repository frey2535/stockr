import assert from "node:assert/strict";
import test from "node:test";
import { buildrProjectPaths, preferBuildrError } from "./buildr-paths.ts";

test("syncs by company ID on proxied API paths, never /api/companies", () => {
  const paths = buildrProjectPaths("co_dayoneelectric");
  assert.deepEqual(paths, [
    "/companies/co_dayoneelectric/projects",
    "/stockr/projects?company_id=co_dayoneelectric",
    "/projects",
  ]);
  assert.equal(paths.some((path) => path.includes("/api/")), false);
});

test("keeps an API error instead of a later website HTML miss", () => {
  assert.equal(
    preferBuildrError(
      "Buildr asked for a login token. Deploy the company job list route so Stockr can sync by company ID.",
      "Buildr https://buildrpm.com/api/companies/co_dayoneelectric/projects returned the website instead of the API.",
    ),
    "Buildr asked for a login token. Deploy the company job list route so Stockr can sync by company ID.",
  );
});
