# Authorization, Scope, and Entitlements

Status: **Verified cross-application rules**

Last verified: **2026-07-25**

## Layers

Tenant authorization is the intersection of:

1. recognized active/supported tenant host;
2. valid tenant-audience JWT;
3. current non-deleted identity and session version;
4. current tenant lifecycle/access policy;
5. subscribed module and feature entitlement;
6. assigned module seat where required;
7. role permission;
8. organization scope such as company, branch, channel, team, or owner;
9. resource state and ownership;
10. command-specific concurrency/idempotency rules.

A frontend permission check is never sufficient by itself.

## Core guard order

Current Core global order is:

```text
JWT
-> FQDN tenant resolution
-> database session version
-> permissions
-> branch access
-> subscription enforcement
-> rate limiting
```

Tenant context and response/correlation interceptors run around the handler.

## CRM guard order

CRM independently enforces:

```text
JWT
-> trusted Gateway tenant context
-> current tenant-user/module-seat state
-> permissions
-> branch/own/team/all scope
-> subscription entitlement
-> rate limiting
```

Exact order must be rechecked when global providers change.

## Trade guard order

Trade independently enforces:

```text
JWT
-> trusted Gateway tenant context
-> current user/Trade seat
-> subscription entitlement
-> company/branch/channel operating context
-> permissions/resource scope
-> rate limiting
```

Trade features frequently require an explicit operating context in addition to
tenant identity.

## Permission rules

- Permission wire values are exact case-sensitive strings.
- `read`, `create`, `update`, `delete`, lifecycle, publish, and recovery actions
  are distinct.
- Scoped permissions may use `own`, `team`, or `all`; selecting a broader
  identifier does not broaden the actor's grant.
- Owner-only billing/subscription routes may use a dedicated owner guard rather
  than ordinary RBAC.
- Hidden navigation is usability behavior, not security.
- A `403` should not be converted to empty data.

See [RBAC matrix](../rbac-matrix.md).

## Module and seat rules

Core materializes access policy from subscribed module keys. CRM-only tenants
must not receive Trade entities or capabilities, and vice versa.

The client should distinguish:

- module not subscribed;
- feature not included in the selected tier;
- module subscribed but actor seat not assigned;
- permission missing;
- tenant temporarily read-only or suspended;
- backend component not ready or under maintenance.

Do not use one generic "not found" state for all of these after authentication.

## Organization scope

- Tenant scope is never accepted from request body alone.
- Company/branch/channel IDs are validated against the actor's current grants.
- Resource lookup and write predicates must include tenant and applicable
  organization scope.
- Lists and lookup endpoints can have different permission rules.
- Cross-domain references such as CRM customer to Trade quotation require the
  owning app's safe projection or adapter, not direct frontend joins.

## UI capability projection

When an API exposes capabilities, use it to enable actions and explain state.
Still handle a later `403` or `409`, because permissions and resource state can
change after the projection is loaded.

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/common/common.module.ts
../backend/mutakamel-apps/core-app/src/common/tenant-access/
../backend/mutakamel-apps/core-app/src/admin/subscriptions/tenant-access-policy-materializer.service.ts
../backend/mutakamel-apps/crm-app/src/common/common.module.ts
../backend/mutakamel-apps/trade-app/src/common/common.module.ts
../backend/mutakamel-apps/shared-libs/packages/auth/
```
