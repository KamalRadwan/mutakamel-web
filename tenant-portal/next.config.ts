import type { NextConfig } from "next";

const devApiTarget = (
  process.env.DEV_API_TARGET || "http://localhost:9000"
).replace(/\/+$/, "");

/**
 * Tenant workspaces are reached through customer-owned domains, so the set of
 * hosts a developer legitimately loads this dev server from is open-ended. This
 * is the frontend twin of backend SD-01, and it is a DIFFERENT mechanism:
 * SD-01 relaxes the Gateway's CSRF origin check for tenant API calls, while
 * this only tells `next dev` which hosts may pull `/_next/*` and open the
 * hot-reload WebSocket. It has no production effect at all — `blockCrossSiteDEV`
 * runs only under `next dev`.
 *
 * `"**.*"` is NOT a stylistic choice, and it must not be "cleaned up" to `"*"`.
 * Next rejects a bare wildcard on purpose, in
 * `next/dist/server/app-render/csrf-protection.js`:
 *
 *     if (patternParts.length === 1 && (parts[0] === '*' || parts[0] === '**'))
 *       return false;
 *
 * so `allowedDevOrigins: ["*"]` is accepted by the schema, reads as "allow
 * everything", and blocks every cross-origin host — a config that looks correct
 * and does nothing. `"**.*"` is the permissive pattern that the matcher
 * actually honours. Verified against Next's own matcher, not assumed.
 *
 * `localhost` and `*.localhost` are omitted deliberately: `blockCrossSiteDEV`
 * prepends both, plus the bound hostname, to this list already.
 */
const ALLOWED_DEV_ORIGINS = ["**.*"];

/**
 * The pattern above depends on matcher behaviour Next has already tightened
 * once. If a future release rejects `"**.*"` as well, the failure is silent:
 * HMR simply stops connecting and the app renders blank, which is exactly the
 * symptom this setting was added to fix.
 *
 * So assert it. A missing module means the internal path moved and we cannot
 * check — that is not a reason to refuse to boot, so it degrades quietly. A
 * module that loads and rejects the pattern is the real regression, and it
 * fails loudly with the reason.
 */
function assertDevOriginsAreNotInert(): void {
  let isAllowed: ((host: string, patterns: string[]) => boolean) | undefined;
  try {
    // A static import cannot be caught, and being unable to load this module is
    // explicitly not a reason to refuse to boot — so this has to be a runtime
    // require. Next resolves next.config.ts as CommonJS, where it is available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ isCsrfOriginAllowed: isAllowed } = require(
      "next/dist/server/app-render/csrf-protection",
    ));
  } catch {
    return; // Internal path moved — cannot verify, so do not block startup.
  }

  const probe = "tenant.example.test";
  if (isAllowed && !isAllowed(probe, ALLOWED_DEV_ORIGINS)) {
    throw new Error(
      `allowedDevOrigins ${JSON.stringify(ALLOWED_DEV_ORIGINS)} no longer matches ` +
        `"${probe}". Next's origin matcher has changed, and cross-origin dev ` +
        `hosts are being blocked. See the comment above ALLOWED_DEV_ORIGINS in ` +
        `next.config.ts and docs/architecture/security-headers.md.`,
    );
  }
}

if (process.env.NODE_ENV === "development") {
  assertDevOriginsAreNotInert();
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
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
  async redirects() {
    return [{
      source: "/crm/pipeline",
      destination: "/crm/opportunities",
      permanent: false,
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
