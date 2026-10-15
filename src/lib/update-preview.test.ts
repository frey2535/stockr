import assert from "node:assert/strict";
import test from "node:test";
import { nextRefreshUrl, wantsUpdatePreview } from "./update-preview.ts";

test("update_now=1 opens the preview popup", () => {
  assert.equal(wantsUpdatePreview("?update_now=1"), true);
  assert.equal(wantsUpdatePreview("?update_now=0"), false);
  assert.equal(wantsUpdatePreview(""), false);
});

test("refresh URL cache-busts and drops the preview flag", () => {
  assert.equal(
    nextRefreshUrl("https://stockr.currentflowconsulting.org/catalog?update_now=1&q=romex", 1700000000000, "abc1234"),
    "/catalog?q=romex&t=1700000000000&build=abc1234",
  );
});

test("refresh URL works from a path when no new build SHA is known", () => {
  assert.equal(nextRefreshUrl("/field-ops", 42), "/field-ops?t=42");
});
