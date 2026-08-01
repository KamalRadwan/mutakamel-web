# Tenant party directory API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/directory`
> **Controller-relative prefix:** `/tenant/directory`
> **Tenant Portal status:** Planned. Legacy CRM/customer/lead screens use this Core directory, including party images.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/directory`
- Wire enums: `../backend/mutakamel-apps/core-app/packages/common/src/enums/party-*.enum.ts`
- Storage policy: `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts`
- Legacy consumers: `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/tenant-customer-party-page.tsx` and `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/crm/party-image.tsx`

## Security and response contract

All routes require a tenant JWT, matching verified host, current session/subscription, listed permission, and effective party/branch scope. Unauthorized cross-scope resources may be returned as not found. Client-supplied tenant/branch trust headers are forbidden.

Core rejects unknown DTO fields. IDs are UUIDv7. List routes use common pagination (`page` 1, `limit` 20/max 100, `search` max 200). Normal JSON uses Core success/error envelopes. Image download is the exception: it streams raw bytes and is not wrapped.

Directory writes have no explicit application idempotency contract. Refetch before replaying an ambiguous create.

Directory JSON/image reads are private and scope-sensitive; they must not be shared-cached. All directory mutations are synchronous from the portal contract and expose no client-polled async job.

## Party routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `POST /api/tenant/core/v1/directory/parties` | `directory.party.manage` | Create party and optional nested roles/contacts/addresses |
| `GET /api/tenant/core/v1/directory/parties` | `directory.party.read` | Paginated/filterable |
| `GET /api/tenant/core/v1/directory/parties/:id` | `directory.party.read` | Detail |
| `PATCH /api/tenant/core/v1/directory/parties/:id` | `directory.party.manage` | Update |
| `DELETE /api/tenant/core/v1/directory/parties/:id` | `directory.party.manage` | `204`, protected delete |
| `GET /api/tenant/core/v1/directory/parties/:id/contacts` | `directory.party.read` | Paginated linked people |

Create requires `partyType=PERSON|ORGANIZATION` and non-empty `displayName` (max 200). Optional string fields: `legalName` 240, `firstName`/`lastName` 120, `honorificTitle` 40, `organizationName` 200, `taxNumber` 80, `commercialRegistrationNumber` 80. Optional `branchId`/`ownerUserId` are UUIDv7. Optional nested arrays are `roles`, `contactMethods`, and `addresses`.

Update accepts those scalar/ownership fields plus `status=ACTIVE|INACTIVE|BLOCKED`; it does not replace nested collections. List filters are `partyType`, `status`, `roleType`, `branchId`, and `ownerUserId`.

Role wire values: `CUSTOMER`, `SUPPLIER`, `EMPLOYEE`, `LEAD`, `SHIPPING_RECIPIENT`, `CONTACT_PERSON`, `BILLING_CONTACT`, `LEGAL_ENTITY`, `GUARANTOR`, `PARTNER`.

Safe party-list example:

```http
GET /api/tenant/core/v1/directory/parties?page=1&limit=20&partyType=ORGANIZATION
Authorization: Bearer <tenant-access-token>
```

## Contact methods and addresses

| Method and canonical browser path | Permission |
|---|---|
| `POST /api/tenant/core/v1/directory/parties/:id/contact-methods` | `directory.contact.manage` |
| `PATCH /api/tenant/core/v1/directory/contact-methods/:methodId` | `directory.contact.manage` |
| `DELETE /api/tenant/core/v1/directory/contact-methods/:methodId` | `directory.contact.manage` |
| `POST /api/tenant/core/v1/directory/parties/:id/addresses` | `directory.address.manage` |
| `PATCH /api/tenant/core/v1/directory/addresses/:addressId` | `directory.address.manage` |
| `DELETE /api/tenant/core/v1/directory/addresses/:addressId` | `directory.address.manage` |

Contact method: required `methodType=PHONE|MOBILE|EMAIL|WHATSAPP|WEBSITE|OTHER`, required non-empty `value` max 255, optional `label` max 80 and `isPrimary` boolean.

Address: required `addressType=LEGAL|BILLING|SHIPPING|HOME|WORK|OTHER`; optional `label` 80, `country`/`city`/`area` 120, `street` 160, `buildingNo`/`floor`/`apartment` 80, `landmark` 160, `postalCode` 40, and `isPrimary` boolean.

Server directory settings enforce duplicate and per-party limits; do not duplicate only client-side.

Validation combines the exact DTO field limits/enums below with duplicate, relationship, configured-limit, storage, and actor-scope checks.

## Roles, relationships, and settings

| Method and canonical browser path | Permission |
|---|---|
| `POST /api/tenant/core/v1/directory/parties/:id/roles` | `directory.role.manage` |
| `DELETE /api/tenant/core/v1/directory/party-roles/:roleId` | `directory.role.manage` |
| `POST /api/tenant/core/v1/directory/relationships` | `directory.relationship.manage` |
| `DELETE /api/tenant/core/v1/directory/relationships/:relationshipId` | `directory.relationship.manage` |
| `GET /api/tenant/core/v1/directory/settings` | `directory.settings.manage` |
| `PATCH /api/tenant/core/v1/directory/settings` | `directory.settings.manage` |

Role create accepts `roleType`, optional `branchId`, optional `appSource` max 64, and optional metadata object. The same role/scope pair is unique.

Relationship create requires `fromPartyId`, `toPartyId`, and `relationshipType`; optional `label` max 120 and `isPrimary`. Types: `CONTACT_PERSON`, `BILLING_CONTACT`, `LEGAL_CONTACT`, `GUARANTOR`, `PARTNER_OF`, `EMPLOYEE_OF`, `OTHER`.

Settings update fields:

- `duplicateScope`: `TENANT|BRANCH|PARTY_ROLE`.
- `preventDuplicateEmail`, `preventDuplicatePhone`, `preventDuplicateWhatsapp`: strict booleans.
- `maxContactMethodsPerParty`, `maxAddressesPerParty`: integers 1–200.
- `partyCacheTtlSeconds`: integer 0–86,400.

Both settings GET and PATCH require `directory.settings.manage`; there is no separate read permission.

## Party images

| Method and canonical browser path | Permission | Response |
|---|---|---|
| `POST /api/tenant/core/v1/directory/parties/:id/image` | `directory.party.manage` | JSON party/image projection |
| `GET /api/tenant/core/v1/directory/parties/:id/image` | `directory.party.read` | Raw PNG/JPEG/WebP bytes |
| `DELETE /api/tenant/core/v1/directory/parties/:id/image` | `directory.party.manage` | `204` |

Upload exactly one multipart `file`. Allowed declared and detected formats are PNG, JPEG, WebP; maximum 2 MiB and 25,000,000 decoded pixels. Filename extension, MIME declaration, and magic content must agree. Core normalizes the image before storage.

Image GET sets private/no-store, `X-Content-Type-Options: nosniff`, and inline content disposition. Public party projections expose `imageUrl`, `imageKind=LOGO|PHOTO`, and `imageRevision`; they never expose `imageStorageKey`. Use URLs as opaque server-issued values.

## Errors and AI implementation rules

Expected errors include `PARTY_NOT_FOUND`, nested resource not-found errors, `PARTY_ROLE_ALREADY_EXISTS`, `PARTY_RELATIONSHIP_INVALID`, duplicate contact errors, configured contact/address limit errors, `PERMISSION_SCOPE_UNAVAILABLE`, `PARTY_IMAGE_REQUIRED`, `PARTY_IMAGE_INVALID`, `PARTY_IMAGE_TOO_LARGE`, `PARTY_IMAGE_NOT_FOUND`, and storage-unavailable errors.

- Select party type first and render only relevant person/organization fields.
- Never treat CRM ownership as directory authorization; Core decides scope.
- Send nested creates only when intentional; later edits use dedicated endpoints.
- Use a blob response for image GET, not the JSON envelope parser.
