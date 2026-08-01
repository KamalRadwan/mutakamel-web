# CRM API documentation index

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live-partial`
> Authorship: hand-written from current Gateway, controller, DTO, service, guard, seed, test, and legacy-client source

This directory is the implementation contract for CRM in the new Tenant Portal. It covers every CRM route currently exposed by the API Gateway. It deliberately does not describe UI or visual design.

Start with [Common contract](./common-contract.md). Client authors should use only the canonical browser prefix, consume raw successful payloads, and treat the Gateway manifest as the reachability boundary.

## Coverage

| Domain | Page | Gateway routes |
|---|---|---:|
| Shared behavior | [Common contract](./common-contract.md) | — |
| Activities, tasks, calendar, reminders | [Activities](./activities-tasks-calendar-reminders.md) | 11 |
| Custom fields and values | [Custom fields](./custom-fields.md) | 12 |
| Customer profiles and contacts | [Customer profiles](./customer-profiles.md) | 5 |
| Preset analytics | [Preset dashboards](./dashboards.md) | 7 |
| User dashboards, widgets, placements, shares | [Dashboard builder and widgets](./dashboard-builder-widgets.md) | 32 |
| Lead-stage catalogue | [Lead stages](./lead-stages.md) | 6 |
| Acquisition-source catalogue and icons | [Acquisition sources](./acquisition-sources.md) | 8 |
| Leads and conversion | [Leads](./leads.md) | 8 |
| Notes, attachment metadata, upload, download | [Notes and attachments](./notes-attachments.md) | 9 |
| Opportunities and stage history | [Opportunities](./opportunities.md) | 8 |
| Pipelines, boards, assignments, opportunity stages | [Pipelines and opportunity stages](./pipelines-opportunity-stages.md) | 22 |
| Tenant CRM settings | [Settings](./settings.md) | 2 |
| Runtime enum/static catalogue | [Static data](./static-data.md) | 1 |
| Transactional outbound email | [Outbound emails](./outbound-emails.md) | 6 |
| Safe client patterns | [Examples](./examples.md) | — |
| **Total current Gateway CRM surface** |  | **137** |

Every one of the 137 manifest routes is assigned once in the domain pages above. The six `/settings/custom-fields...` entries are compatibility aliases of the six canonical `/custom-fields...` entries and are counted because the Gateway exposes both.

## Known Gateway gaps

The CRM controllers expose five additional tenant routes which are absent from the Gateway manifest. They are not internal APIs, but they cannot be called through `/api/tenant/crm/v1` today:

| Controller route | Intended permission | Legacy usage | Documentation decision |
|---|---|---|---|
| `GET /api/v1/crm/customer-profiles/capabilities` | branch capability evaluation | called | excluded until Gateway contract exists |
| `POST /api/v1/crm/customer-profiles/:id/contacts` | `crm.customer_profiles.update.*` | called | excluded until Gateway contract exists |
| `GET /api/v1/crm/leads/capabilities` | branch capability evaluation | called | excluded until Gateway contract exists |
| `GET /api/v1/crm/leads/company-options/:companyPartyId/contacts` | `crm.leads.create.*` | called | excluded until Gateway contract exists |
| `POST /api/v1/crm/dashboards/:id/widgets/:widgetId/drilldown` | `crm.dashboards.read.*` | called | excluded until Gateway contract exists |

Do not add speculative browser URLs for these endpoints. The legacy frontend currently calls all five, so those flows require a Gateway fix or removal before the new portal can reach feature parity.

No other CRM controller route was found outside the Gateway after normalizing parameter names, and no Gateway CRM route was found without a controller.

## Replacement status

The old `mutakamel-web-app` has live CRM pages and API clients for leads, customers, opportunities, activities, dashboards, settings, notes, sources, stages, pipelines, and outbound email. It is only a behavioral reference: the backend contracts documented here are authoritative. The new `tenant-portal` has no CRM implementation yet, so every CRM domain remains `not-started`.

Minimum replacement gate:

1. Implement all required browser calls through `/api/tenant/crm/v1`.
2. Enforce server-backed permissions, branch access, subscription state, and feature state; hiding controls is not authorization.
3. Preserve UUIDv7 idempotency keys for the 14 protected mutations.
4. Handle raw successful payloads, paginated shapes, `204`, streams, `202`, and both CRM and Gateway error formats.
5. Resolve or intentionally retire all five Gateway gaps.
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
