import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickBuildrSsoCompany, shouldPersistBuildrLink } from "./buildr-sso-identity.ts";

describe("pickBuildrSsoCompany", () => {
  it("prefers an already-linked workspace", () => {
    const picked = pickBuildrSsoCompany(
      [
        { companyId: "other", role: "admin", buildrCompanyId: "co_other" },
        { companyId: "smith", role: "admin", buildrLinked: true, buildrCompanyId: "co_smithcomech" },
      ],
      "co_smithcomech",
    );
    assert.equal(picked?.companyId, "smith");
  });

  it("falls back to a unique membership and allows persisting the Buildr link", () => {
    const picked = pickBuildrSsoCompany(
      [{ companyId: "smith", role: "admin", buildrLinked: false, buildrCompanyId: "" }],
      "co_smithcomech",
    );
    assert.equal(picked?.companyId, "smith");
    assert.equal(shouldPersistBuildrLink(picked!, "co_smithcomech"), true);
  });

  it("falls back to a unique admin membership when the user belongs to several companies", () => {
    const picked = pickBuildrSsoCompany(
      [
        { companyId: "guest", role: "member" },
        { companyId: "smith", role: "admin" },
      ],
      "co_smithcomech",
    );
    assert.equal(picked?.companyId, "smith");
  });

  it("does not guess when multiple admin workspaces exist", () => {
    const picked = pickBuildrSsoCompany(
      [
        { companyId: "a", role: "admin" },
        { companyId: "b", role: "admin" },
      ],
      "co_smithcomech",
    );
    assert.equal(picked, null);
  });

  it("matches a Stockr workspace whose id is the Buildr company id", () => {
    const picked = pickBuildrSsoCompany(
      [
        { companyId: "co_other", role: "admin" },
        { companyId: "co_smithcomech", role: "member" },
      ],
      "co_smithcomech",
    );
    assert.equal(picked?.companyId, "co_smithcomech");
  });

  it("falls back to the last used workspace when several admins exist", () => {
    const picked = pickBuildrSsoCompany(
      [
        { companyId: "a", role: "admin" },
        { companyId: "b", role: "admin" },
      ],
      "co_smithcomech",
      "b",
    );
    assert.equal(picked?.companyId, "b");
    assert.equal(shouldPersistBuildrLink(picked!, "co_smithcomech", [
      { companyId: "a", role: "admin" },
      { companyId: "b", role: "admin" },
    ]), false);
  });
});
