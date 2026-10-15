import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("update prompt is mounted only in the authenticated app layout", () => {
  const providers = source("../components/providers.tsx");
  const appLayout = source("../app/(app)/layout.tsx");
  assert.equal(providers.includes("UpdateAvailablePrompt"), false);
  assert.equal(appLayout.includes("UpdateAvailablePrompt"), true);
});

test("required updates remain visible until the user presses Update now", () => {
  const prompt = source("../components/update-available-prompt.tsx");
  assert.equal(prompt.includes("setTimeout"), false);
  assert.match(prompt, /Select Update now to load it/);
  assert.match(prompt, />Update now</);
});
