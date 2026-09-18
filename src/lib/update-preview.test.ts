import assert from "node:assert/strict";
import test from "node:test";
import { wantsUpdatePreview } from "./update-preview.ts";

test("update_now=1 opens the preview popup", () => {
  assert.equal(wantsUpdatePreview("?update_now=1"), true);
  assert.equal(wantsUpdatePreview("?update_now=0"), false);
  assert.equal(wantsUpdatePreview(""), false);
});
