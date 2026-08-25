# CRM API documentation index

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `in-progress-server-backed-slices`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current Gateway, controller, DTO, service, guard, seed, and test source plus non-authoritative historical frontend evidence

This directory is the implementation contract for CRM in the new Tenant Portal. It covers every CRM route currently exposed by the API Gateway. It deliberately does not describe UI or visual design.

Start with [Common contract](./common-contract.md). Client authors should use only the canonical browser prefix, consume raw successful payloads, and treat the Gateway manifest as the reachability boundary.

## Coverage

| Domain | Page | Gateway routes |
|---|---|---:|
| Shared behavior | [Common contract](./common-contract.md) | — |
| Activities, tasks, calendar, reminders | [Activities](./activities-tasks-calendar-reminders.md) | 11 |
| Custom fields and values | [Custom fields](./custom-fields.md) | 12 |
| Customer profiles and contacts | [Customer profiles](./customer-profiles.md) | 7 |
| Preset analytics | [Preset dashboards](./dashboards.md) | 7 |
| User dashboards, widgets, placements, shares | [Dashboard builder and widgets](./dashboard-builder-widgets.md) | 33 |
| Lead-stage catalogue | [Lead stages](./lead-stages.md) | 6 |
| Acquisition-source catalogue and icons | [Acquisition sources](./acquisition-sources.md) | 8 |
| Leads and conversion | [Leads](./leads.md) | 10 |
| Notes, attachment metadata, upload, download | [Notes and attachments](./notes-attachments.md) | 9 |
| Opportunities and stage history | [Opportunities](./opportunities.md) | 8 |
| Pipelines, boards, assignments, opportunity stages | [Pipelines and opportunity stages](./pipelines-opportunity-stages.md) | 22 |
| Tenant CRM settings | [Settings](./settings.md) | 2 |
| Runtime enum/static catalogue | [Static data](./static-data.md) | 1 |
| Transactional outbound email | [Outbound emails](./outbound-emails.md) | 6 |
| Safe client patterns | [Examples](./examples.md) | — |
| **Total current Gateway CRM surface** |  | **143** |

Every one of the 143 manifest routes is assigned once in the domain pages above. The six `/settings/custom-fields...` entries are compatibility aliases of the six canonical `/custom-fields...` entries and are counted because the Gateway exposes both.

## Gateway/controller parity

The five former browser-contract gaps—lead and customer-profile capabilities,
company contact options, adding a customer contact, and dashboard widget
drill-down—are now explicit Gateway routes and are documented in their domain
pages. No other CRM controller route was found outside the Gateway after
normalizing parameter names, and no Gateway CRM route was found without a
controller.

## Replacement status

An earlier repository snapshot documented CRM pages and API clients under the
old `mutakamel-web-app`. That path is absent from the current checkout, so the
description is historical behavior only, not current source evidence; the
backend contracts documented here remain authoritative. The current
`tenant-portal` now has verified server-backed slices for Leads, Pipeline,
static data, lead stages, acquisition sources, custom fields, and the safe
settings subset. Other scaffold cohorts remain intentionally unclaimed until
each browser contract is verified and implemented or removed.

Minimum replacement gate:

1. Implement all required browser calls through `/api/tenant/crm/v1`.
2. Enforce server-backed permissions, branch access, subscription state, and feature state; hiding controls is not authorization.
3. Preserve UUIDv7 idempotency keys for the 14 protected mutations.
4. Handle raw successful payloads, paginated shapes, `204`, streams, `202`, and both CRM and Gateway error formats.
5. Consume newly exposed capability/contact/drill-down routes only after their exact response contracts are validated in the implementing slice.
6. Validate enum values against [Static data](./static-data.md) where the runtime catalogue is authoritative.

## Authoritative sources

- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/idempotency/gateway-idempotency.service.ts`
- `../backend/mutakamel-apps/crm-app/src/main.ts`
- `../backend/mutakamel-apps/crm-app/src/common/common.module.ts`
- `../backend/mutakamel-apps/crm-app/src/app.module.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/crm.module.ts`
- `../backend/mutakamel-apps/crm-app/src/common/common.module.ts`
- `../backend/mutakamel-apps/crm-app/src/common/crm-scoped-access.service.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/app/crm/[view]/page.tsx`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/leads/tenant-leads-page.tsx`

Generated Swagger descriptions were used only as secondary evidence. DTO validators, services, guards, tests, and the Gateway route manifest take precedence.
