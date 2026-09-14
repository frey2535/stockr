import assert from "node:assert/strict";
import test from "node:test";
import {
  PLATFORM_OWNER_EMAIL,
  isPlatformOwner,
  platformOwnerEmail,
  platformOwnerPassword,
  PLATFORM_OWNER_BOOTSTRAP_PASSWORD,
} from "./platform.ts";

test("default platform owner is the CurrentFlow mailbox", () => {
  delete process.env.PLATFORM_OWNER_EMAIL;
  delete process.env.PLATFORM_OWNER_EMAILS;
  assert.equal(platformOwnerEmail(), PLATFORM_OWNER_EMAIL);
  assert.equal(isPlatformOwner("currentflowconsultingllc@gmail.com"), true);
  assert.equal(isPlatformOwner("CurrentFlowConsultingLLC@gmail.com"), true);
  assert.equal(isPlatformOwner("demo@stockr.app"), false);
});

test("PLATFORM_OWNER_EMAILS adds extra owners", () => {
  process.env.PLATFORM_OWNER_EMAILS = "ops@currentflowconsulting.org";
  assert.equal(isPlatformOwner("ops@currentflowconsulting.org"), true);
  delete process.env.PLATFORM_OWNER_EMAILS;
});

test("password prefers env over bootstrap", () => {
  delete process.env.PLATFORM_OWNER_PASSWORD;
  assert.equal(platformOwnerPassword(), PLATFORM_OWNER_BOOTSTRAP_PASSWORD);
  process.env.PLATFORM_OWNER_PASSWORD = "  secret-pass  ";
  assert.equal(platformOwnerPassword(), "secret-pass");
  delete process.env.PLATFORM_OWNER_PASSWORD;
});
