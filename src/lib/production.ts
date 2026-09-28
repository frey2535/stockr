export function isHostedProduction() {
  return Boolean(
    process.env.OPEN_NEXT_CLOUDFLARE ||
      process.env.CF_PAGES ||
      process.env.VERCEL ||
      process.env.NODE_ENV === "production",
  );
}

export function allowMockBilling() {
  return process.env.STOCKR_ALLOW_MOCK_BILLING === "1" && !isHostedProduction();
}

export function allowUnverifiedPlay() {
  return process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED === "1" && !isHostedProduction();
}

export function demoWorkspaceEnabled() {
  return process.env.STOCKR_ENABLE_DEMO === "1" || process.env.NEXT_PUBLIC_STOCKR_DEMO === "1";
}

export function publicDemoEnabled() {
  return process.env.NEXT_PUBLIC_STOCKR_DEMO === "1";
}
