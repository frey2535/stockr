import assert from "node:assert/strict";
import test from "node:test";
import { assertTenantWriteAllowed, tenantWriteMode } from "./tenant-write-policy.ts";

test("new records are created only when no caller-supplied id is present", () => {
  assert.equal(tenantWriteMode(undefined, false), "create");
  assert.equal(tenantWriteMode(undefined, true), "create");
});

test("same-company existing ids may be updated", () => {
  assert.equal(tenantWriteMode("mat_owned", true), "update");
  assert.equal(assertTenantWriteAllowed("mat_owned", true, "Material"), "update");
});

test("caller-supplied ids not owned by the company are rejected", () => {
  assert.equal(tenantWriteMode("mat_other_company", false), "reject");
  assert.throws(
    () => assertTenantWriteAllowed("mat_other_company", false, "Material"),
    /Material not found in this company workspace/,
  );
  assert.throws(
    () => assertTenantWriteAllowed("supplier_other_company", false, "Supplier"),
    /Supplier not found in this company workspace/,
  );
});
