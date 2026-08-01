# AI Project Index

Last verified: **2026-07-25**

Executable source wins over target documentation.

## Frontend repository

```text
C:\mutakamel.ai\frontend
  pnpm-workspace.yaml
  admin-portal/
  tenant-portal/
  partner-portal/
```

`tenant-portal` uses Next.js 16.2.11, React 19.2.4, Tailwind CSS 4, and
TypeScript strict mode. Port is fixed at `5002`.

## Current Tenant Portal source

| Path | Current responsibility |
| --- | --- |
| `src/app/layout.tsx` | Default root layout; tenant admission not implemented |
| `src/app/page.tsx` | Bootstrap “Hello world” page |
| `src/app/globals.css` | Tailwind import only |
| `next.config.ts` | Empty config |
| `package.json` | Runtime, lint, typecheck, and documentation audit commands |
| `docs/` | Replacement build documentation |

No shared API client, auth/session layer, host guard, route tree, feature
modules, unit tests, or browser tests currently exist. Documentation route
generation and drift/link checks live under `scripts/docs/`.

## Documentation index

| Concern | Path |
| --- | --- |
| Documentation rules | `docs/DOCUMENTATION_CONTRACT.md` |
| Replacement boundary | `docs/app/replacement-scope.md` |
| Capability ownership | `docs/app/capability-map.md` |
| Application architecture | `docs/app/application-architecture.md` |
| Route inventory | `docs/app/route-map.md` |
| System context | `docs/architecture/system-context.md` |
| Host admission | `docs/architecture/tenant-host-resolution.md` |
| Auth/session | `docs/architecture/authentication-and-session.md` |
| Authorization | `docs/architecture/authorization-and-entitlements.md` |
| Async work | `docs/architecture/asynchronous-workflows.md` |
| Core APIs | `docs/api/*.md` |
| CRM APIs | `docs/api/crm/*.md` |
| Trade APIs | `docs/api/trade/*.md` |
| Generated route contracts | `docs/generated/tenant-api-routes.{md,json}` |
| Documentation audit | `docs/audit/` |
| Validation | `docs/validation/` |
| Security | `docs/security/` |
| Static transport data | `docs/static-data.md`, `docs/rbac-matrix.md` |
| Examples | `docs/examples/` |
| AI rules | `docs/ai/` |

## Validation commands

```powershell
npm run lint
npm run typecheck
npm run docs:routes
npm run docs:check
npm run build
```

`docs:routes` regenerates the route evidence from read-only backend contracts.
`docs:check` fails when that inventory is stale or local links/API metadata are
invalid.

## Backend source roots

Paths are relative to `C:\mutakamel.ai\frontend`:

| Path | Responsibility |
| --- | --- |
| `../backend/mutakamel-apps/api-gateway-app` | Public route and transport source of truth |
| `../backend/mutakamel-apps/core-app` | Tenant identity/foundation/control plane |
| `../backend/mutakamel-apps/crm-app` | CRM domain |
| `../backend/mutakamel-apps/trade-app` | Trade domain |
| `../backend/mutakamel-apps/worker-app` | Background effects |
| `../backend/mutakamel-apps/shared-libs` | Cross-app infrastructure packages |
| `../backend/mutakamel-apps/mutakamel-web-app` | Old tenant implementation to replace |
| `../backend/docs/ai` | Backend path/decision summaries |
| `../backend/docs/LLD` | Detailed contracts; verify against source |

## Gateway route sources

```text
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-app.registry.ts
```

## Important old-web evidence

```text
../backend/mutakamel-apps/mutakamel-web-app/src/app/
../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/
../backend/mutakamel-apps/mutakamel-web-app/e2e/
```

Port behavior, Bootstrap/Sass styling, old combined admin/tenant route
assumptions, and compatibility API paths are not automatically portable.

## Package boundaries

Backend apps are independent pnpm workspaces with their own immutable package
dependencies and lockfiles. Do not import backend TypeScript source into the
frontend. Recreate narrow frontend transport types from verified public
contracts or use a deliberately published browser-safe package if one exists.

## Current unknowns

See [KNOWN_GAPS.md](KNOWN_GAPS.md). Update that file when source investigation
resolves or discovers a gap.
