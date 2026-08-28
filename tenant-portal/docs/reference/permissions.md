# Permissions

Status: **verified**

Last source verification: **2026-08-27**

Source: `../backend/mutakamel-apps/crm-app/node_modules/@mutakamel/crm-app-common/dist/constants/permissions.d.ts`
(package `0.0.1`), plus `@RequirePermissions` decorators on the owning
controllers.

## Two shapes

### Static permissions — exact match

The user either holds the exact string or does not.

```text
crm.settings.read              crm.settings.update            crm.settings.manage
crm.lead_stages.read           crm.lead_stages.manage
crm.acquisition_sources.read   crm.acquisition_sources.manage
crm.pipelines.read             crm.pipelines.manage
crm.custom_fields.read         crm.custom_fields.manage
crm.dashboards.create          crm.dashboards.update          crm.dashboards.delete
crm.dashboards.share
crm.widgets.read               crm.widgets.create             crm.widgets.update
crm.widgets.delete             crm.widgets.share
```

**Existing in the catalogue is not the same as guarding a route.**
`crm.settings.update` is declared here but does **not** guard
`PUT /api/tenant/crm/v1/settings` — that route requires `crm.settings.manage`.
A user holding only `crm.settings.update` cannot save settings. Always read the
controller's `@RequirePermissions` rather than assuming the `.update` variant
guards the write; `pnpm docs:audit-api` checks this mechanically.

### Scoped permissions — base plus scope

Scopes: **`own`**, **`team`**, **`all`**.

A user holding `crm.leads.read.team` satisfies a `crm.leads.read` requirement.
The scope determines **which records** are visible, enforced server-side.

Bases:

```text
crm.customer_profiles.read     crm.customer_profiles.create
crm.customer_profiles.update   crm.customer_profiles.delete
crm.leads.read                 crm.leads.create
crm.leads.update               crm.leads.convert              crm.leads.delete
crm.opportunities.read         crm.opportunities.create
crm.opportunities.update       crm.opportunities.delete
crm.activities.read            crm.activities.create
crm.activities.update          crm.activities.delete
crm.notes.read                 crm.notes.create
crm.notes.update               crm.notes.delete
crm.attachments.read           crm.attachments.create         crm.attachments.delete
crm.dashboards.read
crm.email.send
```

Each base yields three real permission strings — `crm.leads.read.own`,
`crm.leads.read.team`, `crm.leads.read.all`.

## Matching, in code

`lib/navigation/tenant-routes.ts` already implements this correctly and is
carried over unchanged:

```ts
const CRM_READ_SCOPES = ["own", "team", "all"] as const;

const satisfied =
  permissions.includes(required) ||
  (acceptsScopedPermission &&
    CRM_READ_SCOPES.some((scope) => permissions.includes(`${required}.${scope}`)));
```

Two rules that are easy to get wrong:

- **Permission pairs use ALL semantics** unless a route explicitly declares
  ANY. Leads needs `crm.leads.read` **and** `crm.lead_stages.read` — a user
  with only the first cannot render the board, because the board's column axis
  is the stage catalogue.
- **A scoped permission is not a prefix match.** `crm.leads.read.evil` must not
  satisfy `crm.leads.read`. Match the exact base or base + one of the three
  known scopes. There are tests asserting this; keep them.

## Route requirements

| Route | Requires |
| --- | --- |
| `/crm/leads` | `crm.leads.read` (scoped) **and** `crm.lead_stages.read` |
| `/crm/customer-profiles` | `crm.customer_profiles.read` (scoped) |
| `/crm/opportunities` | `crm.opportunities.read` (scoped) **and** `crm.pipelines.read` |
| `/crm/lead-stages` | `crm.lead_stages.read` |
| `/crm/acquisition-sources` | `crm.acquisition_sources.read` |
| `/crm/custom-fields` | `crm.custom_fields.read` |
| `/crm/settings` | `crm.settings.read` |
| `/crm/static-data-catalogue` | `crm.settings.read` |
| `/core/authentication` | authenticated only |

## Capabilities outrank permission strings

For **action** visibility inside a screen, use the capabilities endpoint, not
the permission list:

```text
GET /api/tenant/crm/v1/leads/capabilities?branchId=…
GET /api/tenant/crm/v1/customer-profiles/capabilities?branchId=…
GET /api/tenant/crm/v1/opportunities/capabilities?branchId=…
```

Capabilities already account for branch membership **and** the owner boundary.
A permission string cannot tell you that a user with
`crm.leads.update.own` may edit *this particular* record; capabilities can, via
`ownerUserIds`.

Use permission strings for **route** admission, capabilities for **action**
admission. See [../api/README.md](../api/README.md#capabilities-endpoints).

## Client-side checks are advisory

Hiding a control improves the experience. It is **not** authorization — the
backend re-validates every request, and `403` is a real, expected response that
must be handled properly rather than assumed impossible.

**`403` is not an empty state.** Render `PermissionGate`, not `EmptyState` —
see [../design/patterns.md](../design/patterns.md#permissiongate).

## Never

- Never persist a permission decision across loads. Re-derive from `/auth/me`.
- Never translate a permission string. They are protocol.
- Never invent one. If it is not in the lists above, it does not exist.
- Never treat an owner filter (`ownerUserId`) as an access grant. It narrows
  results; it does not widen them.

## Core tenant permissions

**64 permissions across 14 groups**, extracted from `@RequirePermissions`
decorators on `core-app/src/tenant/**/*.controller.ts` (2026-08-28).

There is **no packaged catalogue** for these — unlike CRM, `@mutakamel/core-app-contracts`
carries events and provisioning constants but no permission list. The
controllers are the only source.

Core uses a `group.resource.action` shape (three segments) where CRM uses
`crm.resource.action`. Core permissions have **no `own`/`team`/`all` scope
suffixes — do not apply CRM's scope-matching logic to them.**

| Group | Permissions |
| --- | --- |
| `activities` | `activities.assign` · `activities.cancel` · `activities.complete` · `activities.create` · `activities.read` · `activities.update` |
| `audit` | `audit.read` |
| `branding` | `branding.manage` · `branding.read` |
| `currencies` | `currencies.currency.manage` · `currencies.currency.read` |
| `directory` | `directory.address.manage` · `directory.contact.manage` · `directory.party.manage` · `directory.party.read` · `directory.relationship.manage` · `directory.role.manage` · `directory.settings.manage` |
| `notifications` | `notifications.notification.read` · `notifications.preference.read` · `notifications.preference.manage` · `notifications.device_token.manage` |
| `numbering` | `numbering.manage` · `numbering.read` |
| `org` | `org.branch.manage` · `org.branch.read` · `org.company.manage` · `org.company.read` · `org.department.manage` · `org.department.read` · `org.team.manage` · `org.team.read` |
| `roles` | `roles.permission.read` · `roles.role.create` · `roles.role.delete` · `roles.role.read` · `roles.role.update` |
| `taxes` | `taxes.tax.manage` · `taxes.tax.read` |
| `templates` | `templates.archive` · `templates.assets.manage` · `templates.assignments.manage` · `templates.create` · `templates.preview` · `templates.publish` · `templates.read` · `templates.restore` · `templates.update` |
| `users` | `users.user.assign_roles` · `users.user.deactivate` · `users.user.delete` · `users.user.invite` · `users.user.manage_memberships` · `users.user.read` · `users.user.update` |
| `workspace` | `workspace.email.manage` · `workspace.email.read` · `workspace.manage` · `workspace.read` |
| `admin` | `admin.billing.critical` · `admin.billing.reconcile` · `admin.invoices.read` · `admin.wallet.manage` · `admin.wallet.read` |

**The `admin.*` group is not a tenant permission set.** It guards
admin-master routes that happen to live under `core-app/src/tenant/billing/`
(`admin-tenant-billing.controller.ts`). A tenant user will never hold these.
Never gate a tenant screen on one.

### What the portal uses today

Only `notifications.notification.read` — for the topbar dropdown. Everything
else in this table belongs to a screen that is not built.

`/core/authentication` requires **no permission**; the session routes are
self-scoped, so any authenticated user manages their own sessions.

### Regenerating

```bash
grep -rhoE "@RequirePermissions\([^)]*\)" \
  ../../backend/mutakamel-apps/core-app/src/tenant --include="*.controller.ts" \
  | grep -oE "'[a-z_.]+'" | tr -d "'" | sort -u
```

## Trade permissions

Not extracted. Trade has 231 Gateway routes and **no portal screen**, so
enumerating its permissions would produce documentation that rots before it is
read. Extract from `trade-app/src/**/*.controller.ts` the same way when a Trade
screen is first built, and add a section here in the same change.
