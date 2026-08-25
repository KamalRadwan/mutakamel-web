# Tenant Portal Authorization and Permission Catalogue

Status: **verified-current**

Last source verification: **2026-08-10**

Owning apps: **Core, CRM, Trade**

Tenant Portal implementation: **partial source; capability-specific runtime proof open**

Authoring mode: **hand-written from current permission catalogues and guards**

## Authorization is multi-dimensional

A permission string alone never proves access. A tenant request can also be
rejected by:

- tenant-host and token-tenant mismatch;
- session generation or user status;
- company, branch, channel, inventory-node, own/team/all, or assignment scope;
- product module, feature, seat, or subscription access mode;
- tenant-owner-only policy;
- resource ownership or domain-state policy;
- rate, transport, and write-sensitivity policy at the Gateway.

Use permissions to control navigation and affordances, but treat `403` from the
server as authoritative. Never hide data only in the browser, and never send
trusted tenant/scope headers from feature code.

## Guard order

The current high-level order is:

| App | Global authorization chain |
| --- | --- |
| Core | JWT, FQDN tenant, active `sid` plus four exact Auth epochs, permission, branch access, subscription enforcement, rate limit |
| CRM | JWT, trusted Gateway tenant, current tenant user/CRM seat, permission, branch plus own/team/all access, subscription, rate limit |
| Trade | JWT, trusted Gateway tenant, current user/Trade seat, subscription, company/branch/channel scope, permission, rate limit |

Route and module guards can add constraints. A route with no permission
decorator is not automatically public.

## Core permission catalogue

Core seeds the following exact tenant permission keys.

### Organization

```text
org.company.read
org.company.manage
org.branch.read
org.branch.manage
org.department.read
org.department.manage
org.team.read
org.team.manage
```

### Users, roles, and permissions

```text
users.user.read
users.user.invite
users.user.update
users.user.assign_roles
users.user.manage_memberships
users.user.deactivate
users.user.delete

roles.role.read
roles.role.create
roles.role.update
roles.role.delete
roles.permission.read
```

### Workspace and finance configuration

```text
branding.read
branding.manage
currencies.currency.read
currencies.currency.manage
numbering.read
numbering.manage
taxes.tax.read
taxes.tax.manage
workspace.read
workspace.manage
workspace.email.read
workspace.email.manage
```

### Directory

```text
directory.party.read
directory.party.manage
directory.contact.manage
directory.address.manage
directory.role.manage
directory.relationship.manage
directory.settings.manage
```

### Notifications

```text
notifications.notification.read
notifications.preference.read
notifications.preference.manage
notifications.device_token.manage
```

### Template platform

```text
templates.read
templates.create
templates.update
templates.archive
templates.assets.manage
templates.publish
templates.restore
templates.assignments.manage
templates.preview
templates.render
```

### Business letters

```text
business_letters.read
business_letters.create
business_letters.update
business_letters.issue
business_letters.render
```

### Activities

```text
activities.read
activities.read.all
activities.create
activities.update
activities.update.all
activities.complete
activities.complete.all
activities.cancel
activities.cancel.all
activities.assign
```

The `.all` activity variants expand access inside an already-authorized
branch. They do not grant cross-tenant or arbitrary branch access.

### Core scope-role targets

Role assignments can target:

```text
TENANT
COMPANY
BRANCH
```

The assignment target and the user's current branch context must both be
considered. Do not flatten branch-scoped role assignments into one global
frontend boolean.

## CRM permission catalogue

CRM has static permissions and scoped permissions.

### Static CRM permissions

```text
crm.settings.read
crm.settings.update
crm.settings.manage
crm.lead_stages.read
crm.lead_stages.manage
crm.acquisition_sources.read
crm.acquisition_sources.manage
crm.pipelines.read
crm.pipelines.manage
crm.custom_fields.read
crm.custom_fields.manage
crm.dashboards.create
crm.dashboards.update
crm.dashboards.delete
crm.dashboards.share
crm.widgets.read
crm.widgets.create
crm.widgets.update
crm.widgets.delete
crm.widgets.share
```

`crm.settings.update` and `crm.settings.manage` are distinct current keys.
Do not collapse or rename them.

### Scoped CRM permission bases

Each base below is expanded with exactly one lowercase suffix:

```text
own
team
all
```

For example, `crm.leads.read.team` is valid;
`crm.leads.read.TEAM` and the unsuffixed `crm.leads.read` are not catalogue
entries.

```text
crm.customer_profiles.read
crm.customer_profiles.create
crm.customer_profiles.update
crm.customer_profiles.delete
crm.leads.read
crm.leads.create
crm.leads.update
crm.leads.convert
crm.leads.delete
crm.opportunities.read
crm.opportunities.create
crm.opportunities.update
crm.opportunities.delete
crm.activities.read
crm.activities.create
crm.activities.update
crm.activities.delete
crm.notes.read
crm.notes.create
crm.notes.update
crm.notes.delete
crm.attachments.read
crm.attachments.create
crm.attachments.delete
crm.dashboards.read
crm.email.send
```

The permission suffix is evaluated together with branch access and the
record's assignee/team rules. Having `.all` does not remove branch constraints.

## Trade permission catalogue

Trade permissions are not suffixed with `.own`, `.team`, or `.all`. The Trade
scope guards independently enforce authorized company, branch, channel, and
other operating context.

### Configuration, catalogue, accounts, credit, and pricing

```text
trade.configuration.read
trade.configuration.manage
trade.catalog_master.manage
trade.items.read
trade.items.manage
trade.commercial_accounts.read
trade.commercial_accounts.manage
trade.credit.view
trade.credit.override
trade.pricing.read
trade.pricing.manage
trade.pricing.view_cost
trade.pricing.override
```

### Policy, document profiles, extensions, and automation

```text
trade.policy.read
trade.policy.manage
trade.policy.test
trade.policy.approve
trade.policy.publish
trade.policy.view_sensitive_facts
trade.document_profiles.read
trade.document_profiles.manage
trade.document_profiles.validate
trade.document_profiles.publish
trade.extensions.read
trade.extensions.manage
trade.extensions.publish
trade.import.manage
trade.import.execute
trade.webhooks.manage
trade.webhooks.replay
trade.automation.manage
```

### Quotations and sales orders

```text
trade.quotations.create
trade.quotations.read
trade.quotations.update
trade.quotations.send
trade.quotations.accept
trade.quotations.reject
trade.quotations.cancel
trade.quotations.convert
trade.sales_orders.create
trade.sales_orders.read
trade.sales_orders.update
trade.sales_orders.confirm
trade.sales_orders.hold
trade.sales_orders.cancel
trade.sales_orders.amend
```

### Purchasing and financial documents

```text
trade.purchase_orders.create
trade.purchase_orders.read
trade.purchase_orders.update
trade.purchase_orders.submit
trade.purchase_orders.approve
trade.purchase_orders.confirm
trade.purchase_orders.cancel
trade.purchase_quotations.create
trade.purchase_quotations.read
trade.purchase_quotations.update
trade.purchase_quotations.issue
trade.invoices.create
trade.invoices.read
trade.invoices.update
trade.invoices.issue
trade.contracts.create
trade.contracts.read
trade.contracts.update
trade.contracts.activate
trade.purchasing.override
```

### Inventory and Control Tower

```text
trade.inventory.read
trade.inventory.view_cost
trade.inventory.nodes.manage
trade.inventory.opening_balance
trade.inventory.reserve
trade.inventory.receive
trade.inventory.deliver
trade.inventory.adjust
trade.inventory.governance.manage
trade.control_tower.read
trade.control_tower.retry
trade.control_tower.resolve
trade.control_tower.view_sensitive
```

### Dashboards and widgets

```text
trade.dashboards.read
trade.dashboards.create
trade.dashboards.update
trade.dashboards.delete
trade.dashboards.share
trade.widgets.read
trade.widgets.create
trade.widgets.update
trade.widgets.delete
trade.widgets.share
```

## Feature and seat gates

Permissions, features, and seats answer different questions:

| Gate | Question |
| --- | --- |
| Permission | May this user perform this action? |
| Scope | On which company, branch, team, channel, node, or record? |
| Seat/module assignment | Is this user assigned to the application module? |
| Tenant subscription/feature | Has the tenant purchased and activated the capability? |
| Access mode | Are reads/writes currently permitted under billing state? |

The UI must compute an affordance only from the complete server projection,
when available. Never grant access because a permission name exists in the
static catalogue.

## Frontend implementation pattern

Centralize authorization queries and preserve an explicit scope:

```ts
type CapabilityDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "permission"
        | "scope"
        | "seat"
        | "feature"
        | "access-mode"
        | "state";
    };
```

This type is for presentation only. The server must repeat every check.

## Source evidence

```text
../backend/mutakamel-apps/core-app/packages/database/src/seeds/v0.0.1/tenant/permissions.seed.ts
../backend/mutakamel-apps/core-app/src/tenant/tenant-roles/
../backend/mutakamel-apps/core-app/src/common/guards/
../backend/mutakamel-apps/crm-app/packages/common/src/constants/permissions.ts
../backend/mutakamel-apps/crm-app/src/common/guards/
../backend/mutakamel-apps/crm-app/src/crm/static-data/
../backend/mutakamel-apps/trade-app/packages/common/src/constants/permissions.ts
../backend/mutakamel-apps/trade-app/src/common/guards/
../backend/mutakamel-apps/trade-app/src/common/entitlement.service.ts
```

Route-specific requirements are documented under [API](api/README.md).
