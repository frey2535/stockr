import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyFamilyLaunchCookies,
  compareFamilyLaunch,
  FAMILY_LAUNCH_COOKIE,
  FAMILY_LAUNCH_RETURN_COOKIE,
  familyLaunchLandingPath,
  familyLaunchReturnFromCookie,
  familyLaunchReturnUrl,
  familyLaunchShouldYield,
  isBuildrHost,
  isFamilyLaunchCookie,
  isFamilyLaunchSearch,
  stripFamilyLaunchSearch,
  type FamilyLaunchInstance,
} from "./family-launch.ts";

function instance(partial: Partial<FamilyLaunchInstance> & { id: string }): FamilyLaunchInstance {
  return {
    fromFamilyLaunch: true,
    native: false,
    standalone: false,
    hasOpener: false,
    embedded: false,
    launchedAt: 1,
    ...partial,
  };
}

describe("family launch landing", () => {
  it("marks the post-SSO path so only the Stockr app keeps the session window", () => {
    assert.equal(familyLaunchLandingPath(null), "/dashboard?from=buildr");
    assert.equal(familyLaunchLandingPath("/tools"), "/tools?from=buildr");
    assert.equal(familyLaunchLandingPath("//evil.example"), "/dashboard?from=buildr");
    assert.equal(familyLaunchLandingPath("https://evil.example"), "/dashboard?from=buildr");
    assert.equal(stripFamilyLaunchSearch("/dashboard?from=buildr&keep=1"), "/dashboard?keep=1");
  });

  it("recognizes Buildr launch markers and hosts", () => {
    assert.equal(isFamilyLaunchSearch("?from=buildr"), true);
    assert.equal(isFamilyLaunchSearch("source=buildr"), true);
    assert.equal(isFamilyLaunchSearch("from=other"), false);
    assert.equal(isFamilyLaunchCookie("stockr_session=abc; stockr_family_launch=1"), true);
    assert.equal(isFamilyLaunchCookie("stockr_family_launch=0"), false);
    assert.equal(isBuildrHost("buildrpm.com"), true);
    assert.equal(isBuildrHost("app.buildrpm.com"), true);
    assert.equal(isBuildrHost("stockr.currentflowconsulting.org"), false);
    assert.equal(familyLaunchReturnUrl("https://buildrpm.com/app/family"), "https://buildrpm.com/app/family");
    assert.equal(familyLaunchReturnUrl("https://stockr.currentflowconsulting.org/dashboard"), null);
    assert.equal(
      familyLaunchReturnFromCookie(`stockr_family_return=${encodeURIComponent("https://buildrpm.com/app")}`),
      "https://buildrpm.com/app",
    );
    assert.equal(
      familyLaunchReturnFromCookie(`stockr_family_return=${encodeURIComponent("javascript:alert(1)")}`),
      null,
    );

    const cookies = new Map<string, string>();
    applyFamilyLaunchCookies(
      {
        set(name, value) {
          cookies.set(name, value);
        },
      },
      "https://buildrpm.com/family",
    );
    assert.equal(cookies.get(FAMILY_LAUNCH_COOKIE), "1");
    assert.equal(cookies.get(FAMILY_LAUNCH_RETURN_COOKIE), encodeURIComponent("https://buildrpm.com/family"));
  });
});

describe("family launch duplicate windows", () => {
  it("keeps a single window when Stockr did not also open the app", () => {
    const browser = instance({ id: "browser" });
    assert.equal(familyLaunchShouldYield(browser, []), false);
    assert.equal(familyLaunchShouldYield({ ...browser, fromFamilyLaunch: false }, [], true), false);
  });

  it("yields the Buildr window when the Stockr app or PWA is present", () => {
    const inBuildr = instance({ id: "buildr-window", launchedAt: 1 });
    const stockrApp = instance({ id: "stockr-app", standalone: true, launchedAt: 2 });
    assert.equal(familyLaunchShouldYield(inBuildr, [stockrApp]), true);
    assert.equal(familyLaunchShouldYield(stockrApp, [inBuildr]), false);
    assert.equal(familyLaunchShouldYield(inBuildr, [], true), true);
  });

  it("keeps the window Buildr opened and releases the window that navigated in place", () => {
    const navigated = instance({ id: "navigated", launchedAt: 1 });
    const opened = instance({ id: "opened", hasOpener: true, launchedAt: 2 });
    assert.equal(familyLaunchShouldYield(navigated, [opened]), true);
    assert.equal(familyLaunchShouldYield(opened, [navigated]), false);
    assert.ok(compareFamilyLaunch(opened, navigated) > 0);
  });

  it("never yields the native Stockr app", () => {
    const native = instance({ id: "native", native: true });
    const browser = instance({ id: "browser" });
    assert.equal(familyLaunchShouldYield(native, [browser], true), false);
    assert.equal(familyLaunchShouldYield(browser, [native]), true);
  });
});
