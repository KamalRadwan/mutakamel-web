import type { NextConfig } from "next";

const devApiTarget = (
  process.env.DEV_API_TARGET || "http://localhost:9000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{
      source: "/api/:path*",
      destination: `${devApiTarget}/api/:path*`,
    }];
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      poll: false,
      ignored: ['**/node_modules', '**/.git', '**/.next'],
    };
    return config;
  },
};

export default nextConfig;
