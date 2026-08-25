# CRM acquisition sources

> Status: `verified-current`
> Last source verification: `2026-08-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `partial`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Acquisition sources are a tenant-wide ordered bilingual catalogue used by leads and customer profiles. Each source may have a private tenant-served icon.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/acquisition-sources` | `/api/v1/crm/acquisition-sources` | `crm.acquisition_sources.manage` | `201`, source |
| `POST` | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `/api/v1/crm/acquisition-sources/:id/icon` | `crm.acquisition_sources.manage` | `201`, source/icon projection |
| `GET` | `/api/tenant/crm/v1/acquisition-sources/:id/icon` | `/api/v1/crm/acquisition-sources/:id/icon` | `crm.acquisition_sources.read` | `200`, image stream |
| `GET` | `/api/tenant/crm/v1/acquisition-sources` | `/api/v1/crm/acquisition-sources` | `crm.acquisition_sources.read` | `200`, ordered array |
| `PATCH` | `/api/tenant/crm/v1/acquisition-sources/reorder` | `/api/v1/crm/acquisition-sources/reorder` | `crm.acquisition_sources.manage` | `200`, ordered array |
| `GET` | `/api/tenant/crm/v1/acquisition-sources/:id` | `/api/v1/crm/acquisition-sources/:id` | `crm.acquisition_sources.read` | `200`, source |
| `PATCH` | `/api/tenant/crm/v1/acquisition-sources/:id` | `/api/v1/crm/acquisition-sources/:id` | `crm.acquisition_sources.manage` | `200`, source |
| `DELETE` | `/api/tenant/crm/v1/acquisition-sources/:id` | `/api/v1/crm/acquisition-sources/:id` | `crm.acquisition_sources.manage` | `204` |

These are tenant-wide static permissions; no branch or own/team suffix applies.

## Current Tenant Portal

The replacement now provides a tested, server-backed catalogue read plus create and delete operations. It uses only the canonical Gateway routes, parses the raw CRM source projection, retains authoritative failure states, and re-reads the catalogue after successful writes. Update, reorder, and icon management are not yet exposed in the UI. The removed detail-history and UTM settings pages had no acquisition-source contract.

## Validation

Create requires trimmed, nonempty `nameAr` and `nameEn`, each at most 120 characters. Optional `isActive` is boolean; update accepts the same three fields optionally. Browser JSON clients should send a boolean or omit the field. The shared backend transform also recognizes the query/form strings `true`, `false`, `1`, and `0`, while null or an empty string is treated as omitted.

List optionally accepts `isActive`; it is not paginated and the tenant catalogue is bounded to 500 nondeleted sources.

Reorder body is:

```json
{ "orderedIds": ["<uuid-v7>", "<uuid-v7>"] }
```

The array must contain 1-500 unique UUIDv7 values and exactly represent all current nondeleted sources. Reorder requires a UUIDv7 `x-idempotency-key`.

## Icon upload and download

Upload is multipart with exactly one `file`, maximum 2 MiB. Accepted MIME values:

```text
image/png
image/jpeg
image/x-icon
image/vnd.microsoft.icon
```

For `.ico` filenames only, an empty MIME value or `application/octet-stream` is normalized to `image/x-icon`. The extension must match the allowed format and content sniffing must pass. The file cannot be empty. The service stores an authorized icon reference and returns a source projection.

Download returns the private icon stream with restrictive cache behavior. Use the returned `iconUrl` or the authorized route. Never expose or derive a storage key.

## Seed catalogue

Fresh tenants receive 12 sources provisioned in dense order `1..12`:

1. Website
2. Facebook
3. Instagram
4. LinkedIn
5. WhatsApp
6. TikTok
7. Google Ads
8. Email Campaign
9. Referral
10. Phone Call
11. Walk-in
12. Offline Data

Names, IDs, active state, and order are tenant-configurable. Read the API; do not hardcode these values for runtime behavior.

## Responses, errors, and security

JSON successes are raw projections; there is no `{ success, data }` envelope. Delete has no body. Icons are streams, not JSON. Source labels are tenant-authored text.

Each JSON source is:

```ts
{
  id: string; // UUIDv7
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  iconUrl: string | null; // authorized canonical route, never a storage key
}
```

Important errors:

- `CRM_ACQUISITION_SOURCE_NOT_FOUND`
- `CRM_ACQUISITION_SOURCE_IN_USE`
- `CRM_ACQUISITION_SOURCE_NAME_TAKEN`
- `CRM_ACQUISITION_SOURCE_LIMIT_EXCEEDED`
- `CRM_ACQUISITION_SOURCE_REORDER_INVALID`
- icon errors ending in `_REQUIRED`, `_EMPTY`, `_TOO_LARGE`, `_TYPE_UNSUPPORTED`, `_EXTENSION_UNSUPPORTED`, `_CONTENT_INVALID`, or `_NOT_FOUND`

Only reorder has Gateway idempotency. CRM OpenAPI currently places its idempotency annotation on icon upload instead of reorder; that annotation does not change Gateway runtime policy, and clients must follow the Gateway contract above. Re-read the catalogue after ambiguous create/update/delete/icon operations. Do not trust the declared MIME or filename; server validation remains authoritative.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/dto/acquisition-source.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.service.spec.ts`
- `../backend/mutakamel-apps/crm-app/src/database/provisioning/crm-tenant-provisioning.registry.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/security/mime-sniffer.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
- `docs/api/crm/common-contract.md`
- `src/app/(tenant)/crm/acquisition-sources/acquisition-source-contract.ts`
- `src/app/(tenant)/crm/acquisition-sources/acquisition-source-contract.test.ts`
