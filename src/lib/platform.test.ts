import assert from "node:assert/strict";
import test from "node:test";
import {
  PLATFORM_OWNER_EMAIL,
  isPlatformOwner,
  platformOwnerEmail,
  platformOwnerPassword,
  seededOwnersToProvision,
} from "./platform.ts";

test("default platform owner is the CurrentFlow mailbox", () => {
  delete process.env.PLATFORM_OWNER_EMAIL;
  delete process.env.PLATFORM_OWNER_EMAILS;
  assert.equal(platformOwnerEmail(), PLATFORM_OWNER_EMAIL);
  assert.equal(isPlatformOwner("currentflowconsultingllc@gmail.com"), true);
  assert.equal(isPlatformOwner("CurrentFlowConsultingLLC@gmail.com"), true);
  assert.equal(isPlatformOwner("demo@stockr.app"), false);
  assert.equal(isPlatformOwner("marcus.a.frey@gmail.com"), true);
});

test("PLATFORM_OWNER_EMAILS adds extra owners", () => {
  process.env.PLATFORM_OWNER_EMAILS = "ops@currentflowconsulting.org";
  assert.equal(isPlatformOwner("ops@currentflowconsulting.org"), true);
  delete process.env.PLATFORM_OWNER_EMAILS;
});

test("owners are not provisioned without PLATFORM_OWNER_PASSWORD", () => {
  delete process.env.PLATFORM_OWNER_PASSWORD;
  assert.equal(platformOwnerPassword(), "");
  assert.equal(seededOwnersToProvision().length, 0);
});

test("password comes only from the environment", () => {
  process.env.PLATFORM_OWNER_PASSWORD = "  secret-pass  ";
  assert.equal(platformOwnerPassword(), "secret-pass");
  assert.equal(seededOwnersToProvision().length, 2);
  assert.equal(seededOwnersToProvision()[0]?.resetPassword, false);
  delete process.env.PLATFORM_OWNER_PASSWORD;
});
