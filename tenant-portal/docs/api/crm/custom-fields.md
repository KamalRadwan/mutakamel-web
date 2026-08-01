# CRM custom fields

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live-partial`
> Authorship: hand-written from current source

CRM custom fields have definitions, operation-specific requirements, and per-record values. The Gateway exposes six canonical routes and six compatibility aliases.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/custom-fields` | `/api/v1/crm/custom-fields` | `crm.custom_fields.manage` | `201`, definition |
| `GET` | `/api/tenant/crm/v1/custom-fields` | `/api/v1/crm/custom-fields` | `crm.custom_fields.read` | `200`, array |
| `PATCH` | `/api/tenant/crm/v1/custom-fields/:id` | `/api/v1/crm/custom-fields/:id` | `crm.custom_fields.manage` | `200`, definition |
| `POST` | `/api/tenant/crm/v1/custom-fields/:id/requirements` | `/api/v1/crm/custom-fields/:id/requirements` | `crm.custom_fields.manage` | `201`, requirement |
| `POST` | `/api/tenant/crm/v1/custom-fields/values` | `/api/v1/crm/custom-fields/values` | `crm.custom_fields.manage` | `201`, value |
| `GET` | `/api/tenant/crm/v1/custom-fields/values` | `/api/v1/crm/custom-fields/values` | `crm.custom_fields.read` | `200`, array |

Compatibility aliases are separately routed:

| Method | Compatibility browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/settings/custom-fields` | `/api/v1/crm/settings/custom-fields` | `crm.custom_fields.manage` | `201`, definition |
| `GET` | `/api/tenant/crm/v1/settings/custom-fields` | `/api/v1/crm/settings/custom-fields` | `crm.custom_fields.read` | `200`, array |
| `PATCH` | `/api/tenant/crm/v1/settings/custom-fields/:id` | `/api/v1/crm/settings/custom-fields/:id` | `crm.custom_fields.manage` | `200`, definition |
| `POST` | `/api/tenant/crm/v1/settings/custom-fields/:id/requirements` | `/api/v1/crm/settings/custom-fields/:id/requirements` | `crm.custom_fields.manage` | `201`, requirement |
| `POST` | `/api/tenant/crm/v1/settings/custom-fields/values` | `/api/v1/crm/settings/custom-fields/values` | `crm.custom_fields.manage` | `201`, value |
| `GET` | `/api/tenant/crm/v1/settings/custom-fields/values` | `/api/v1/crm/settings/custom-fields/values` | `crm.custom_fields.read` | `200`, array |

Those six aliases are live and included in the 137-route count, but new portal code must use `/custom-fields...`.

Definition operations are tenant-wide static permissions. Value operations additionally require `branchId` access; the service confirms that the owner record exists in that branch.

## Wire enums

- owner/value type: `LEAD`, `PARTY`, `CUSTOMER_PROFILE`, `OPPORTUNITY`
- definition-only enum also contains `LEAD_AND_PARTY`, but create/value DTOs do not accept it
- field type: `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE`
- requirement operation: `CREATE`, `UPDATE`, `CONVERT`

The broader shared owner enum must not be copied blindly into a write form. Use the four owner/value values accepted by the DTO.

## Definition validation

`POST /custom-fields` requires:

| Field | Contract |
|---|---|
| `ownerType` | one of the four value owner types; legacy alias `scope` is accepted, and one of the two is required by the service |
| `fieldKey` | nonempty, maximum 64; service normalizes/validates lowercase underscore form |
| `nameAr`, `nameEn` | nonempty, maximum 120 |
| `type` | field-type enum |

Optional fields are `placeholderAr`/`placeholderEn` up to 180, strict boolean `isSearchable`, and integer `sortOrder >= 1`.

`options` is an array of:

```json
{
  "key": "enterprise",
  "nameAr": "مؤسسة",
  "nameEn": "Enterprise",
  "sortOrder": 1,
  "isActive": true
}
```

`key` is nonempty and at most 64; labels are nonempty and at most 120; `sortOrder >= 1`; `isActive` is a strict boolean. Select-like types require coherent options, while non-option types reject invalid option/value combinations.

`PATCH /custom-fields/:id` allows key/labels/placeholders/options/searchability/activity/order. Owner type and field type are immutable.

## Requirements

`POST /custom-fields/:id/requirements` body:

| Field | Contract |
|---|---|
| `operation` | required `CREATE|UPDATE|CONVERT` |
| `entityScope` | optional four-value owner enum |
| `isRequired` | required strict boolean |

The route creates or replaces the rule for the selected field/operation/scope. It is not Gateway-idempotent.

## Values

`POST /custom-fields/values` requires UUIDv7 `branchId` and one member from each alias pair:

- field reference: UUIDv7 `fieldDefinitionId` or string `fieldKey` up to 64;
- owner type: `ownerType` or legacy `entityType`;
- owner ID: UUIDv7 `ownerId` or legacy `entityId`;
- value: `value` or legacy `valueJson`.

Ambiguous/missing alias pairs are rejected. Value shape is validated against the resolved active definition. For example, number/boolean/date/select/multi-select/email/phone fields are not interchangeable.

`GET /custom-fields/values` requires `branchId`; it accepts the same owner aliases. The service requires a resolvable owner type and ID. It returns the raw value array, not a paginated result.

## Responses, errors, and retry

Definitions/requirements/values are raw service projections. The API has no global success envelope and no public response DTO freezing every property. Treat definition IDs, normalized keys, active state, options, requirements, owner identity, value, and timestamps as the stable concepts.

Domain errors include:

- `CUSTOM_FIELD_INACTIVE`
- `CUSTOM_FIELD_NOT_FOUND`
- `CUSTOM_FIELD_REFERENCE_REQUIRED`
- `CUSTOM_FIELD_KEY_AMBIGUOUS`
- `CUSTOM_FIELD_KEY_INVALID`
- `CUSTOM_FIELD_OWNER_TYPE_REQUIRED`
- `CUSTOM_FIELD_OWNER_ID_REQUIRED`
- `CUSTOM_FIELD_VALUE_REQUIRED`
- `CUSTOM_FIELD_INVALID_OWNER_TYPE`
- `CUSTOM_FIELD_OPTIONS_REQUIRED`
- `CUSTOM_FIELD_OPTIONS_INVALID`
- `CUSTOM_FIELD_VALUE_INVALID`
- `CUSTOM_FIELD_OWNER_NOT_FOUND`
- `CUSTOM_FIELD_OWNER_BRANCH_MISMATCH`

None of the 12 canonical/alias routes requires Gateway idempotency. After an ambiguous mutation, re-read definitions/values before deciding whether to retry. Never trust a client-supplied owner type or branch without the server check.

## Safe example

```http
POST /api/tenant/crm/v1/custom-fields/values
Content-Type: application/json

{
  "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "fieldKey": "preferred_channel",
  "ownerType": "LEAD",
  "ownerId": "0191e9a8-7f51-7b32-8d72-19f9217a41b4",
  "value": "EMAIL"
}
```

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/custom-fields/custom-fields.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/custom-fields/dto/custom-field.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/custom-fields/custom-fields.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/custom-fields/custom-fields.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/custom-fields/custom-field-write.helper.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
