# Permissions

Status: **verified**

Last source verification: **2026-08-31** (Trade section; CRM 2026-08-27, Core
2026-08-28)

Source: `../backend/mutakamel-apps/crm-app/node_modules/@mutakamel/crm-app-common/dist/constants/permissions.d.ts`
(package `0.0.1`), plus `@RequirePermissions` decorators on the owning
controllers. Trade comes from
`../backend/mutakamel-apps/trade-app/packages/common/src/constants/permissions.ts`
and `constants/features.ts`, plus the `@RequireTradeAccess` and
`@RequireTradeFeature` decorators.

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

**89 permissions across 23 groups**, extracted from `TRADE_PERMISSIONS` in
`../backend/mutakamel-apps/trade-app/packages/common/src/constants/permissions.ts`
and cross-checked against every `@RequireTradeAccess` decorator in
`trade-app/src/**/*.controller.ts` (2026-08-31, MASTER-PLAN 10.1).

Trade uses `trade.resource.action`, like CRM's shape and unlike Core's
`group.resource.action`. It has **no `own`/`team`/`all` scope suffixes** — do
not apply CRM's scope matching. The scope lives on the *route*, not the string;
see the model below.

| Group | Permissions |
| --- | --- |
| `configuration` | `trade.configuration.read` · `trade.configuration.manage` |
| `catalog_master` | `trade.catalog_master.manage` |
| `items` | `trade.items.read` · `trade.items.manage` |
| `commercial_accounts` | `trade.commercial_accounts.read` · `trade.commercial_accounts.manage` |
| `credit` | `trade.credit.view` · `trade.credit.override` |
| `pricing` | `trade.pricing.read` · `trade.pricing.manage` · `trade.pricing.view_cost` · `trade.pricing.override` |
| `policy` | `trade.policy.read` · `trade.policy.manage` · `trade.policy.test` · `trade.policy.approve` · `trade.policy.publish` · `trade.policy.view_sensitive_facts` |
| `document_profiles` | `trade.document_profiles.read` · `trade.document_profiles.manage` · `trade.document_profiles.validate` · `trade.document_profiles.publish` |
| `extensions` | `trade.extensions.read` · `trade.extensions.manage` · `trade.extensions.publish` |
| `import` | `trade.import.manage` · `trade.import.execute` |
| `webhooks` | `trade.webhooks.manage` · `trade.webhooks.replay` |
| `automation` | `trade.automation.manage` |
| `quotations` | `trade.quotations.create` · `trade.quotations.read` · `trade.quotations.update` · `trade.quotations.send` · `trade.quotations.accept` · `trade.quotations.reject` · `trade.quotations.cancel` · `trade.quotations.convert` |
| `sales_orders` | `trade.sales_orders.create` · `trade.sales_orders.read` · `trade.sales_orders.update` · `trade.sales_orders.confirm` · `trade.sales_orders.hold` · `trade.sales_orders.cancel` · `trade.sales_orders.amend` |
| `purchase_orders` | `trade.purchase_orders.create` · `trade.purchase_orders.read` · `trade.purchase_orders.update` · `trade.purchase_orders.submit` · `trade.purchase_orders.approve` · `trade.purchase_orders.confirm` · `trade.purchase_orders.cancel` |
| `purchase_quotations` | `trade.purchase_quotations.create` · `trade.purchase_quotations.read` · `trade.purchase_quotations.update` · `trade.purchase_quotations.issue` |
| `invoices` | `trade.invoices.create` · `trade.invoices.read` · `trade.invoices.update` · `trade.invoices.issue` |
| `contracts` | `trade.contracts.create` · `trade.contracts.read` · `trade.contracts.update` · `trade.contracts.activate` |
| `purchasing` | `trade.purchasing.override` |
| `inventory` | `trade.inventory.read` · `trade.inventory.view_cost` · `trade.inventory.nodes.manage` · `trade.inventory.opening_balance` · `trade.inventory.reserve` · `trade.inventory.receive` · `trade.inventory.deliver` · `trade.inventory.adjust` · `trade.inventory.governance.manage` |
| `control_tower` | `trade.control_tower.read` · `trade.control_tower.retry` · `trade.control_tower.resolve` · `trade.control_tower.view_sensitive` |
| `dashboards` | `trade.dashboards.read` · `trade.dashboards.create` · `trade.dashboards.update` · `trade.dashboards.delete` · `trade.dashboards.share` |
| `widgets` | `trade.widgets.read` · `trade.widgets.create` · `trade.widgets.update` · `trade.widgets.delete` · `trade.widgets.share` |

### Nine of the 89 guard no route

**80 appear on a `@RequireTradeAccess`; nine never do.** Do not build a control
that assumes holding one of these grants anything:

```text
trade.credit.override            trade.pricing.override
trade.pricing.view_cost          trade.policy.view_sensitive_facts
trade.inventory.view_cost        trade.control_tower.view_sensitive
trade.automation.manage          trade.sales_orders.amend
trade.purchasing.override
```

Four of the nine are not entirely inert: `pricing.view_cost`,
`inventory.view_cost`, `policy.view_sensitive_facts` and
`control_tower.view_sensitive` appear as **`fieldPermissions`** on dashboard
metrics in `trade-app/src/modules/dashboards/dashboard-catalog.ts`, so they
redact fields rather than admit routes. The other five guard nothing anywhere.
MASTER-PLAN 10.2 says "eight"; the route-decorator count is nine.

## The Trade authorization model

Six global guards run in `trade-app/src/common/common.module.ts`, in order, and
the first to refuse wins. Three of them decide admission, and they decide
different questions:

| Guard | Question | Refusal |
| --- | --- | --- |
| `TradeSubscriptionGuard` | is the **tenant** entitled? | 403 `TRADE.MODULE.DISABLED` · 403 `TRADE.ENTITLEMENT.FEATURE_REQUIRED` · 403 `TRADE.PROVISIONING.MAINTENANCE_ACTIVE` · 503 `TRADE.DEPENDENCY.ENTITLEMENT_UNAVAILABLE` |
| `TradeScopeGuard` | is the **operating context** well formed? | 400 `TRADE.CONTEXT.MISSING_COMPANY` / `MISSING_BRANCH` / `INVALID_ID` · 422 `BRANCH_COMPANY_MISMATCH` / `SCOPE_INACTIVE` / `EXECUTION_TARGET_MISMATCH` |
| `TradePermissionsGuard` | does the **actor** hold the grant *at that scope*? | 403 `TRADE.AUTH.TARGET_DENIED` |

### Features — eight of fifteen gate anything

`TRADE_FEATURES` lists 15. Only these eight appear in a
`@RequireTradeFeature` / `@RequireAnyTradeFeature`:

```text
trade.catalog     trade.pricing    trade.sales       trade.purchasing
trade.inventory   trade.analytics  trade.policy_studio  trade.automation
```

`trade.automation` gates only through `@RequireAnyTradeFeature(...TRADE_MVP_FEATURES)`
on `POST /configuration/resolve`. The other seven — `trade.pos`,
`trade.channels`, `trade.contracts_recurring`, `trade.intercompany`,
`trade.extension_marketplace`, `trade.control_tower_advanced`,
`trade.intelligence` — are **inert**: they exist in the catalogue and gate
nothing. Note especially that channels are gated on `trade.catalog`, not
`trade.channels`, and contracts are not feature-gated at all.

### Scope targets — the string alone never decides

Every handler declares `@RequireTradeAccess(permission, target)`, and the guard
matches the grant's `scope_target` **exactly** against the target the request
resolved to:

| Target | Resolves to | Headers |
| --- | --- | --- |
| `TENANT` | `TENANT` | none |
| `COMPANY` | `COMPANY` | company |
| `BRANCH` | `BRANCH` | company + branch |
| `COMPANY_OR_BRANCH` | branch when a branch header is present, else company | company, optionally branch |
| `OPERATING_CONTEXT` | branch → company → tenant, by what is present | all optional |
| `DASHBOARD_CONTEXT` | as `OPERATING_CONTEXT`, **and the guard returns true immediately** | all optional |

Three consequences the portal is built around:

1. **A `TENANT` grant does not satisfy a `BRANCH` route.** There is no
   widening, so no permission string can predict admission on a
   branch-targeted route.
2. **Only `tenant_users.is_tenant_owner` bypasses.** It is the first branch of
   `TradePermissionsGuard.canActivate`.
3. **`DASHBOARD_CONTEXT` routes are not permission-gated at all** — the
   declared `trade.dashboards.*` and `trade.widgets.*` strings are never
   checked by the guard.

Legacy `tenant_user_branch_roles` rows are unioned into the lookup, but **only**
when the resolved target is `BRANCH`.

### The Gateway enforces zero Trade permissions

All 231 Trade route contracts have `requiredPermissions` absent, verified by
parsing `api-gateway-app/src/routing-proxy/route-contracts/trade.route-contracts.ts`.
Every Trade permission decision happens inside trade-app, so a Trade 403 always
comes from the app and never from the edge. What the Gateway *does* enforce on
34 of the 231 is the header **shape**, through `organizationScopeMode` — a
different mechanism with a different error (`GW.REQUEST.INVALID`, 400), and on
`/uoms` the two policies disagree with each other.

### Where the portal reads them

`/auth/me` returns every seeded permission key to a tenant **owner**
(`fetchPermissionKeys` in
`core-app/src/tenant/tenant-auth/tenant-auth.service.ts` selects the whole of
`tenant_permissions` for an owner), and trade-app seeds its 89 keys into that
table through its `trade.permissions` seed pack
(`trade-app/src/database/provisioning/trade-tenant-installer.registry.ts`). So
an owner's permission array already contains the Trade strings once the module
is provisioned, and contains none of them when it is not — which is why the
Trade nav needs no owner-specific predicate.

**There is no Trade `capabilities` endpoint** (Q30), so action admission falls
back to the permission string plus `user.isTenantOwner`
(`canPerformTradeAction` in `src/app/(tenant)/trade/trade-scope.ts`). That is
advisory in a stronger sense than Core's, for reason 1 above.

### Regenerating

```bash
grep -oE "[A-Z_]+: \"trade\.[a-z_.]+\"" \
  ../../backend/mutakamel-apps/trade-app/packages/common/src/constants/permissions.ts
grep -rhoE "RequireTradeAccess\(\s*TRADE_PERMISSIONS\.[A-Z_]+" \
  ../../backend/mutakamel-apps/trade-app/src --include="*.controller.ts" | sort -u
```
