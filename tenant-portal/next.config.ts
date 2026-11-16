import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import type { NextConfig } from "next";

const requireFromPortal = createRequire(path.join(process.cwd(), "package.json"));

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
// Measured repeated concrete modules only; never a feature/index barrel.
const REUSED_PORTAL_SOURCE = new Set([
  "src/hooks/useTenantBranchLabels.ts",
  "src/hooks/useTenantBranchSelect.ts",
  "src/hooks/useTenantBranchSelection.ts",
  "src/hooks/useAuthScopeKey.ts",
  "src/lib/tenant-branch-selection.ts",
  "src/lib/geo/country-data.ts",
  "src/lib/format/date.ts",
  "src/lib/api/envelope.ts",
  "src/components/tenant/TenantBranchSelect.tsx",
  "src/components/audit/RecordHistoryLayout.tsx",
  "src/app/(tenant)/core/hooks/useCoreErrorText.ts",
]);

interface SharedSourceModule {
  nameForCondition: () => string | null;
  layer?: string | null;
}

function relativeModulePath(module: SharedSourceModule): string {
  const resource = module.nameForCondition();
  return resource ? path.relative(process.cwd(), resource).split(path.sep).join("/") : "";
}

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
  // Production images run the self-contained server (`node server.js`). The
  // app imports source-based workspace packages from ../packages, so tracing
  // starts at the frontend workspace root (`next build` runs in this folder).
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [{
      source: "/crm/pipeline",
      destination: "/crm/opportunities",
      permanent: false,
    }];
  },
  webpack: (config, { dev, isServer, webpack }) => {
    if (!isServer) {
      // Published contracts require Zod while screens import it. Resolve both
      // to the same public ESM entry instead of shipping two validator runtimes.
      config.resolve.alias = {
        ...config.resolve.alias,
        "zod$": path.join(path.dirname(requireFromPortal.resolve("zod/package.json")), "index.js"),
      };
      // Zod's CommonJS consumers retain its locale namespace. Keep the two
      // product languages instead of shipping every unused vendor locale.
      config.plugins ??= [];
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /[/\\]zod[/\\]v4[/\\]locales[/\\]index\.js$/,
        path.resolve(process.cwd(), "src/i18n/validation-locales.ts"),
      ));
      const splitChunks = config.optimization?.splitChunks;
      if (!dev && splitChunks && typeof splitChunks === "object") {
        // These small modules otherwise repeat in up to 54 route bundles.
        // Automatic names retain each chunk's real consumers; one named
        // mega-chunk would make unrelated pages download feature helpers.
        splitChunks.cacheGroups = {
          ...splitChunks.cacheGroups,
          reusedPortalIcons: {
            test: /[/\\]node_modules[/\\]lucide-react[/\\]/,
            chunks: "all",
            minChunks: 2,
            minSize: 0,
            enforce: true,
            priority: 40,
            reuseExistingChunk: true,
            name: false,
          },
          reusedPortalHelpers: {
            test: /[/\\]src[/\\](?:app[/\\]\(tenant\)[/\\]core[/\\]contracts[/\\](?:core-page|organization-contract)|hooks[/\\]useUnsavedChangesGuard|lib[/\\]format[/\\]localized)\.ts$/,
            chunks: "all",
            minChunks: 2,
            minSize: 0,
            enforce: true,
            priority: 40,
            reuseExistingChunk: true,
            name: false,
          },
          reusedPortalSource: {
            test: (module: SharedSourceModule) => REUSED_PORTAL_SOURCE.has(relativeModulePath(module)),
            layer: "app-pages-browser",
            usedExports: false,
            chunks: "all",
            minChunks: 1,
            minSize: 0,
            enforce: true,
            priority: 35,
            reuseExistingChunk: true,
            // Like Next's lib group, give each proven reusable module its
            // own layer-aware name. This joins its export/runtime partitions
            // without making unrelated consumers download a mega-chunk.
            name(module: SharedSourceModule) {
              return `portal-${createHash("sha1").update(relativeModulePath(module)).update(module.layer ?? "").digest("hex").slice(0, 8)}`;
            },
          },
        };
      }
    }
    config.watchOptions = {
      ...config.watchOptions,
      poll: false,
      ignored: ['**/node_modules', '**/.git', '**/.next'],
    };
    return config;
  },
};

export default nextConfig;
