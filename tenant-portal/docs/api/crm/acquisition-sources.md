# CRM acquisition sources

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Legacy frontend: `live`
> Authorship: hand-written from current source

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

## Validation

Create requires trimmed, nonempty `nameAr` and `nameEn`, each at most 120 characters. Optional `isActive` is a strict boolean. Update accepts the same fields optionally.

List optionally accepts strict boolean `isActive`; it is not paginated.

Reorder body is:

```json
{ "orderedIds": ["<uuid-v7>", "<uuid-v7>"] }
```

The array must be nonempty, unique, UUIDv7, and exactly represent all current nondeleted sources. Reorder requires a UUIDv7 `x-idempotency-key`.

## Icon upload and download

Upload is multipart with exactly one `file`, maximum 2 MiB. Accepted MIME values:

```text
image/png
image/jpeg
image/x-icon
image/vnd.microsoft.icon
```

The extension must match the allowed format and content sniffing must pass. The file cannot be empty. The service stores an authorized icon reference and returns a source/icon projection.

Download returns the private icon stream with restrictive cache behavior. Use the returned `iconUrl` or the authorized route. Never expose or derive a storage key.

## Seed catalogue

Fresh tenants receive 12 sources ordered in increments of 10:

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

JSON successes are raw projections. Delete has no body. Icons are streams, not JSON. Source labels are tenant-authored text.

Important errors:

- `CRM_ACQUISITION_SOURCE_NOT_FOUND`
- `CRM_ACQUISITION_SOURCE_IN_USE`
- `CRM_ACQUISITION_SOURCE_INACTIVE`
- `CRM_ACQUISITION_SOURCE_NAME_TAKEN`
- `CRM_ACQUISITION_SOURCE_REORDER_INVALID`
- icon errors ending in `_REQUIRED`, `_EMPTY`, `_TOO_LARGE`, `_TYPE_UNSUPPORTED`, `_EXTENSION_UNSUPPORTED`, `_CONTENT_INVALID`, or `_NOT_FOUND`

Only reorder has Gateway idempotency. Re-read the catalogue after ambiguous create/update/delete/icon operations. Do not trust the declared MIME or filename; server validation remains authoritative.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/dto/acquisition-source.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/acquisition-sources/acquisition-sources.service.spec.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/security/mime-sniffer.ts`
- `../backend/mutakamel-apps/crm-app/packages/database/src/seeds/v0.0.1/catalogue.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
