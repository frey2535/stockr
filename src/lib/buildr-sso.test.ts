import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { familySsoSearch, familySsoTokenFromSearch, verifyFamilySsoToken } from "./buildr-sso.ts";
import { buildrSsoLoginMessage } from "./buildr-sso-identity.ts";

function signTwoPart(claims: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("hex");
  return `${encoded}.${signature}`;
}

function signJwt(claims: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signed = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signed).digest("hex");
  return `${signed}.${signature}`;
}

describe("family SSO search helpers", () => {
  it("reads Buildr token aliases and keeps launch query params", () => {
    const search = new URLSearchParams({
      source: "buildr",
      company_id: "co_smithcomech",
      sso_token: "abc.def",
      email: "owner@shop.com",
      extra: "drop-me",
    });
    assert.equal(familySsoTokenFromSearch(search), "abc.def");
    assert.equal(familySsoTokenFromSearch(new URLSearchParams({ token: "plain" })), "plain");
    assert.equal(familySsoSearch(search).get("sso_token"), "abc.def");
    assert.equal(familySsoSearch(search).get("company_id"), "co_smithcomech");
    assert.equal(familySsoSearch(search).get("extra"), null);
  });
});

describe("verifyFamilySsoToken", () => {
  it("accepts the two-part HMAC Buildr issues", () => {
    process.env.FAMILY_APP_SSO_SECRET = "family-secret";
    const now = 1_700_000_000;
    const token = signTwoPart(
      {
        v: 1,
        aud: "stockr",
        company_id: "co_smithcomech",
        email: "owner@shop.com",
        iat: now - 10,
        exp: now + 300,
      },
      "family-secret",
    );
    const verified = verifyFamilySsoToken(token, now);
    assert.ok(!("error" in verified));
    assert.equal(verified.claims.email, "owner@shop.com");
    assert.equal(verified.claims.company_id, "co_smithcomech");
  });

  it("accepts a three-part HMAC JWT and owner_id fallback", () => {
    process.env.FAMILY_APP_SSO_SECRET = "family-secret";
    const now = 1_700_000_000;
    const token = signJwt(
      {
        v: 1,
        email: "owner@shop.com",
        owner_id: "co_smithcomech",
        iat: now,
        exp: now + 120,
      },
      "family-secret",
    );
    const verified = verifyFamilySsoToken(token, now);
    assert.ok(!("error" in verified));
    assert.equal(verified.claims.company_id, "co_smithcomech");
  });

  it("rejects expired, unsigned, and wrong-audience tokens", () => {
    process.env.FAMILY_APP_SSO_SECRET = "family-secret";
    const now = 1_700_000_000;
    const expired = signTwoPart(
      { email: "owner@shop.com", company_id: "co_x", exp: now - 1 },
      "family-secret",
    );
    assert.deepEqual(verifyFamilySsoToken(expired, now), { error: "expired" });
    assert.deepEqual(verifyFamilySsoToken("not-a-token", now), { error: "invalid_token" });
    const wrongAud = signTwoPart(
      { email: "owner@shop.com", company_id: "co_x", aud: "buildr", exp: now + 60 },
      "family-secret",
    );
    assert.deepEqual(verifyFamilySsoToken(wrongAud, now), { error: "wrong_audience" });
  });
});

describe("buildrSsoLoginMessage", () => {
  it("does not call a failed Buildr launch a password error", () => {
    assert.match(buildrSsoLoginMessage("stockr_account_not_linked"), /could not open Stockr/);
    assert.match(buildrSsoLoginMessage("expired"), /expired/);
    assert.match(buildrSsoLoginMessage(""), /Buildr/);
  });
});
