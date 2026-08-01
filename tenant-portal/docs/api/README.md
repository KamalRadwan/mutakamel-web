# Tenant API Index

Status: **verified-current index**

Last source verification: **2026-07-25**

Owners: **API Gateway, Core, CRM, Trade**

Tenant Portal implementation: **not-started**

Authoring mode: **hand-written index plus generated route evidence**

## Boundary

The browser calls the API Gateway on the current tenant origin:

```text
/api/tenant/core/v1/*
/api/tenant/crm/v1/*
/api/tenant/trade/v1/*
```

It never calls Core, CRM, Trade, Worker, RabbitMQ, a database, or object storage
directly. Controller-relative `/api/v1/*` paths in domain pages explain
upstream ownership only and must not be copied into Portal request code.

## Current route inventory

| App | Tenant-master Gateway routes | Portal usage |
| --- | ---: | --- |
| Core | 198 | 196 Portal routes plus two explicitly marked platform/integration `DO_NOT_CALL` routes |
| CRM | 137 | Tenant Portal |
| Trade | 226 | Tenant Portal |
| **Total** | **561** | **559 Tenant Portal APIs** |

The exhaustive method/path/policy table is generated:

- [Human-readable route table](../generated/tenant-api-routes.md)
- [Machine-readable route data](../generated/tenant-api-routes.json)

Core's public FQDN validation endpoint and payment-provider webhook are routed
under the tenant master, so they remain in the inventory. They are not Tenant
Portal feature APIs and must not be invoked by application code.

## Source precedence

For every route:

1. Gateway typed route entry proves exposure, canonical mapping, route class,
   idempotency, transport limits, and declared edge permissions.
2. Owning controller and global/module guards prove upstream path, actor,
   permission, and scope enforcement.
3. DTOs, transforms, enums, services, response mappings, and tests prove input,
   output, state, errors, and concurrency behavior.
4. The old frontend proves only existing request sequencing and replacement
   breadth.

See [Documentation contract](../DOCUMENTATION_CONTRACT.md).

## Core API guides

| Capability | Guide |
| --- | --- |
| Tenant auth and session | [Authentication](auth.md) |
| Host admission and public platform validation | [Tenant host](tenant-host.md) |
| Companies, branches, departments, teams | [Organization](organization.md) |
| Tenant users, profile, webphone, memberships | [Users](users.md) |
| Party directory | [Directory](directory.md) |
| Roles, permissions, scope assignments | [Roles](roles.md) |
| Per-user module seats | [User modules](user-modules.md) |
| Workspace, branding, and tenant email | [Settings](settings.md) |
| Currencies, taxes, and numbering | [Finance configuration](finance-configuration.md) |
| Subscription and invoices | [Billing](billing.md) |
| Wallet, top-up, payment history, external webhook boundary | [Payments and wallet](payments-wallet.md) |
| Notifications, preferences, device tokens | [Notifications](notifications.md) |
| Cross-domain activities | [Activities](activities.md) |
| Governed templates, assets, assignments, preview | [Templates](templates.md) |
| Immutable letters and PDF jobs | [Business letters](business-letters.md) |
| Tenant component update operations | [Provisioning updates](provisioning-updates.md) |
| Signed downloads | [Files](files.md) |

## CRM API guides

[CRM API index](crm/README.md) maps all 137 current CRM Gateway routes,
own/team/all permissions, branch rules, DTO validation, static data, examples,
and five controller-only gaps that are not browser contracts.

## Trade API guides

[Trade API index](trade/README.md) maps all 226 current Trade Gateway routes,
company/branch/channel scope, permission and feature gates, command
idempotency, concurrency, static data, validation, security, examples, and
async operation ownership.

## Verified reachability gaps

- Core business-letter listing is controller-implemented but missing from
  Gateway; see [Business letters](business-letters.md).
- Two Gateway template production-readiness entries have no Core handlers; see
  [Templates](templates.md).
- Five old-web-used CRM controller routes have no Gateway entry; see the
  [CRM gap table](crm/README.md#known-gateway-gaps).
- Four Trade UOM CRUD controller routes are unrouted; only the catalogue read
  is public; see the [Trade index](trade/README.md).

Do not synthesize canonical URLs for controller-only routes or bypass Gateway.

## Route classes

| Gateway class | Portal interpretation |
| --- | --- |
| `PUBLIC` | No tenant access token at the edge; route-specific host, token, signature, or external-callback validation can still apply |
| `AUTHENTICATED` | Valid current tenant session required |
| `READ_HEAVY` | Authenticated read-like operation with stricter cost/rate/timeout policy |
| `WRITE_SENSITIVE` | Authenticated command with explicit replay, idempotency, size, timeout, and scope policy from the route contract |

`PUBLIC` never means safe to call without reading the route guide.

## Shared request rules

- Let the shared client own bearer/session behavior, correlation IDs, language,
  retry classification, and response normalization.
- Never set trusted tenant, actor, permission, scope, service, internal secret,
  or forwarded-host headers from feature code.
- Preserve exact UUIDv7 idempotency keys for exact retries.
- Preserve ETags, versions, checksums, cursors, and command evidence as opaque
  values.
- Use decimal strings for money, quantity, rates, totals, and other exact
  numeric contracts.
- Do not send tenant IDs when the route derives tenant from verified context.
- Do not treat an unknown enum, `403`, `409`, `423`, `429`, or `503` as an empty
  success.

See [DTO contract](../dtos.md), [Validation](../validation/README.md),
[Authorization catalogue](../rbac-matrix.md), and
[Security](../security/README.md).

## Shared response rules

| App | Ordinary JSON success | Application error |
| --- | --- | --- |
| Core | Envelope with `success`, `data`, optional top-level `meta`, correlation ID, timestamp | Shared error envelope |
| CRM | Raw controller/service projection; page fields remain in the page object | Shared error envelope |
| Trade | Envelope with `success`, `data`, correlation ID, timestamp; pagination remains under `data` | Trade/Nest exception body, commonly with `code` and `message` |

Gateway-originated and upstream-transport failures use Problem Details. The
Gateway otherwise passes through the owner app's status, headers, and body.
Streams, `204`, redirects, and signed downloads are documented exceptions.

## Drift checks

From `tenant-portal`:

```powershell
npm run docs:routes
npm run docs:check
```

The check fails when the generated Gateway inventory is stale, an API route is
missing from hand-written API documentation, required metadata is absent, or a
local Markdown link is broken.
