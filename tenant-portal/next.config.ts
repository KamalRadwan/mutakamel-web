import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  typescript: {
    ignoreBuildErrors: true, // as requested to save RAM during dev
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
