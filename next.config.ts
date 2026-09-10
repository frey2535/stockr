import type { NextConfig } from "next";

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
      { source: "/signin", destination: "/login", permanent: false },
      { source: "/sign-in", destination: "/login", permanent: false },
      { source: "/sign_in", destination: "/login", permanent: false },
      { source: "/sign-up", destination: "/signup", permanent: false },
      { source: "/sign_up", destination: "/signup", permanent: false },
    ];
  },
};

export default nextConfig;
