import { Capacitor, registerPlugin } from "@capacitor/core";
import { playProductId } from "./play-products";
import type { PlanId } from "./types";

export { PLAY_PACKAGE, PLAY_PRODUCTS, planFromPlayProduct, playProductId } from "./play-products";

type PlayPurchase = {
  productId: string;
  purchaseToken: string;
};

type PlayBillingPlugin = {
  purchase(options: { productId: string }): Promise<PlayPurchase>;
  restore(): Promise<{ purchases: PlayPurchase[] }>;
};

const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function purchasePlayPlan(plan: Exclude<PlanId, "starter">) {
  return PlayBilling.purchase({ productId: playProductId(plan) });
}

export async function restorePlayPurchases() {
  return PlayBilling.restore();
}
