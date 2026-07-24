import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// In dev, proxy /api/* to the local backend so cookies are same-origin and
// SameSite=Lax/Strict work without needing SameSite=None.
// In production no rewrites are added; the browser hits NEXT_PUBLIC_API_URL directly.
const devApiTarget =
  process.env.DEV_API_TARGET || "http://localhost:9000";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!isDev) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${devApiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
