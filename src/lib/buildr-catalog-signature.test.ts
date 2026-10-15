import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

test("catalog signature binds company ID and query string", () => {
  const secret = "test-shared-secret";
  const timestamp = "1792000000";
  const canonical = (params: string) => `GET\n/api/integrations/buildr/catalog\n${params}\n${timestamp}`;
  const sign = (params: string) => createHmac("sha256", secret).update(canonical(params)).digest("hex");
  const a = new URLSearchParams({ company_id: "co_dayoneelectric", q: "EMT", category: "", limit: "100", offset: "0" });
  const b = new URLSearchParams({ company_id: "another_company", q: "EMT", category: "", limit: "100", offset: "0" });
  assert.equal(sign(a.toString()).length, 64);
  assert.notEqual(sign(a.toString()), sign(b.toString()));
  assert.notEqual(sign(a.toString()), sign(a.toString().replace("EMT", "PVC")));
});
