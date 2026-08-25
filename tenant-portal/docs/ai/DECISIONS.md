# Tenant Portal Decisions

Last verified: **2026-08-10**

## ADR-001: Standalone replacement

Decision: `frontend/tenant-portal` is the current standalone Tenant frontend.
The backend repository's formerly combined `mutakamel-web-app` source is absent
from the current checkout.

Consequences:

- retained old-web documentation is dated migration/design evidence only;
- admin and partner behavior are not copied into this app;
- cutover requires an explicit route-by-route replacement inventory;
- the absent old app is not runnable rollback source and cannot prove current
  behavior, build success, or route coverage.

## ADR-002: Gateway-only browser API

Decision: browser traffic uses canonical
`/api/tenant/{core|crm|trade}/v1/*` paths through API Gateway.

Consequences:

- no direct Core/CRM/Trade origins in feature code;
- controller and Swagger paths are never browser URLs;
- one shared proxy/client owns trusted-header stripping, errors, auth, and
  idempotency;
- Worker is not a browser API.

## ADR-003: Server-side tenant host admission

Decision: validate the original host against Core/Gateway before rendering
tenant UI.

Consequences:

- unknown/unverified hosts fail closed;
- client-only validation is insufficient;
- root layout/admission covers `/login`;
- token tenant and host tenant must match;
- suspended tenants retain only approved pre-auth access.

## ADR-004: Core owns tenant identity and foundation

Decision: Core is authoritative for tenant auth, identity, organization
foundation, access policy, billing, notifications, templates, and tenant-visible
provisioning/update projections.

Consequences:

- CRM/Trade do not become identity providers;
- the frontend does not join databases or choose tenant placement;
- subscription/module/seat state is server-authoritative.

## ADR-005: Domain apps authorize independently

Decision: CRM and Trade revalidate identity, session, tenant context,
entitlement, permission, and organization/resource scope.

Consequences:

- Gateway authentication is necessary but not sufficient;
- frontend permission checks are advisory;
- cross-domain journeys use safe public projections.

## ADR-006: Background work is read through its command owner

Decision: Worker performs background effects but is never called directly by
Tenant Portal.

Consequences:

- `202` is not completion;
- browser polling uses Core/CRM/Trade job or operation routes;
- RabbitMQ and Worker database schemas do not become frontend contracts.

## ADR-007: Documentation separates truth dimensions

Decision: every feature records Backend, Gateway, old-web, new-portal, and
documentation status separately.

Consequences:

- a backend API document cannot imply a new screen exists;
- planned and current behavior cannot be mixed;
- generated route inventories remain separate from hand-written decisions.

## ADR-008: No visual design documentation in this phase

Decision: document application behavior, routes, validation, security,
accessibility semantics, bilingual behavior, APIs, static data, AI guidance, and
examples; omit visual design specifications.

Consequences:

- no page mockups, style guide, component appearance, spacing, or visual asset
  work is required;
- functional route and component boundaries remain documented because they are
  implementation architecture.

## ADR-009: Backend is read-only from this project

Decision: this task and frontend workspace may inspect but not edit backend.

Consequences:

- missing safe APIs are recorded as blockers;
- frontend work does not introduce direct DB/service workarounds;
- backend changes require a separately authorized task.
