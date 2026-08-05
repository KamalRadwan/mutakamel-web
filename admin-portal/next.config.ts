import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isDev = process.env.NODE_ENV === "development";

// In dev, proxy /api/* to the local backend so cookies are same-origin and
// SameSite=Lax/Strict work without needing SameSite=None.
// In production no rewrites are added; the browser hits NEXT_PUBLIC_API_URL directly.
const devApiTarget =
  process.env.DEV_API_TARGET || "http://localhost:9000";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },

  async rewrites() {
    if (!isDev) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${devApiTarget}/api/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      poll: false,
      ignored: ['**/node_modules', '**/.git', '**/.next'],
    };
    return config;
  },
  compiler: {
    styledComponents: true,
  },
  turbopack: {}
};

export default nextConfig;
