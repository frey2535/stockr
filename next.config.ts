import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor preview loads 127.0.0.1 while `next dev` binds localhost.
  // Without this, HTML returns 200 but /_next JS chunks are 403 and the app looks blank.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "::1",
    "0.0.0.0",
  ],
};

export default nextConfig;
