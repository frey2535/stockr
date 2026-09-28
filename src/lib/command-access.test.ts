import assert from "node:assert/strict";
import test from "node:test";
import { canChangeBilling, commandAccessError } from "./command-access.ts";

test("members cannot change settings or invites", () => {
  assert.equal(commandAccessError("member", "updateSettings").length > 0, true);
  assert.equal(commandAccessError("member", "createAccessCode").length > 0, true);
  assert.equal(commandAccessError("member", "applyAction"), "");
  assert.equal(canChangeBilling("member"), false);
  assert.equal(canChangeBilling("owner"), true);
});

test("admins can change company setup", () => {
  assert.equal(commandAccessError("admin", "upsertMaterial"), "");
  assert.equal(commandAccessError("owner", "resetDemo"), "");
  assert.equal(commandAccessError("admin", "resetDemo").length > 0, true);
});
