# CRM lead stages

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `server-backed-supported-operations`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Lead stages are a tenant-wide ordered catalogue. Their semantic flag/category drives lead lifecycle and conversion rules.

The current portal reads the canonical catalogue and exposes create, delete, and set-default operations. It deliberately does not fabricate detail/history/settings pages, and does not expose update or reorder controls until those workflows have approved UX. Ambiguous mutation failures trigger a catalogue re-read rather than a second write intent.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/lead-stages` | `/api/v1/crm/lead-stages` | `crm.lead_stages.manage` | `201`, stage |
| `GET` | `/api/tenant/crm/v1/lead-stages` | `/api/v1/crm/lead-stages` | `crm.lead_stages.read` | `200`, ordered array |
| `PATCH` | `/api/tenant/crm/v1/lead-stages/reorder` | `/api/v1/crm/lead-stages/reorder` | `crm.lead_stages.manage` | `200`, ordered array |
| `PATCH` | `/api/tenant/crm/v1/lead-stages/:id` | `/api/v1/crm/lead-stages/:id` | `crm.lead_stages.manage` | `200`, stage |
| `POST` | `/api/tenant/crm/v1/lead-stages/:id/default` | `/api/v1/crm/lead-stages/:id/default` | `crm.lead_stages.manage` | `201`, stage |
| `DELETE` | `/api/tenant/crm/v1/lead-stages/:id` | `/api/v1/crm/lead-stages/:id` | `crm.lead_stages.manage` | `204` |

These are tenant-wide static permissions; there is no branch query or own/team scope.

## Validation and enums

Create requires:

- nonempty `nameAr` and `nameEn`, maximum 80 each;
- `flag`: `NEW`, `CONTACTED`, `QUALIFYING`, `QUALIFIED`, `DISQUALIFIED`, `CONVERTED`, `NURTURING`, or `ON_HOLD`;
- `category`: `OPEN`, `POSITIVE`, `NEGATIVE`, or `IN_PROGRESS`;
- optional strict boolean `isDefault`.

Update accepts optional names, flag, category, and strict boolean `isActive`. Default selection uses the path UUIDv7 and no body.

Semantic flag/category combinations are service validated. Protected/in-use/default stages cannot be modified, deactivated, or deleted in ways that break lifecycle rules.

## Reorder

Body:

```json
{
  "orderedIds": [
    "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
    "0191e9a8-7f51-7b32-8d72-19f9217a41b4"
  ]
}
```

`orderedIds` must be a nonempty unique array of UUIDv7 values and exactly represent the current nondeleted stage set. The `NEW` semantic stage must remain first.

This route requires UUIDv7 `x-idempotency-key`. Preserve the key only for an exact replay of the same order.

## Seed catalogue

New tenants are seeded in this order:

| Rank | Flag |
|---:|---|
| 1 | `NEW` |
| 2 | `CONTACTED` |
| 3 | `QUALIFYING` |
| 4 | `QUALIFIED` |
| 5 | `NURTURING` |
| 6 | `ON_HOLD` |
| 7 | `DISQUALIFIED` |
| 8 | `CONVERTED` |

Names and IDs are returned by the API. Do not hardcode seed IDs, labels, order, or assume a tenant has not customized them.

## Responses, errors, and retry

Success payloads are raw stage projections with identity, labels, semantic fields, rank/default/active state, and timestamps as applicable. Delete has no body.

Important errors:

- `LEAD_STAGE_CATEGORY_INVALID`
- `LEAD_STAGE_DEFAULT_DEACTIVATE`
- `LEAD_STAGE_DEFAULT_DELETE`
- `LEAD_STAGE_DEFAULT_INACTIVE`
- `LEAD_STAGE_IN_USE`
- `LEAD_STAGE_NOT_FOUND`
- `LEAD_STAGE_PROTECTED`
- `LEAD_STAGE_REORDER_INVALID`

Only reorder has Gateway replay protection. For create/update/default/delete, re-read the catalogue after an ambiguous response. Treat labels as plain user-configurable text.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/lead-stages/lead-stages.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/lead-stages/dto/lead-stage.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/lead-stages/lead-stages.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/lead-stages/lead-stages.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
