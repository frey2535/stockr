import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectAllMatching } from "./supabase-page.ts";

describe("selectAllMatching", () => {
  it("stops when a page is missing instead of treating a non-array as more rows", async () => {
    const rows = await selectAllMatching(async () => ({ data: null, error: null }), "empty");
    assert.deepEqual(rows, []);
  });

  it("rejects a non-array page so workspace load cannot loop", async () => {
    await assert.rejects(
      selectAllMatching(async () => ({ data: { id: "row" } as never, error: null }), "bad"),
      /expected an array/,
    );
  });
});
