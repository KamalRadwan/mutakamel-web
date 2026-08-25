# CRM customer profiles

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Customer profiles represent individual or corporate prospects/customers in one branch. The Gateway exposes all seven controller routes.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `GET` | `/api/tenant/crm/v1/customer-profiles/capabilities` | `/api/v1/crm/customer-profiles/capabilities` | branch membership; returns effective create/update/delete scopes | `200`, capability object |
| `POST` | `/api/tenant/crm/v1/customer-profiles` | `/api/v1/crm/customer-profiles` | `crm.customer_profiles.create.{own|team|all}` | `201`, profile |
| `GET` | `/api/tenant/crm/v1/customer-profiles` | `/api/v1/crm/customer-profiles` | `crm.customer_profiles.read.{own|team|all}` | `200`, page |
| `POST` | `/api/tenant/crm/v1/customer-profiles/:id/contacts` | `/api/v1/crm/customer-profiles/:id/contacts` | `crm.customer_profiles.update.{own|team|all}` plus record branch access | `201`, linked person identity |
| `GET` | `/api/tenant/crm/v1/customer-profiles/:id` | `/api/v1/crm/customer-profiles/:id` | `crm.customer_profiles.read.{own|team|all}` | `200`, profile |
| `PATCH` | `/api/tenant/crm/v1/customer-profiles/:id` | `/api/v1/crm/customer-profiles/:id` | `crm.customer_profiles.update.{own|team|all}` | `200`, profile |
| `DELETE` | `/api/tenant/crm/v1/customer-profiles/:id` | `/api/v1/crm/customer-profiles/:id` | `crm.customer_profiles.delete.{own|team|all}` | `204` |

`GET /customer-profiles/capabilities` requires UUIDv7 `branchId` and returns nullable action scopes. Treat a null action as unavailable. `POST /customer-profiles/:id/contacts` accepts the contact-person shape below, creates and links the person transactionally, and must not be replayed automatically after an ambiguous response.

## Wire enums

- `profileType`: `INDIVIDUAL`, `CORPORATE`
- `status`: `PROSPECT`, `ACTIVE_CUSTOMER`, `INACTIVE`, `BLACKLISTED`
- contact `methodType`: `PHONE`, `MOBILE`, `EMAIL`, `WHATSAPP`, `WEBSITE`, `OTHER`

## Create and update validation

Create requires:

| Field | Contract |
|---|---|
| `branchId` | UUIDv7 |
| `profileType` | profile enum |
| `displayName` | nonempty, maximum 180 |

Optional common fields are `status`, UUIDv7 `ownerUserId`, nullable UUIDv7 `acquisitionSourceId`, `description` up to 2,000, and an opaque `customFields` object validated by the custom-field service.

Corporate fields:

| Field | Contract |
|---|---|
| `companyName` | nonempty, maximum 180 |
| `taxCardNumber`, `taxNumber` | maximum 64 |
| `commercialRegisterNumber`, `commercialRegistrationNumber` | maximum 64; both names remain accepted |
| `companyPhone` | nonempty, maximum 32 |
| `companyPhones` | at most 10 strings, each maximum 32 |
| `companyEmail` | valid email, maximum 180 |
| `companyWebsite` | URL with protocol, maximum 180 |

`primaryContact` is one contact object. `contacts` is at most 20 contacts. A contact supports:

- optional UUIDv7 `contactPartyId`;
- required nonempty `fullName`, maximum 180;
- optional `firstName`/`lastName` maximum 80, `honorificTitle` maximum 40, `jobTitle` maximum 120;
- strict boolean `isPrimary`;
- valid `email` maximum 180;
- at most 10 phone strings, maximum 32 each;
- at most 20 `contactMethods`, each with `methodType`, nonempty `value` up to 255, and optional `label` up to 80.

Service rules are stricter than DTO shape:

- corporate contacts and corporate registration fields are forbidden for an individual;
- corporate profiles require coherent company/contact information;
- primary-contact selection must be unique and valid;
- referenced contacts must be permitted and inside the branch.

Update accepts the same mutable fields but not `branchId` or `profileType`. Unknown fields are rejected.

## List query

`branchId` is required. Common pagination/search applies. Optional filters:

- `profileType`
- `status`
- UUIDv7 `acquisitionSourceId`
- UUIDv7 `ownerUserId`

Allowed `sortBy` values are `displayName` and `createdAt`; `sortDir` is `ASC|DESC`. Other sort fields are rejected. Results use the common raw page shape.

## Response and deletion behavior

Create/get/update return the raw service projection. It includes profile identity, branch, type/status, owner/source, contact/company data, custom field materialization, and timestamps as applicable. There is no versioned response DTO for every projection property, so validate consumed fields and tolerate additive properties.

Delete is a soft delete and returns no body. A profile with active opportunities cannot be deleted. A blacklisted profile also affects opportunity creation/update rules.

No profile route requires a Gateway idempotency key. Do not automatically replay create/update/delete after an ambiguous response.

## Domain errors

- `CUSTOMER_PROFILE_NOT_FOUND`
- `CUSTOMER_PROFILE_HAS_ACTIVE_OPPORTUNITIES`
- `CUSTOMER_PROFILE_CONTACT_INVALID`
- `CUSTOMER_PROFILE_CONTACT_NAME_REQUIRED`
- `CUSTOMER_PROFILE_CONTACT_OUTSIDE_BRANCH`
- `CUSTOMER_PROFILE_CONTACT_PRIMARY_INVALID`
- `CUSTOMER_PROFILE_CONTACTS_CORPORATE_ONLY`
- `CUSTOMER_PROFILE_CORPORATE_FIELDS_FORBIDDEN`
- downstream blacklisted-customer errors documented under [Opportunities](./opportunities.md)

All routes also enforce branch, owner/team scope, active CRM seat, subscription, and tenant state. A not-found result can conceal an inaccessible profile.

## Safe example

```json
{
  "branchId": "0191e9a8-7f51-7b32-8d72-19f9217a41b3",
  "profileType": "CORPORATE",
  "displayName": "Example Trading",
  "companyName": "Example Trading",
  "status": "PROSPECT",
  "primaryContact": {
    "fullName": "Example Contact",
    "email": "contact@example.invalid",
    "isPrimary": true,
    "contactMethods": [
      {
        "methodType": "EMAIL",
        "value": "contact@example.invalid"
      }
    ]
  }
}
```

Send this body to `POST /api/tenant/crm/v1/customer-profiles`. Use synthetic values in tests and examples.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles/customer-profiles.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles/dto/customer-profile.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles/customer-profiles.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/customer-profiles/customer-profiles.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/common/dto/crm-list-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/packages/common/src/enums/crm.enums.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/customers/tenant-customers-page.tsx`
