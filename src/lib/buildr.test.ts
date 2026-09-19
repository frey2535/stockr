import assert from "node:assert/strict";
import test from "node:test";
import { buildrProjectPaths, preferBuildrError } from "./buildr-paths.ts";

test("syncs Stockr jobs from Buildr API paths, not the website /api/companies route", () => {
  const paths = buildrProjectPaths("co_dayoneelectric");
  assert.deepEqual(paths, ["/stockr/projects?company_id=co_dayoneelectric", "/projects"]);
  assert.equal(paths.some((path) => path.startsWith("/api/")), false);
});

test("keeps an auth error instead of a later website HTML miss", () => {
  assert.equal(
    preferBuildrError(
      "Buildr requires a service token. Add BUILDR_API_KEY to Stockr Cloudflare secrets.",
      "Buildr https://buildrpm.com/api/companies/co_dayoneelectric/projects returned the website instead of the API.",
    ),
    "Buildr requires a service token. Add BUILDR_API_KEY to Stockr Cloudflare secrets.",
  );
});
