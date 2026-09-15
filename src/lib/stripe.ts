import Stripe from "stripe";
import type { PlanId } from "./types";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function stripePriceId(plan: PlanId) {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO?.trim() || "";
  if (plan === "fleet") return process.env.STRIPE_PRICE_FLEET?.trim() || "";
  return "";
}

export function stripeConfigured() {
  return Boolean(getStripe() && stripePriceId("pro") && stripePriceId("fleet"));
}

export function checkoutIntegrationId() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `stockr_pwa_${suffix}`;
}

export function planFromStripePrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return "pro";
  if (priceId === process.env.STRIPE_PRICE_FLEET?.trim()) return "fleet";
  return null;
}
