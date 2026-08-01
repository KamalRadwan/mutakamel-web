# Mutakamel Tenant Portal

`tenant-portal` is the standalone Next.js application that will replace the
tenant-facing routes and features currently hosted in
`backend/mutakamel-apps/mutakamel-web-app`.

The application is documentation-first while the replacement is being built.
The current source is still a bootstrap shell; a documented capability is not
automatically an implemented screen.

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
| Documentation | Source-verified foundation and route inventory |
| Application shell | Bootstrap only |
| Tenant host admission | Not implemented in this app |
| Authentication/session client | Not implemented in this app |
| Core tenant features | Not implemented in this app |
| CRM features | Not implemented in this app |
| Trade features | Not implemented in this app |
| Application tests | Not configured |
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
