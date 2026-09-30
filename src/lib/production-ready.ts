function hostedProduction() {
  return Boolean(
    process.env.OPEN_NEXT_CLOUDFLARE ||
      process.env.CF_PAGES ||
      process.env.VERCEL ||
      process.env.NODE_ENV === "production",
  );
}

export function playBillingConfigured() {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim());
}

export function stripeBillingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_PRO?.trim() &&
      process.env.STRIPE_PRICE_FLEET?.trim(),
  );
}

export function paidBillingConfigured() {
  return stripeBillingConfigured() || playBillingConfigured();
}

export function productionBlockers() {
  const blockers: string[] = [];
  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (hostedProduction() && !supabaseReady) {
    blockers.push("Supabase is not configured.");
  }
  if (hostedProduction() && !paidBillingConfigured()) {
    blockers.push("Neither Stripe nor Google Play billing is configured.");
  }
  return blockers;
}
