import assert from "node:assert/strict";
import test from "node:test";
import { clientKey, rateLimitMemory } from "./rate-limit.ts";

test("rateLimit blocks after the window fills", () => {
  const key = `test-${Date.now()}`;
  assert.equal(rateLimitMemory(key, 2, 60_000).ok, true);
  assert.equal(rateLimitMemory(key, 2, 60_000).ok, true);
  assert.equal(rateLimitMemory(key, 2, 60_000).ok, false);
});

test("clientKey prefers Cloudflare connecting IP", () => {
  const request = new Request("https://stockr.currentflowconsulting.org", {
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.2",
    },
  });
  assert.equal(clientKey(request, "login"), "203.0.113.9:login");
});
