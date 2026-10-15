import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizePurchasing,
  convertQuoteToProcurement,
  observationFromOffer,
  purchasingAuthorizationError,
  quoteOnlyCannotPurchaseError,
  requestStatusError,
  requireRequestType,
  rfqDispatchClaim,
  tenantMismatchError,
} from "./procurement-policy.ts";

test("quote-only cannot reserve or order even if a client crafts approval", () => {
  const quote = {
    id: "req_1",
    request_type: "QUOTE_ONLY" as const,
    purchasing_authorized: true,
    authorization_id: "auth_forged",
    status: "approved",
  };
  assert.match(quoteOnlyCannotPurchaseError(quote), /quote-only/i);
  assert.match(purchasingAuthorizationError(quote), /quote-only/i);
  assert.match(requestStatusError(quote, "picking"), /cannot move/i);
});

test("procurement cannot order without a durable authorization id", () => {
  const request = {
    id: "req_2",
    request_type: "PROCUREMENT" as const,
    purchasing_authorized: false,
    authorization_id: null,
    status: "approved",
  };
  assert.match(purchasingAuthorizationError(request), /authorization/i);
  const authorized = authorizePurchasing(request, "auth_1");
  assert.equal(purchasingAuthorizationError(authorized), "");
});

test("converting quote-only to procurement resets authorization", () => {
  const converted = convertQuoteToProcurement({
    id: "req_3",
    request_type: "QUOTE_ONLY",
    purchasing_authorized: true,
    authorization_id: "old",
    status: "quoted",
  });
  assert.equal(converted.request_type, "PROCUREMENT");
  assert.equal(converted.purchasing_authorized, false);
  assert.equal(converted.authorization_id, null);
  assert.equal(converted.converted_from_id, "req_3");
  assert.match(purchasingAuthorizationError(converted), /authorization/i);
});

test("missing prices stay null and unverified", () => {
  assert.equal(observationFromOffer({ price: 12.5 }).unit_price, null);
  assert.equal(observationFromOffer({ price: 12.5 }).price_status, "unavailable");
  assert.equal(
    observationFromOffer({ price: 12.5, productUrl: "https://supplier.example/sku" }).price_status,
    "verified",
  );
});

test("request type must be explicit and tenant ids cannot be swapped", () => {
  assert.equal(requireRequestType("quote_only"), "QUOTE_ONLY");
  assert.throws(() => requireRequestType(""), /Choose Quote only or Procurement/);
  assert.match(tenantMismatchError("co_a", "co_b"), /does not match/);
  assert.equal(tenantMismatchError("co_a", "co_a"), "");
  assert.match(rfqDispatchClaim("dispatched"), /does not mark an RFQ sent/);
});
