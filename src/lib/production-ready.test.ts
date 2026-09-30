import assert from "node:assert/strict";
import test from "node:test";
import { paidBillingConfigured, productionBlockers } from "./production-ready.ts";

test("hosted production without billing is blocked", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
    STRIPE_PRICE_FLEET: process.env.STRIPE_PRICE_FLEET,
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_FLEET;
  delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  assert.equal(paidBillingConfigured(), false);
  assert.equal(productionBlockers().some((row) => /billing/i.test(row)), true);
  Object.assign(process.env, previous);
});
