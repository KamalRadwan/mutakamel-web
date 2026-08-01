# Tenant and Organization Isolation

Status: **Verified backend boundary; frontend requirements current**

Last verified: **2026-07-25**

## Tenant selection

Tenant context comes from the verified request host and trusted authentication
context. The frontend must not choose a tenant database or grant tenant scope
through a query/body field.

Authenticated token tenant ID must equal the host-resolved tenant ID.

## Trusted context

Browser code must not send or preserve:

```text
x-actor-id
x-actor-type
x-branch-id
x-company-id
x-internal-*
x-permissions
x-role-ids
x-service-name
x-service-token
x-session-version
x-tenant-id
x-user-id
x-user-type
caller-supplied x-forwarded-*
```

The Next proxy and Gateway strip caller-controlled variants. Gateway injects
trusted context from the verified route/token/request.

## Backend responsibility

The owning backend must:

- load current non-deleted actor state;
- verify tenant lifecycle and session version;
- verify module subscription/feature and seat;
- evaluate permission and organization/resource scope;
- resolve the tenant DataSource through the registry/router;
- include tenant/organization predicates in repository operations;
- avoid revealing another tenant's existence through unsafe errors;
- evict stale tenant connections after move/status events.

Frontend filtering is not isolation.

## Cross-application references

Core, CRM, and Trade own different tables in a shared tenant database model.
Tenant Portal must not:

- join responses locally to create an authorization decision;
- use an ID from one app in another unless a documented contract accepts it;
- fetch Core database tables through CRM/Trade or vice versa;
- assume a party/customer/account is eligible for every downstream action.

Use safe read models and explicit adapter/eligibility routes.

## Organization context

Company, branch, and channel selectors are untrusted user choices until the
backend validates them.

Requirements:

- derive available options from a scoped API;
- preserve the current context separately from permission;
- clear dependent data when context changes;
- cancel or reject stale requests from the previous context;
- include context only through the documented query/header/body field;
- handle a revoked context with `403`, not cached data.

## Caching

- Key client caches by tenant/session generation and every relevant organization
  context.
- Clear tenant data before adopting another account or host.
- Never reuse server-rendered tenant payload across hosts.
- Use `Vary`/cache controls consistent with host and authorization.
- Service workers, if added, must not cache protected API bodies by default.

## Negative tests

- valid user + another tenant host;
- valid user + another tenant resource ID;
- valid user + unauthorized company/branch/channel;
- user removed from branch while page is open;
- module seat revoked while query is cached;
- tenant moved or suspended during a request;
- two tabs logged into replacement accounts;
- stale server component/cache content requested under another host.

## Source evidence

```text
../backend/mutakamel-apps/core-app/src/common/fqdn/
../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/upstream-client.service.ts
../backend/mutakamel-apps/shared-libs/packages/database/
../backend/mutakamel-apps/{core-app,crm-app,trade-app}/src/common/
```
