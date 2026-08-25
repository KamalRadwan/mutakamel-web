# CRM leads

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `server-backed-supported-operations`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Leads capture an individual or corporate prospect, move through tenant-defined lead stages, and can be converted transactionally into a customer profile and optional opportunity.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/leads/capabilities` | `/api/v1/crm/leads/capabilities` | branch membership; returns effective action scopes | `200`, capability object |
| `POST` | `/api/tenant/crm/v1/leads` | `/api/v1/crm/leads` | `crm.leads.create.{own|team|all}` | `201`, lead |
| `GET` | `/api/tenant/crm/v1/leads` | `/api/v1/crm/leads` | `crm.leads.read.{own|team|all}` | `200`, page |
| `GET` | `/api/tenant/crm/v1/leads/company-options` | `/api/v1/crm/leads/company-options` | `crm.leads.create.{own|team|all}` | `200`, array |
| `GET` | `/api/tenant/crm/v1/leads/company-options/:companyPartyId/contacts` | `/api/v1/crm/leads/company-options/:companyPartyId/contacts` | `crm.leads.create.{own|team|all}` plus requested branch membership | `200`, contact array |
| `GET` | `/api/tenant/crm/v1/leads/:id` | `/api/v1/crm/leads/:id` | `crm.leads.read.{own|team|all}` | `200`, lead |
| `PATCH` | `/api/tenant/crm/v1/leads/:id` | `/api/v1/crm/leads/:id` | `crm.leads.update.{own|team|all}` | `200`, lead |
| `POST` | `/api/tenant/crm/v1/leads/:id/stage` | `/api/v1/crm/leads/:id/stage` | `crm.leads.update.{own|team|all}` | `201`, lead |
| `POST` | `/api/tenant/crm/v1/leads/:id/convert` | `/api/v1/crm/leads/:id/convert` | `crm.leads.convert.{own|team|all}` | `201`, conversion result |
| `DELETE` | `/api/tenant/crm/v1/leads/:id` | `/api/v1/crm/leads/:id` | `crm.leads.delete.{own|team|all}` | `204` |

`GET /leads/capabilities` requires UUIDv7 `branchId` and returns nullable scoped actions across leads and related resources; a null action is unavailable. The company-contact route requires the same branch query and a UUIDv7 company party ID, and returns only active contacts for an eligible organization in that branch.

## Wire enums

| Field | Values |
|---|---|
| `leadProfileType`, conversion `profileType` | `INDIVIDUAL`, `CORPORATE` |
| lead `status` | `OPEN`, `CONVERTED`, `DISQUALIFIED`, `ON_HOLD` |
| `stageFlag` | `NEW`, `CONTACTED`, `QUALIFYING`, `QUALIFIED`, `DISQUALIFIED`, `CONVERTED`, `NURTURING`, `ON_HOLD` |
| stage category | `OPEN`, `POSITIVE`, `NEGATIVE`, `IN_PROGRESS` |
| contact `methodType` | `PHONE`, `MOBILE`, `EMAIL`, `WHATSAPP`, `WEBSITE`, `OTHER` |

Status is lifecycle state derived by the service. Move a lead through stage endpoints; do not attempt to patch `status` or `stageId`.

## Create validation

Required fields are UUIDv7 `branchId`, `leadProfileType`, and nonempty `displayName` up to 180. Optional UUIDv7 references are `stageId`, nullable `acquisitionSourceId`, and `ownerUserId`.

Individual/contact fields:

- `firstName`, `lastName`: maximum 80
- `honorificTitle`: maximum 40
- `primaryMobile`: maximum 32
- `phones`: at most 10 strings, maximum 32 each
- `email`: valid, maximum 180

Corporate fields:

- `companyName`, `legalName`: maximum 180
- `existingCompanyPartyId`: UUIDv7 organization already visible in the branch
- `taxNumber`, `commercialRegistrationNumber`: maximum 64
- `companyPhone`: maximum 32
- `companyPhones`: at most 10 strings, maximum 32 each
- `contacts`: at most 20 contact objects

A corporate contact requires nonempty `fullName` up to 180. It may include UUIDv7 `contactPartyId`, legacy `title` or `honorificTitle` up to 40, `jobTitle` up to 120, strict `isPrimary`, first/last names up to 80, phone up to 32, at most 10 phones, and a valid email up to 180.

`address` accepts `country`, `city`, `state` up to 120; `street1`/legacy `street` and `landmark` up to 160; `street2`, `buildingNo`, `floor`, `apartment` up to 80; legacy `area` up to 120; `postalCode` up to 40.

Free text limits: `description` 2,000, `interestSummary` 4,000, `expectedNeed` 4,000. `customFields` is an object and is validated against active definitions.

The service enforces profile-specific coherence: individual leads reject corporate-only fields; corporate leads require valid company/contact state; an existing company cannot be combined with conflicting new-company data; references must be active and inside the branch.

## Update, stage, and list

Update allows mutable identity/contact/company/source/description/owner/custom-field fields. It does not accept `branchId`, profile type, address, existing company, status, or stage. Some optional scalar fields explicitly support `null`; omitted and `null` should not be conflated.

Stage body:

```json
{ "stageId": "0191e9a8-7f51-7b32-8d72-19f9217a41b5" }
```

The stage must be active and semantically valid. The service derives lifecycle status from its flag.

List requires UUIDv7 `branchId`, supports common pagination/search, and optionally accepts:

- `leadProfileType`
- `status`
- `stageFlag`
- UUIDv7 `stageId`
- UUIDv7 `acquisitionSourceId`
- UUIDv7 `ownerUserId`

Allowed `sortBy`: `displayName`, `createdAt`.

`GET /company-options` requires `branchId` and create scope. It returns eligible existing corporate parties. It does not grant permission to use an option outside the subsequent server checks.

## Conversion

`POST /leads/:id/convert` requires:

| Field | Contract |
|---|---|
| `profileType` | `INDIVIDUAL|CORPORATE` |
| `displayName` | optional nonempty, maximum 180 |
| `companyName` | optional nonempty, maximum 180 |
| `primaryContact` | optional contact object |
| `createOpportunity` | optional strict boolean |
| `opportunity` | required exactly when `createOpportunity` is true |

Conversion contact fields follow the customer contact format: nonempty `fullName` up to 180, optional first/last names up to 80, job up to 120, email up to 180, and at most 20 typed contact methods.

Opportunity body requires UUIDv7 `pipelineId`, UUIDv7 `stageId`, and nonempty `title` up to 180. Optional: integer `importance 0..3`, nonnegative `amount` with at most two decimals, `description` up to 2,000, three-character uppercase `currencyCode`, UUIDv7 `ownerUserId`, ISO `expectedCloseDate`, integer `probabilityPercent 0..100`, and `customFields`.

The selected initial opportunity stage cannot be terminal. Conversion is transactional and returns a raw object containing the updated lead, created customer profile, and optional opportunity.

## Errors, security, and retry

Important errors:

- `LEAD_NOT_FOUND`
- `LEAD_ALREADY_CONVERTED`
- `LEAD_STAGE_INVALID`
- `LEAD_COMPANY_NAME_REQUIRED`
- `LEAD_CONTACT_INVALID`
- `LEAD_CONTACT_NAME_REQUIRED`
- `LEAD_CONTACT_OUTSIDE_BRANCH`
- `LEAD_CONTACT_PRIMARY_INVALID`
- `LEAD_CONTACT_REQUIRED`
- `LEAD_CORPORATE_FIELDS_FORBIDDEN`
- `LEAD_EXISTING_COMPANY_FIELDS_FORBIDDEN`
- `LEAD_EXISTING_COMPANY_INVALID`
- `LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH`
- `LEAD_CONVERSION_INVALID`
- `LEAD_CONVERSION_OPPORTUNITY_REQUIRED`
- `LEAD_CONVERSION_OPPORTUNITY_UNEXPECTED`
- `LEAD_CONVERSION_OPPORTUNITY_STAGE_TERMINAL`
- `LEAD_CONVERSION_REQUIRED`
- `OPPORTUNITY_STAGE_INVALID`

All IDs are revalidated for tenant, branch, active state, and scoped ownership. A `404` can conceal an inaccessible lead.

None of the eight routes requires Gateway idempotency. Conversion is transactionally atomic but has no browser replay contract; do not auto-retry it after an ambiguous transport failure. Re-read the lead first.

## Safe create example

```json
{
  "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "leadProfileType": "INDIVIDUAL",
  "displayName": "Example Prospect",
  "email": "prospect@example.invalid",
  "interestSummary": "Requested a product demonstration"
}
```

Send to `POST /api/tenant/crm/v1/leads`.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/leads/leads.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/leads/dto/lead.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/leads/leads.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/leads/leads.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/leads/tenant-leads-page.tsx`
