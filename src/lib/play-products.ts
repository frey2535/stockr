import type { PlanId } from "./types";

export const PLAY_PRODUCTS: Record<Exclude<PlanId, "starter">, string> = {
  pro: process.env.NEXT_PUBLIC_PLAY_PRODUCT_PRO || "stockr_pro",
  fleet: process.env.NEXT_PUBLIC_PLAY_PRODUCT_FLEET || "stockr_fleet",
};

export const PLAY_PACKAGE =
  process.env.NEXT_PUBLIC_PLAY_PACKAGE || "org.currentflowconsulting.stockr";

export function playProductId(plan: Exclude<PlanId, "starter">) {
  return PLAY_PRODUCTS[plan];
}

export function planFromPlayProduct(productId: string): PlanId | null {
  if (productId === PLAY_PRODUCTS.pro || productId === "pro") return "pro";
  if (productId === PLAY_PRODUCTS.fleet || productId === "fleet") return "fleet";
  return null;
}
