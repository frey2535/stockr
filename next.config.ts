import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cursor preview loads 127.0.0.1 while `next dev` binds localhost.
  // Without this, HTML returns 200 but /_next JS chunks are 403 and the app looks blank.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "::1",
    "0.0.0.0",
    "stockr.currentflowconsulting.org",
  ],
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "sso_token", value: "(?<sso_token>.+)" }],
        destination: "/api/auth/buildr-sso?sso_token=:sso_token",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/signin", destination: "/login" },
      { source: "/sign-in", destination: "/login" },
      { source: "/sign_in", destination: "/login" },
      { source: "/sign-up", destination: "/signup" },
      { source: "/sign_up", destination: "/signup" },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();

