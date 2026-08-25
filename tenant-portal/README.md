# Mutakamel Tenant Portal

`tenant-portal` is the current standalone Next.js application for the Tenant
browser experience. Caddy routes the configured local Tenant hosts to its fixed
port; the consolidated `backend/mutakamel-apps/mutakamel-web-app` remains
migration/reference source and is not the current ingress target.

The application contains an implemented shell, authentication/session client,
and partial Core, CRM, and Trade feature source. Documentation is not runtime or
release evidence: verify each capability against its current source, tests, and
authenticated deployment before treating it as complete.

## Runtime

- Next.js 16.2.11 and React 19.
- Fixed development and production port: `5002`.
- Browser API traffic goes through API Gateway only.
- Canonical tenant API prefixes:
  - Core: `/api/tenant/core/v1`
  - CRM: `/api/tenant/crm/v1`
  - Trade: `/api/tenant/trade/v1`
- Worker has no direct Tenant Portal HTTP surface. Its asynchronous state is
  read through Core, CRM, or Trade projections exposed by Gateway.

## Documentation

Start with [docs/README.md](docs/README.md).

The documentation covers:

- replacement scope and application behavior;
- backend ownership and request flow;
- API routes, validation, permissions, errors, and examples;
- tenant resolution, authentication, authorization, and security;
- static transport values and DTO conventions;
- AI-agent source precedence and implementation playbooks;
- current implementation status and known gaps.

Visual design, page styling, and component appearance are intentionally outside
this documentation set.

## Current implementation status

| Area | Status |
| --- | --- |
| Documentation | Source-verified foundation and route inventory; individual capability status remains explicit |
| Application shell | Implemented; feature completeness varies by route |
| Tenant host admission | Ingress/Core-owned; current Caddy routes configured Tenant hosts to `5002`, while Gateway/Core remain authority |
| Authentication/session client | Implemented source for email/password login, `/auth/me` bootstrap, reusable cross-tab refresh, activity, logout, and self-session management; authenticated runtime proof remains open |
| Core tenant features | Partial implementation; verify each documented route/screen independently |
| CRM features | Partial implementation; verify each documented route/screen independently |
| Trade features | Partial implementation; verify each documented route/screen independently |
| Application tests | Vitest configured; coverage is capability-specific and is not a blanket release gate |
| Documentation audit | Configured |

The existing tenant implementation under
`backend/mutakamel-apps/mutakamel-web-app` is migration evidence and a behavior
reference. Gateway contracts and owning backend source remain authoritative.

## Commands

From `C:\mutakamel.ai\frontend`:

```powershell
pnpm --filter tenant-portal dev
pnpm --filter tenant-portal lint
pnpm --filter tenant-portal typecheck
pnpm --filter tenant-portal docs:routes
pnpm --filter tenant-portal docs:check
pnpm --filter tenant-portal build
```

Do not run this application on an alternate port.
