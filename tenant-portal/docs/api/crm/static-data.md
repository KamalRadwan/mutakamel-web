# CRM static data catalogue

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `tested`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

The static-data endpoint returns runtime wire enums, bilingual labels, permission names, event names, owner options, and derived rules. It is the preferred form/catalogue source except for the attachment-policy discrepancy below.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/static-data` | `/api/v1/crm/static-data` | `crm.settings.read` | `200`, catalogue object |

There is no query or request body. The result is raw JSON and should be fetched with authenticated `no-store` behavior. The route is synchronous and has no idempotency concerns.

## Current Tenant Portal implementation

`src/app/(tenant)/crm/static-data-catalogue/` now exposes only the canonical
read operation. It validates the raw CRM fields consumed by the screen, retains
additive option groups, bounds the response body, and shows explicit loading,
failure, search, and retry states without a local fallback. The previous create,
delete, detail, history, settings, and invented Core sync flows were removed
because no such
CRM contract exists. Contract coverage lives in
`src/app/(tenant)/crm/static-data-catalogue/hooks/useCrmStaticCatalogue.test.ts`.

## Response contract

Top-level fields:

| Field | Content |
|---|---|
| `enums` | raw string arrays for supported CRM enum groups |
| `enumOptions` | `{value,label:{en,ar}}[]` for the same groups |
| `attachmentPolicy` | advertised size/MIME/extension/rejected-family data; see drift warning |
| `permissions` | full CRM permission string array |
| `permissionOptions` | permission plus bilingual label |
| `ownerTypeOptions` | bilingual options for `LEAD`, `CUSTOMER_PROFILE`, `PARTY`, `OPPORTUNITY`, `ACTIVITY`, `NOTE` |
| `eventOptions` | CRM contract event names with bilingual labels |
| `derivedRules` | machine-readable status/conversion derivations |

`enums` currently includes:

```text
profileTypes
customerStatuses
leadStatuses
leadStageFlags
opportunityStatuses
opportunityStageFlags
customFieldOwnerTypes
customFieldTypes
fieldRequirementOperations
activityTypes
activityStatuses
taskStatuses
reminderStatuses
```

`derivedRules.opportunityStatusByStageFlag` maps `WON`, `LOST`, and `ON_HOLD`; its `default` is `IN_PROGRESS`. `derivedRules.leadConversionCopiesCustomFieldOwnerType` is `LEAD_AND_PARTY`.

The service throws if a required bilingual translation is missing, so a `5xx` is a catalogue/deployment defect rather than an empty-label condition.

## Attachment-policy drift

`attachmentPolicy.maxSizeBytes` correctly reports `26,214,400`, but its format lists are stale:

- it advertises SVG, legacy DOC, and legacy XLS formats that the upload controller/shared storage do not accept;
- it omits accepted `image/webp` and `text/csv`;
- it advertises `image/jpg`, while the canonical JPEG MIME is `image/jpeg`.

For uploads, [Notes and attachments](./notes-attachments.md#attachment-upload), the upload controller, and the shared storage bucket constants are authoritative. The portal must not accept/reject a file solely from `static-data.attachmentPolicy` until the backend catalogue is reconciled.

## AI/client consumption rules

1. Treat `value` as the wire value and bilingual `label` only as display text.
2. Never infer permission from a label or synthesize permission names.
3. Do not use the broad `customFieldOwnerTypes` array for value writes; the custom-field DTO accepts only `LEAD`, `PARTY`, `CUSTOMER_PROFILE`, and `OPPORTUNITY`.
4. Do not persist the catalogue indefinitely; it changes with deployment and tenant/session authorization.
5. Unknown additive groups/options must not break parsing.

## Safe response excerpt

```json
{
  "enums": {
    "profileTypes": ["INDIVIDUAL", "CORPORATE"],
    "opportunityStatuses": ["IN_PROGRESS", "ON_HOLD", "WON", "LOST"]
  },
  "enumOptions": {
    "profileTypes": [
      {
        "value": "INDIVIDUAL",
        "label": { "en": "Individual", "ar": "فرد" }
      }
    ]
  }
}
```

Labels above illustrate shape only; always render the server-returned current labels.

## Errors and security

Common authentication, seat, subscription, module, and `crm.settings.read` errors apply. Do not expose the permission catalogue as proof that the current actor owns every listed permission; it is a vocabulary, not the actor's effective grants.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/static-data/static-data.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/static-data/static-data.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/static-data/static-data.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/static-data/permission-catalog.spec.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/crm-app/packages/contracts/src/constants/event-names.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
