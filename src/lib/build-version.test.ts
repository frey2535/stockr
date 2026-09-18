import assert from "node:assert/strict";
import test from "node:test";
import { shouldAnnounceAppliedUpdate, shouldOfferUpdate } from "./build-version.ts";

test("does not prompt when the remote build is missing or local", () => {
  assert.equal(shouldOfferUpdate("abc123", ""), false);
  assert.equal(shouldOfferUpdate("abc123", "local"), false);
  assert.equal(shouldOfferUpdate("", "def456"), false);
  assert.equal(shouldOfferUpdate("local", "def456"), false);
});

test("does not prompt when the running build already matches production", () => {
  assert.equal(shouldOfferUpdate("abc123", "abc123"), false);
});

test("prompts when production has a newer commit than the running app", () => {
  assert.equal(shouldOfferUpdate("abc123", "def456"), true);
});

test("announces an already-loaded deploy when the last-seen SHA changed", () => {
  assert.equal(shouldAnnounceAppliedUpdate("abc123", "def456"), true);
  assert.equal(shouldAnnounceAppliedUpdate("abc123", "abc123"), false);
  assert.equal(shouldAnnounceAppliedUpdate("", "def456", true), true);
  assert.equal(shouldAnnounceAppliedUpdate("", "def456", false), false);
  assert.equal(shouldAnnounceAppliedUpdate("abc123", "local", true), false);
});
