import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkRows,
  claimableDayOneCompanyIds,
  dayOneExpectedIds,
  dayOneMaterialId,
  dayOneMissingItems,
  dayOneScopedMaterialId,
  shouldBootstrapDayOneCatalog,
} from "./dayone-catalog-policy.ts";
import { DAY_ONE_CATALOG, DAY_ONE_COMPANY_ID } from "./dayone-catalog.ts";

test("runtime bootstrap recognizes Day One by Stockr id or linked Buildr id", () => {
  assert.equal(shouldBootstrapDayOneCatalog(DAY_ONE_COMPANY_ID), true);
  assert.equal(shouldBootstrapDayOneCatalog("stockr_internal_dayone", DAY_ONE_COMPANY_ID), true);
  assert.equal(shouldBootstrapDayOneCatalog("co_other", "co_other_buildr"), false);
  assert.equal(shouldBootstrapDayOneCatalog("", ""), false);
});

test("runtime bootstrap recognizes Day One by company name without seeding other trades", () => {
  assert.equal(shouldBootstrapDayOneCatalog("co_abc", "", "Day One Electric"), true);
  assert.equal(shouldBootstrapDayOneCatalog("co_abc", "", "Day One Electric LLC"), true);
  assert.equal(shouldBootstrapDayOneCatalog("co_abc", "", "DayOneElectric"), true);
  assert.equal(shouldBootstrapDayOneCatalog("co_abc", "", "Smith Mechanical"), false);
});

test("Day One material ids are deterministic and reserved", () => {
  assert.equal(dayOneMaterialId(DAY_ONE_CATALOG[0]), "dayone_stk_e_00001");
  const ids = dayOneExpectedIds();
  assert.equal(ids.length, 484);
  assert.equal(new Set(ids).size, 484);
});

test("bootstrap detects only missing Day One rows", () => {
  const first = dayOneMaterialId(DAY_ONE_CATALOG[0]);
  const second = dayOneMaterialId(DAY_ONE_CATALOG[1]);
  const targetCompanyId = "stockr_internal_dayone";
  const missing = dayOneMissingItems(
    [
      { id: first, company_id: targetCompanyId },
      { id: second, company_id: targetCompanyId },
    ],
    targetCompanyId,
  );
  assert.equal(missing.length, 482);
  assert.equal(missing.some((item) => dayOneMaterialId(item) === first), false);
});

test("reserved Day One ids cannot exist under another company", () => {
  assert.throws(
    () =>
      dayOneMissingItems(
        [{ id: dayOneMaterialId(DAY_ONE_CATALOG[0]), company_id: "co_other" }],
        "stockr_internal_dayone",
      ),
    /tenant isolation violation/i,
  );
});

test("scoped Day One ids stay inside the requesting workspace", () => {
  const item = DAY_ONE_CATALOG[0];
  const scoped = dayOneScopedMaterialId("co_live_dayone", item);
  assert.equal(scoped.startsWith("dayone_co_live_dayone_"), true);
  assert.notEqual(scoped, dayOneMaterialId(item));
  assert.equal(shouldBootstrapDayOneCatalog("co_other", "", "Smith Mechanical"), false);
});

test("orphaned or Day One reserved rows can be claimed by the live Day One workspace", () => {
  const collision = { id: dayOneMaterialId(DAY_ONE_CATALOG[0]), company_id: "co_dayoneelectric" };
  assert.deepEqual(
    claimableDayOneCompanyIds([collision], [{ id: "co_dayoneelectric", name: "Day One Electric" }]),
    ["co_dayoneelectric"],
  );
  assert.deepEqual(claimableDayOneCompanyIds([collision], []), ["co_dayoneelectric"]);
  assert.deepEqual(
    claimableDayOneCompanyIds(
      [{ id: dayOneMaterialId(DAY_ONE_CATALOG[0]), company_id: "co_smith" }],
      [{ id: "co_smith", name: "Smith Mechanical" }],
    ),
    [],
  );
});

test("bootstrap batching is bounded", () => {
  const chunks = chunkRows(DAY_ONE_CATALOG, 100);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 100, 100, 84]);
  assert.throws(() => chunkRows(DAY_ONE_CATALOG, 0), /positive integer/i);
});
