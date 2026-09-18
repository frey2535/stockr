import assert from "node:assert/strict";
import test from "node:test";
import { invalidateApiCache, readApiCache, writeApiCache } from "./api-cache.ts";

test("api cache stores and invalidates by prefix", () => {
  writeApiCache("/api/dashboard", { totalItems: 3 });
  writeApiCache("/api/activity?q=wire", { rows: [] });
  assert.deepEqual(readApiCache("/api/dashboard"), { totalItems: 3 });
  invalidateApiCache("/api/activity");
  assert.equal(readApiCache("/api/activity?q=wire"), undefined);
  assert.deepEqual(readApiCache("/api/dashboard"), { totalItems: 3 });
  invalidateApiCache();
  assert.equal(readApiCache("/api/dashboard"), undefined);
});
