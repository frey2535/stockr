import assert from "node:assert/strict";
import test from "node:test";
import { allowMockBilling, allowUnverifiedPlay, demoWorkspaceEnabled } from "./production.ts";

test("production refuses mock billing and unverified Play", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STOCKR_ALLOW_MOCK_BILLING: process.env.STOCKR_ALLOW_MOCK_BILLING,
    GOOGLE_PLAY_ALLOW_UNVERIFIED: process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED,
    STOCKR_ENABLE_DEMO: process.env.STOCKR_ENABLE_DEMO,
    OPEN_NEXT_CLOUDFLARE: process.env.OPEN_NEXT_CLOUDFLARE,
  };
  process.env.NODE_ENV = "production";
  process.env.STOCKR_ALLOW_MOCK_BILLING = "1";
  process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED = "1";
  delete process.env.STOCKR_ENABLE_DEMO;
  delete process.env.NEXT_PUBLIC_STOCKR_DEMO;
  assert.equal(allowMockBilling(), false);
  assert.equal(allowUnverifiedPlay(), false);
  assert.equal(demoWorkspaceEnabled(), false);
  Object.assign(process.env, previous);
});
