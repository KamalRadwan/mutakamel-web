# Tenant Portal System Context

Status: **Verified current backend; replacement frontend pending**

Last verified: **2026-07-25**

## Context

Tenant Portal is a tenant-only browser application. It does not select a
database, trust a caller-supplied tenant identifier, or call backend services
directly. The request host, authenticated token, Gateway route, and backend
guards establish the trusted context.

```text
Tenant browser
  -> Tenant Portal on port 5002
  -> same-origin /api/tenant/{app}/v1/*
  -> API Gateway
  -> Core, CRM, or Trade
  -> tenant/control-plane database as owned by that app

Domain event/outbox
  -> RabbitMQ
  -> Worker or owning application consumer
  -> browser reads status through the command owner
```

## Runtime applications

| Application | Responsibility visible to Tenant Portal | Direct browser access |
| --- | --- | --- |
| Tenant Portal | Host-aware tenant UI and same-origin API boundary | Yes |
| API Gateway | Route allowlist, JWT/audience checks, session watermark, transport policy, trusted context, proxy | Yes, through Tenant Portal/ingress |
| Core | Host, auth, tenant foundation, RBAC, billing, notifications, templates, activities, access policy | Through Gateway |
| CRM | CRM tenant domains and branch-scoped resources | Through Gateway |
| Trade | Trade tenant domains and operating-context resources | Through Gateway |
| Worker | Background effects, provisioning DAG, schedules, render/delivery work | No |
| Realtime | Accepted target architecture only; not a current runtime service | No current connection |

## Data ownership

- Core owns control-plane tenant lifecycle and tenant foundation data.
- CRM owns CRM entities in the tenant database.
- Trade owns Trade entities in the tenant database.
- Worker owns background execution evidence in its own database and uses
  explicitly selected tenant/control-plane connections for jobs.
- API Gateway has no TypeORM/PostgreSQL ownership.
- Tenant Portal stores no authoritative business state.

## Browser API namespaces

| Namespace | Owner |
| --- | --- |
| `/api/tenant/core/v1/*` | Core |
| `/api/tenant/crm/v1/*` | CRM |
| `/api/tenant/trade/v1/*` | Trade |

Legacy `/api/v1/*` paths remain compatibility inputs in the current platform.
New code must use canonical paths.

## Trust boundaries

1. Ingress/Next provides the original host to Gateway without accepting
   arbitrary browser `x-forwarded-*` overrides.
2. Gateway resolves only allowlisted typed routes.
3. Gateway verifies Core-issued JWTs and canonical tenant audience.
4. Gateway removes caller-controlled internal identity/session headers and
   injects trusted context.
5. The owning app independently verifies current identity, session version,
   tenant/host binding, permission, scope, and subscription/module access.
6. The application repository/data layer applies tenant and organization scope.

No single browser or Gateway check replaces owning-app authorization.

## Source evidence

```text
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/gateway-api-path.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-app.registry.ts
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-client.service.ts
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/common.module.ts
../backend/docs/ai/PROJECT_INDEX.md
```

## Current frontend status

The new Tenant Portal does not yet implement the proxy, host gate, shared API
client, authentication, or feature routes. The old web app is replacement
evidence only.
