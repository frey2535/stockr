import assert from "node:assert/strict";
import test from "node:test";
import { tokenLookup } from "./token-lookup.ts";

test("password reset lookup is stable and not the raw token", () => {
  const token = "rst_example_token";
  assert.equal(tokenLookup(token), tokenLookup(token));
  assert.notEqual(tokenLookup(token), token);
  assert.equal(tokenLookup(token).length, 64);
});
