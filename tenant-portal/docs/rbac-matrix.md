# Tenant Portal RBAC Matrix

The Tenant Portal uses a robust Role-Based Access Control (RBAC) system. Permissions are strictly scoped to the tenant workspace and, in some cases, further scoped to specific branches or companies (via assignments).

This matrix summarizes the key permissions used across the Tenant Portal APIs.

## Core System & Settings

| Permission | Description |
| :--- | :--- |
| `workspace.read` | View global workspace settings (language, timezone, toggles). |
| `workspace.manage` | Update global workspace settings. |
| `workspace.email.read` | View custom SMTP settings. |
| `workspace.email.manage` | Update custom SMTP settings and verify connections. |
| `branding.read` | View tenant custom branding configurations. |
| `branding.manage` | Update tenant branding colors, logos, and UI strings. |
| `numbering.read` | View numbering sequences and simulate next values. |
| `numbering.manage` | Create or update document numbering sequences. |

## Billing & Finance

*Note: Most Billing and Subscription endpoints are strictly guarded by `TenantOwnerGuard` and do not rely on standard RBAC permissions.*

| Permission | Description |
| :--- | :--- |
| `taxes.tax.read` | List and view tax rates. |
| `taxes.tax.manage` | Create, update, or deactivate tax rates. |
| `currencies.currency.read` | List and view active currencies. |
| `currencies.currency.manage` | Create, update, deactivate, or set default currencies. |

## Users & Roles

| Permission | Description |
| :--- | :--- |
| `users.user.read` | List and view tenant users and directory profiles. |
| `users.user.invite` | Invite new users to the tenant workspace. |
| `users.user.update` | Update user settings, language preferences, and profiles. |
| `users.user.deactivate` | Deactivate active users. |
| `users.user.delete` | Soft-delete users. |
| `users.user.manage_memberships` | Add or remove users from departments and teams. |
| `users.user.assign_roles` | Assign custom or system roles to users for specific branches. |
| `roles.permission.read` | View the catalog of available permissions. |
| `roles.role.read` | List and view custom roles. |
| `roles.role.create` | Create new custom roles. |
| `roles.role.update` | Update custom roles and their assigned permissions. |
| `roles.role.delete` | Delete custom roles. |
| `users.user.manage_modules` | Assign or unassign licensed user modules. |

## Templates & Documents

| Permission | Description |
| :--- | :--- |
| `templates.read` | List, search, and view templates, data sources, and assets. |
| `templates.create` | Create templates, duplicate templates, and use starters. |
| `templates.update` | Edit template drafts and restore snapshots. |
| `templates.publish` | Publish drafts to new versions and retire old versions. |
| `templates.restore` | Restore previous versions of a template. |
| `templates.archive` | Archive or permanently delete templates. |
| `templates.preview` | Generate HTML, Email, or PDF previews of templates. |
| `templates.assets.manage` | Upload and delete template graphical assets. |
| `templates.assignments.manage` | Link templates to system events and resolve issues. |

## Business Letters

| Permission | Description |
| :--- | :--- |
| `business_letters.read` | List and view business letters and their PDF jobs. |
| `business_letters.create` | Create new business letter drafts. |
| `business_letters.update` | Edit business letter drafts. |
| `business_letters.issue` | Issue letters to make them final/read-only. |
| `business_letters.render` | Render business letters to PDF. |

## Activities

| Permission | Description |
| :--- | :--- |
| `activities.read` | List and view activities and activity types. |
| `activities.create` | Create new tasks or log entries. |
| `activities.update` | Update activity details. |
| `activities.assign` | Reassign activities to other users or teams. |
| `activities.complete` | Mark activities as completed. |
| `activities.cancel` | Cancel activities. |

## Notifications

| Permission | Description |
| :--- | :--- |
| `notifications.notification.read` | View inbox, mark as read, acknowledge, and dismiss. |
| `notifications.preference.read` | View notification delivery preferences. |
| `notifications.preference.manage` | Update delivery channels (email, push, in-app). |
| `notifications.device_token.manage` | Register or revoke push notification device tokens. |

## CRM

| Permission | Description |
| :--- | :--- |
| `crm.leads.read.*` | Read and view CRM leads within scope. |
| `crm.leads.create.*` | Create new leads within scope. |
| `crm.leads.update.*` | Update leads, change stages within scope. |
| `crm.leads.convert.*` | Convert qualified leads to profiles and opportunities. |
| `crm.leads.delete.*` | Delete leads. |
| `crm.opportunities.read.*` | Read and view CRM opportunities within scope. |
| `crm.opportunities.create.*` | Create new opportunities. |
| `crm.opportunities.update.*` | Update opportunities, change stages. |
| `crm.opportunities.delete.*` | Delete opportunities. |
| `crm.customer_profiles.read.*` | Read customer profiles. |
| `crm.customer_profiles.create.*` | Create customer profiles. |
| `crm.customer_profiles.update.*` | Update profiles and contacts. |
| `crm.customer_profiles.delete.*` | Delete profiles. |
| `crm.pipelines.read` | View pipeline configurations. |
| `crm.pipelines.manage` | Manage pipelines, stages, and assignments. |
| `crm.lead_stages.read` | View lead stage definitions. |
| `crm.lead_stages.manage` | Create, update, or reorder lead stages. |
| `crm.acquisition_sources.read` | View acquisition sources. |
| `crm.acquisition_sources.manage` | Manage acquisition sources. |
| `crm.settings.read` | Read CRM global settings. |
| `crm.settings.manage` | Update CRM limits and duplication rules. |
| `crm.custom_fields.read` | View custom field definitions and values. |
| `crm.custom_fields.manage` | Manage custom field definitions and upsert values. |
| `crm.notes.*` | Read, create, update, or delete CRM notes. |
| `crm.attachments.*` | Read, create, or delete CRM file attachments. |
| `crm.email.send.*` | Send and retry outbound CRM emails. |
| `crm.dashboards.read.*` | View CRM executive and performance dashboards. |

## Trade

| Permission | Description |
| :--- | :--- |
| `trade.catalog_master.manage.*` | Manage master items and global configurations. |
| `trade.item.read.*` | View catalog items, uoms, and channels. |
| `trade.item.manage.*` | Manage items overlays, profiles, and channel listings. |
| `trade.commercial_account.read.*` | View trade commercial accounts. |
| `trade.commercial_account.manage.*` | Manage trade accounts and branch rules. |
| `trade.credit.view.*` | Evaluate account credit availability. |
| `trade.quotation.read.*` | View sales quotations. |
| `trade.quotation.create.*` | Create draft quotations. |
| `trade.quotation.update.*` | Update quotations and create revisions. |
| `trade.quotation.send.*` | Mark quotations as sent. |
| `trade.quotation.accept.*` | Mark quotations as accepted. |
| `trade.quotation.reject.*` | Mark quotations as rejected. |
| `trade.quotation.cancel.*` | Cancel quotations. |
| `trade.quotation.convert.*` | Convert accepted quotations to sales orders. |
| `trade.sales_order.read.*` | View sales orders. |
| `trade.sales_order.create.*` | Create sales orders. |
| `trade.sales_order.update.*` | Update sales orders. |
| `trade.sales_order.confirm.*` | Confirm sales orders and trigger inventory reservations. |
| `trade.sales_order.hold.*` | Put sales orders on hold or release hold. |
| `trade.sales_order.cancel.*` | Cancel sales orders. |
| `trade.inventory.read.*` | Read inventory stock. |
| `trade.inventory.reserve.*` | Create or remove inventory reservations. |
| `trade.pricing.read.*` | Evaluate final pricing. |
| `trade.pricing.lock.*` | Acquire price locks for checkout. |
| `trade.invoice.*` | Read, create, update, and issue invoices. |
| `trade.contract.*` | Read, create, update, and activate legal contracts. |
| `trade.purchase_order.*` | Lifecycle management for B2B procurement (read, create, submit, approve, confirm, cancel). |
| `trade.purchase_quotation.*` | Lifecycle management for RFQs (read, create, update, issue). |
| `trade.policy.*` | Govern rules, discounts, and workflows (read, manage, test, approve, publish). |
| `trade.control_tower.*` | Oversee system anomalies (read, retry, resolve exceptions). |
| `trade.extension.*` | Manage tenant extension profiles and targets (read, manage, publish). |
| `trade.import.*` | Define import schemas and execute bulk data imports. |
| `trade.webhook.*` | Subscribe to real-time events and manage delivery replays. |
| `trade.dashboard.*` | Create, read, update, or share custom analytics dashboards. |
| `trade.widget.*` | Create, read, update, or share custom analytics widgets. |
| `trade.configuration.*` | Manage and resolve scoped system configurations. |
| `trade.document_profile.*` | Manage B2B document layouts, rules, and numbering sequences. |
