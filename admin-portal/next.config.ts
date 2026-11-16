import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// In dev, proxy /api/* to the local backend so cookies are same-origin and
// SameSite=Lax/Strict work without needing SameSite=None.
// In production the deployment ingress must proxy the same-origin /api/*
// namespace. A cross-origin browser API base is incompatible with the
// origin-bound __Host auth/CSRF cookie contract.
const devApiTarget =
  process.env.DEV_API_TARGET || "http://localhost:9000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Production images run the self-contained server (`node server.js`). The
  // app imports source-based workspace packages from ../packages, so tracing
  // starts at the frontend workspace root (`next build` runs in this folder).
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
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
