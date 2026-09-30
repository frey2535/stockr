import assert from "node:assert/strict";
import test from "node:test";
import { canSwitchWorkspace, companyListQuery, inviteJoinError, pickLoginCompany } from "./tenants.ts";

test("company search pages stay bounded", () => {
  const query = companyListQuery({ q: "  acme_%  ", limit: 500, offset: -3 });
  assert.equal(query.q, "acme");
  assert.equal(query.limit, 100);
  assert.equal(query.offset, 0);
});

test("members can only open companies they already belong to", () => {
  assert.equal(
    canSwitchWorkspace({
      companyId: "co_b",
      workspaces: [{ id: "co_a" }, { id: "co_b" }],
    }),
    true,
  );
  assert.equal(
    canSwitchWorkspace({
      companyId: "co_secret",
      workspaces: [{ id: "co_a" }],
    }),
    false,
  );
  assert.equal(
    canSwitchWorkspace({
      companyId: "co_secret",
      workspaces: [{ id: "co_a" }],
      platformOwner: true,
      adminOverride: true,
    }),
    true,
  );
});

test("existing accounts can join another company with the same password", () => {
  assert.equal(
    inviteJoinError({
      existingUser: true,
      passwordMatches: false,
      alreadyMember: false,
      seatError: null,
    }),
    "That email already has an account. Enter the existing password to join this company.",
  );
  assert.equal(
    inviteJoinError({
      existingUser: true,
      passwordMatches: true,
      alreadyMember: true,
      seatError: "Starter includes 2 seats. Upgrade to add more people.",
    }),
    null,
  );
  assert.equal(
    inviteJoinError({
      existingUser: true,
      passwordMatches: true,
      alreadyMember: false,
      seatError: "Starter includes 2 seats. Upgrade to add more people.",
    }),
    "Starter includes 2 seats. Upgrade to add more people.",
  );
});

test("login reopens the last workspace when the user still belongs there", () => {
  assert.equal(
    pickLoginCompany({
      companyIds: ["co_a", "co_b"],
      lastCompanyId: "co_b",
    }),
    "co_b",
  );
  assert.equal(
    pickLoginCompany({
      companyIds: ["co_a"],
      lastCompanyId: "co_gone",
      preferredCompanyId: "co_owner",
    }),
    "co_a",
  );
});
