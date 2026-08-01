# Tenant Portal Replacement Scope

Status: **Approved target**

Last verified: **2026-07-25**

Frontend status: **Not started beyond the bootstrap shell**

## Decision

`tenant-portal` will replace all tenant-facing application behavior currently
hosted in `../backend/mutakamel-apps/mutakamel-web-app`.

The replacement does not include:

- platform-admin routes or admin authentication;
- partner routes;
- backend service changes;
- visual design specifications;
- unimplemented future modules presented as current behavior.

## Replacement source inventory

The old web application is inspected for migration coverage in:

```text
../backend/mutakamel-apps/mutakamel-web-app/src/app
../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth
../backend/mutakamel-apps/mutakamel-web-app/e2e
```

It provides evidence for routes, request sequencing, state handling, and tests.
It does not override Gateway or backend contracts.

## Capabilities to replace

### Foundation

- database-backed tenant host admission before rendering;
- tenant login, refresh, logout, logout-all, invitation acceptance, forgot and
  reset password;
- generation-safe browser session handling;
- current-user profile, permissions, organization scope, module seats, and
  entitlements;
- workspace settings and tenant branding;
- tenant shell capability and route admission.

### Core workspace

- tenant dashboard;
- organization, company, branch, department, and team management;
- party directory and tenant-user administration;
- roles, permissions, assignments, and module seats;
- workspace, branding, numbering, currency, tax, and email settings;
- subscriptions, invoices, payments, wallet history, and update discovery;
- notifications and preferences;
- activities;
- templates and business letters.

### CRM

- CRM home and dashboards;
- leads, customer profiles, opportunities, pipelines, and stages;
- acquisition sources;
- activities, tasks, calendar/reminders, notes, attachments, and outbound
  email;
- CRM configuration and dashboard/widget management.

### Trade

- Trade home and dashboards;
- catalogue and units of measure;
- commercial accounts;
- price books, pricing, and promotions;
- quotations and sales orders;
- purchase quotations and purchase orders;
- inventory and reservation flows;
- document profiles, workflow/policy publishing, extensions, imports,
  automation, and Control Tower recovery.

## Route compatibility

Existing user-facing URLs should be retained when they remain canonical and
useful. A changed route must have an explicit redirect or migration decision.
Do not preserve compatibility-only API paths in new clients.

The old `/sales/*` page is already a legacy redirect. New tenant functionality
uses `/trade/*`.

## Migration states

Track every capability with these independent fields:

| Field | Values |
| --- | --- |
| Backend | `implemented`, `partial`, `planned`, `deprecated`, `unknown` |
| Gateway | `exposed`, `internal-only`, `missing`, `deprecated` |
| Old web | `live`, `partial`, `mock`, `absent` |
| New portal | `not-started`, `partial`, `live`, `tested` |
| Documentation | `verified-current`, `partial`, `stale`, `planned` |

No feature is replacement-complete until the new portal is server-backed,
tested, and independently deployable.

## Cutover gates

- Host admission fails closed for unknown tenant domains.
- Active and suspended tenant login behavior matches Core policy.
- Authentication replacement includes refresh races, logout propagation, and
  stale-generation rejection.
- Every migrated page uses canonical Gateway paths.
- Permissions, module seats, subscriptions, and organization scope are
  enforced by the backend and reflected in the client.
- All live old-web routes are either replaced or intentionally redirected.
- No frontend mock or local-only mutation is reported as production behavior.
- Unit, integration, browser, accessibility, and failure-state checks pass for
  the migrated scope.
- Rollback can direct traffic back to the previous web application until the
  cutover is accepted.

## Backend edit boundary

This frontend repository may read backend source for verification but must not
modify any file under `../backend`. Backend gaps are recorded in documentation
and handled in a separately authorized backend task.
