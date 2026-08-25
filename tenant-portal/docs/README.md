# Tenant Portal Documentation

Last documentation verification: **2026-08-10**

This is the source-verified build guide for the standalone `tenant-portal`, the
current Tenant browser application in the split
`C:\mutakamel.ai\frontend\{admin-portal,tenant-portal,partner-portal}`
workspace. Local Tenant ingress targets this application on port `5002`.

The historically documented consolidated
`../backend/mutakamel-apps/mutakamel-web-app` workspace is absent from the
current checkout and is not a live frontend or runtime source. Any retained
reference to that path must be explicitly labelled as dated historical
replacement evidence.

Documentation describes both backend capability and intended replacement
coverage. Every page must state whether the new `tenant-portal` implementation
is live, partial, absent, or only planned.

## Start here

1. [Documentation contract](DOCUMENTATION_CONTRACT.md)
2. [Replacement scope](app/replacement-scope.md)
3. [Capability and route map](app/capability-map.md)
4. [System context](architecture/system-context.md)
5. [API and Gateway rules](api/README.md)
6. [Validation rules](validation/README.md)
7. [Security model](security/README.md)
8. [Static data](static-data.md)
9. [AI start page](ai/START_HERE.md)
10. [Examples](examples/README.md)
11. [Audit and coverage](audit/README.md)
12. [Generated tenant routes](generated/tenant-api-routes.md)

## Documentation map

| Area | Purpose |
| --- | --- |
| `app/` | Replacement boundary, feature ownership, routes, and delivery status |
| `architecture/` | Runtime boundaries and cross-application flows |
| `api/` | Core, CRM, and Trade tenant API contracts |
| `validation/` | Transport, form, query, response, and state validation |
| `security/` | Threat model, authentication, isolation, and browser rules |
| `ai/` | Compact context and implementation rules for coding agents |
| `examples/` | Safe integration and error-handling examples |
| `audit/` | Route coverage and source-verification evidence |
| `generated/` | Regenerable inventories; never hand-edit |

## Backend ownership

| Backend app | Tenant Portal responsibility |
| --- | --- |
| API Gateway | Only browser-facing API edge; canonical paths, JWT checks, transport policy, rate limits, and trusted context |
| Core | Host admission, tenant auth, identity, organization, RBAC, workspace, billing, notifications, templates, activities, subscriptions, and tenant update projections |
| CRM | Leads, profiles, opportunities, activities, pipelines, outbound email, attachments, and CRM dashboards |
| Trade | Catalogue, accounts, pricing, quotations, orders, purchasing, inventory, policy, automation, Control Tower, and Trade dashboards |
| Worker | Background provisioning, migrations, rendering, email, notifications, and scheduled effects; never called directly by Tenant Portal |
| Shared packages | Auth, database tenancy, common DTOs, broker contracts, storage, templates, logging, and other cross-cutting primitives |

## Canonical browser paths

```text
/api/tenant/core/v1/*   -> API Gateway -> Core
/api/tenant/crm/v1/*    -> API Gateway -> CRM
/api/tenant/trade/v1/*  -> API Gateway -> Trade
```

Controller-relative paths such as `/tenant/auth`, `/crm/leads`, or
`/trade/quotations` are backend implementation paths. Browser code must not
call them directly.

Public host admission is performed server-side using the Gateway-exposed Core
host-status contract and the original request host. Unknown or unverified hosts
must fail before tenant UI renders.

## API references

### Core

- [Authentication](api/auth.md)
- [Tenant host admission](api/tenant-host.md)
- [Organization](api/organization.md)
- [Users and directory](api/users.md)
- [Roles](api/roles.md)
- [User modules and seats](api/user-modules.md)
- [Billing and subscriptions](api/billing.md)
- [Workspace settings](api/settings.md)
- [Notifications](api/notifications.md)
- [Templates](api/templates.md)
- [Activities](api/activities.md)

Additional Core pages are listed in [API index](api/README.md).

### CRM

- [CRM index](api/crm/README.md)

### Trade

- [Trade index](api/trade/README.md)

## Cross-cutting references

- [DTO conventions](dtos.md)
- [RBAC matrix](rbac-matrix.md)
- [Static data and enums](static-data.md)
- [Error handling](validation/error-handling.md)
- [API examples](examples/api-requests.md)

## Source roots

Backend source is read-only for this frontend project. Paths below are relative
to `C:\mutakamel.ai\frontend`:

```text
../backend/mutakamel-apps/api-gateway-app
../backend/mutakamel-apps/core-app
../backend/mutakamel-apps/crm-app
../backend/mutakamel-apps/trade-app
../backend/mutakamel-apps/worker-app
../backend/mutakamel-apps/shared-libs
```

Historical only and absent from the current checkout:

```text
../backend/mutakamel-apps/mutakamel-web-app
```

When source and prose disagree, follow
[DOCUMENTATION_CONTRACT.md](DOCUMENTATION_CONTRACT.md) and correct the prose.
