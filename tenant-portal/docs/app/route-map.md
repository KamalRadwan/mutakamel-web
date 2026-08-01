# Tenant Portal Route Map

Status: **Replacement inventory; route implementation pending**

Last verified: **2026-07-25**

This map records functional URLs to replace. It does not prescribe page
appearance.

## Public and authentication routes

| Route | Purpose | Old-web evidence |
| --- | --- | --- |
| `/login` | Tenant login and forgot-password entry | `src/app/login/page.tsx` |
| `/tenant/accept-invite` | Consume invite and set password | `src/app/tenant/accept-invite/page.tsx` |
| `/tenant/reset-password` | Consume reset token | `src/app/tenant/reset-password/page.tsx` |

Invalid tenant hosts must produce a not-found response before these pages render.
Suspended recognized tenants may reach approved pre-authentication flows and
must see suspension state without removing the administrator login form.

## Tenant foundation

| Route | Purpose | Replacement decision |
| --- | --- | --- |
| `/` | Resolve authenticated/default tenant landing | Retain |
| `/dashboard` | Tenant workspace overview | Retain |
| `/settings` | Tenant settings index | Retain |
| `/settings/updates` | Eligible component update discovery/apply | Retain |
| `/settings/billing` | Tenant-owner billing workspace | Retain |
| `/settings/billing/invoices/[invoiceId]` | Invoice detail/payment | Retain |
| `/settings/billing/payment-return` | Payment reconciliation return | Retain |
| `/settings/templates` | Template catalogue | Retain capability |
| `/settings/templates/new` | Template creation | Retain capability |
| `/settings/templates/[templateId]` | Template overview | Retain capability |
| `/settings/templates/[templateId]/design` | Template authoring runtime | Retain capability; visual design documentation excluded |

Organization, users, roles, branding, workspace settings, directory, taxes,
currencies, numbering, notifications, and activities require explicit routes
as they are implemented. Their backend capability is documented even when the
old web app did not expose a dedicated route.

## CRM routes

| Route | Purpose | Replacement decision |
| --- | --- | --- |
| `/crm` | CRM landing | Retain |
| `/crm/leads` | Lead list/create | Retain |
| `/crm/leads/[id]` | Lead detail | Retain |
| `/crm/customers` | Customer profiles | Retain |
| `/crm/customers/[id]` | Customer profile detail | Retain |
| `/crm/pipeline` | Pipeline/opportunity board | Retain |
| `/crm/pipeline/new` | Opportunity creation | Retain or normalize after route review |
| `/crm/pipeline/[id]` | Opportunity detail | Retain |
| `/crm/pipeline/[id]/edit` | Opportunity edit | Retain |
| `/crm/settings/pipelines` | Pipeline settings | Retain |
| `/crm/settings/stages` | Stage settings | Retain |
| `/crm/settings/sources` | Acquisition sources | Retain |
| `/crm/dashboards` | Dashboard list/workspace | Retain |
| `/crm/dashboards/[dashboardId]` | Dashboard detail | Retain |
| `/crm/[view]` | Compatibility/dynamic views | Replace with explicit routes or documented redirect |

Additional backend capabilities such as calendar, reminders, task lists,
attachments, outbound emails, and dashboard builder actions need explicit route
decisions before implementation.

## Trade routes

| Route | Purpose | Replacement decision |
| --- | --- | --- |
| `/trade` | Trade landing | Retain |
| `/trade/[view]` | Current consolidated Trade workspaces | Split or retain based on capability, never use as undocumented catch-all |
| `/trade/quotations/[quotationId]` | Quotation detail | Retain |
| `/trade/dashboards` | Dashboard list/workspace | Retain |
| `/trade/dashboards/[dashboardId]` | Dashboard detail | Retain |
| `/sales/[[...path]]` | Legacy Trade alias | Redirect only; do not build new features here |

Catalogue, accounts, pricing, sales orders, purchasing, inventory, policy,
automation, imports, and Control Tower require explicit stable routes during
feature implementation.

## Catch-all behavior

The old web app contains tenant and admin catch-all pages. The new portal must
not use a catch-all to conceal missing route ownership. Unknown tenant routes
should render the application not-found boundary.

## Route acceptance checklist

- Host admission runs before tenant content.
- Route audience is tenant-only.
- Required permission and module entitlement are documented.
- Direct deep-link and refresh work.
- Loading, empty, forbidden, not-found, conflict, and service-unavailable states
  are handled.
- Canonical Gateway paths are used.
- A migration redirect exists for any changed old-web URL.
- Browser tests cover public, authenticated, forbidden, and stale-session cases.
