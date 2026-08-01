# Tenant Portal Capability Map

Status: **Current planning and verification index**

Last verified: **2026-07-25**

New Tenant Portal status: **Bootstrap only**

## Purpose

This map tells developers and AI agents which backend owns a feature and where
its replacement evidence lives. It is not a visual navigation specification.

## Foundation capabilities

| Capability | Backend owner | Canonical API family | Old-web evidence | New portal |
| --- | --- | --- | --- | --- |
| Tenant host admission | Core through Gateway | Public Core host status | `src/shared/auth/tenant-host-status*` | Not started |
| Login and session | Core through Gateway | `/api/tenant/core/v1/auth/*` | `src/shared/auth/tenant-*`, `src/shared/api/tenant-api-client.ts` | Not started |
| Invitation/password actions | Core through Gateway | `/api/tenant/core/v1/auth/*` | Public auth client and tenant auth routes | Not started |
| Current identity and permissions | Core | `/api/tenant/core/v1/auth/me` | Tenant API client and dashboard | Not started |
| Branding | Core | `/api/tenant/core/v1/branding*` | Tenant login/branding behavior | Not started |
| Module/seat entitlement | Core | Core tenant user/module routes | Tenant shell and feature guards | Not started |

## Core workspace capabilities

| Capability | API documentation | New portal |
| --- | --- | --- |
| Organization | [Organization API](../api/organization.md) | Not started |
| Users and directory | [Users API](../api/users.md) | Not started |
| Roles and permissions | [Roles API](../api/roles.md) | Not started |
| Module seats | [User modules API](../api/user-modules.md) | Not started |
| Workspace/branding/numbering | [Settings API](../api/settings.md) | Not started |
| Billing/subscription/payment | [Billing API](../api/billing.md) | Not started |
| Notifications | [Notifications API](../api/notifications.md) | Not started |
| Activities | [Activities API](../api/activities.md) | Not started |
| Templates | [Templates API](../api/templates.md) | Not started |
| Tenant updates | Core provisioning/update projection | Not started |

## CRM capabilities

The complete current route-to-page mapping is maintained in
[CRM API index](../api/crm/README.md).

| Capability family | Backend owner | Scope characteristics | New portal |
| --- | --- | --- | --- |
| Settings and pipelines | CRM | Tenant configuration plus permissions | Not started |
| Leads | CRM | Branch and own/team/all visibility | Not started |
| Customer profiles | CRM with Core party directory | Tenant and branch scope | Not started |
| Opportunities | CRM | Branch, owner/team, pipeline/stage | Not started |
| Notes and attachments | CRM | Parent-resource authorization | Not started |
| Activities/tasks/calendar | CRM and Core Activity Hub by route | Resource and assignee scope | Not started |
| Outbound email | CRM plus Worker effect | Permission, entitlement, async delivery | Not started |
| Dashboards | CRM | Read/manage/share permissions | Not started |

## Trade capabilities

The complete current route-to-page mapping is maintained in
[Trade API index](../api/trade/README.md).

| Capability family | Backend owner | Scope characteristics | New portal |
| --- | --- | --- | --- |
| Catalogue/UOM | Trade | Tenant, company, branch, channel | Not started |
| Commercial accounts | Trade | Party/account eligibility and scope | Not started |
| Pricing/promotions | Trade | Company, branch, channel, effective dates | Not started |
| Quotations/orders | Trade | Actor scope, document state, customer eligibility | Not started |
| Purchasing | Trade | Vendor and branch scope | Not started |
| Inventory | Trade | Node, branch, period, reservation state | Not started |
| Document/workflow policy | Trade | Published immutable versions | Not started |
| Extensions/imports/webhooks | Trade | Typed schemas, idempotency, file limits | Not started |
| Control Tower | Trade | Recovery permission and concurrency state | Not started |
| Dashboards | Trade | Read/manage/share permissions | Not started |

## Asynchronous ownership

Worker performs background effects but is not a Tenant Portal API owner.

| Workflow | Browser command/read owner | Background owner |
| --- | --- | --- |
| Tenant component update | Core projection | Worker plus component installers |
| Email delivery | Core or CRM projection | Worker |
| Notification delivery | Core/CRM/Trade projection | Worker |
| Template PDF render | Core projection | Worker |
| Trade document render | Trade projection | Trade/Worker path proven by route |
| Billing lifecycle scheduling | Core projection | Worker |

The browser polls the route documented by the command owner. It never calls a
Worker internal route or relies on RabbitMQ details.

## Status rule

This file records replacement breadth. Exact fields, validation, permissions,
and errors belong in the API pages. A capability must not be marked live here
until its page/client and relevant tests exist in the new portal.
