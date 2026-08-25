# CRM notes and attachments

> Status: `verified-current`
> Last source verification: `2026-07-25`
> Owner: CRM (`crm-app`)
> Canonical browser prefix: `/api/tenant/crm/v1`
> Controller-relative prefix: `/api/v1/crm`
> Tenant Portal replacement: `not-started`
> Historical consolidated frontend: `absent-from-current-checkout`
> Authorship: hand-written from current backend source; historical frontend evidence is non-authoritative

Notes and private attachments are branch-scoped child records of CRM sources. Use the authorized upload/download routes; do not construct storage URLs.

## Endpoint catalogue

| Method | Canonical browser path | Controller/upstream path | Permission | Success |
|---|---|---|---|---|
| `POST` | `/api/tenant/crm/v1/notes` | `/api/v1/crm/notes` | `crm.notes.create.{own|team|all}` | `201`, note |
| `GET` | `/api/tenant/crm/v1/notes` | `/api/v1/crm/notes` | `crm.notes.read.{own|team|all}` | `200`, page |
| `PATCH` | `/api/tenant/crm/v1/notes/:id` | `/api/v1/crm/notes/:id` | `crm.notes.update.{own|team|all}` | `200`, note |
| `DELETE` | `/api/tenant/crm/v1/notes/:id` | `/api/v1/crm/notes/:id` | `crm.notes.delete.{own|team|all}` | `204` |
| `POST` | `/api/tenant/crm/v1/attachments` | `/api/v1/crm/attachments` | `crm.attachments.create.{own|team|all}` | `201`, metadata |
| `POST` | `/api/tenant/crm/v1/attachments/upload` | `/api/v1/crm/attachments/upload` | `crm.attachments.create.{own|team|all}` | `201`, attachment |
| `GET` | `/api/tenant/crm/v1/attachments` | `/api/v1/crm/attachments` | `crm.attachments.read.{own|team|all}` | `200`, page |
| `GET` | `/api/tenant/crm/v1/attachments/:id/download` | `/api/v1/crm/attachments/:id/download` | `crm.attachments.read.{own|team|all}` | `200`, private stream |
| `DELETE` | `/api/tenant/crm/v1/attachments/:id` | `/api/v1/crm/attachments/:id` | `crm.attachments.delete.{own|team|all}` | `204` |

Creates/lists require branch access. Detail mutations and download resolve the stored record's branch and owner/team scope. A source must exist inside the same branch.

## Source enums

- Note `sourceType`: `LEAD`, `CUSTOMER_PROFILE`, `PARTY`, `OPPORTUNITY`, `ACTIVITY`
- Attachment `sourceType`: note values plus `NOTE`

## Notes

Create requires UUIDv7 `branchId`, `sourceType`, UUIDv7 `sourceId`, and nonempty `body` up to 20,000 characters. Update accepts only the same validated `body`.

List requires UUIDv7 `branchId` and common pagination. `sourceType` and `sourceId` are optional only as a pair:

- omit both for all visible notes in the branch;
- send both to list one source;
- sending only one fails validation.

Note bodies are user-authored text. Render them as text or through an explicitly safe formatter; do not inject them as trusted HTML.

## Attachment upload

Preferred route: multipart `POST /attachments/upload` with exactly these form fields:

| Field | Contract |
|---|---|
| `file` | one binary file, nonempty, maximum 25 MiB |
| `branchId` | UUIDv7 |
| `sourceType` | attachment source enum |
| `sourceId` | UUIDv7 |

Current authoritative MIME allowlist:

```text
image/png
image/jpeg
image/webp
application/pdf
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.openxmlformats-officedocument.wordprocessingml.document
text/csv
text/plain
```

The service validates declared MIME, extension where applicable, content signature, size before/during storage, safe object key, source, and branch. A client-side check is only early feedback.

The [Static data](./static-data.md) attachment policy currently disagrees with this controller/shared-storage policy: it advertises some old formats and omits `WEBP`/`CSV`. Until corrected, this page and the upload response are authoritative.

## Attachment metadata route

`POST /attachments` registers an already-stored object and requires:

| Field | Contract |
|---|---|
| `branchId`, `sourceId` | UUIDv7 |
| `sourceType` | attachment source enum |
| `storageKey` | nonempty, maximum 256 |
| `fileName` | nonempty, maximum 180 |
| `mimeType` | nonempty, maximum 120 |
| `sizeBytes` | integer `1..26,214,400` |

This route is exposed, but normal portal file selection should use `/attachments/upload`. Never accept an arbitrary user-entered `storageKey`, expose it in UI, or turn it into a public URL.

## List, download, and deletion

Attachment list has the same paired source filters and common page shape as notes. Download returns a private binary stream with restrictive caching and a safe `Content-Disposition`. Treat the response filename as untrusted metadata and avoid persisting private blobs longer than necessary.

Delete returns no body and removes the CRM attachment relationship/storage object according to the service lifecycle.

No route here has Gateway idempotency. Do not blindly retry upload/metadata create/delete after an ambiguous response; re-list the source first.

## Responses and errors

JSON responses are raw projections. Attachment records include server ID, branch/source, safe metadata, size/MIME, actor/timestamps, and an authorized access mechanism as applicable. Do not make `storageKey` a client contract.

Important errors:

- `CRM_NOTE_NOT_FOUND`
- `CRM_ATTACHMENT_NOT_FOUND`
- `CRM_SOURCE_NOT_FOUND`
- `CRM_SOURCE_BRANCH_MISMATCH`
- `CRM_ATTACHMENT_FILE_REQUIRED`
- `CRM_ATTACHMENT_FILE_EMPTY`
- `CRM_ATTACHMENT_FILE_TOO_LARGE`
- `CRM_ATTACHMENT_FILE_TYPE_UNSUPPORTED`
- `CRM_ATTACHMENT_FILE_NOT_FOUND`
- `CRM_ATTACHMENT_INVALID`

Multipart parser failures may surface as `413` or `415`. A not-found response can conceal a source/record outside the actor's branch or scope.

## Safe upload example

```ts
const form = new FormData();
form.set("file", file);
form.set("branchId", branchId);
form.set("sourceType", "OPPORTUNITY");
form.set("sourceId", opportunityId);

await fetch("/api/tenant/crm/v1/attachments/upload", {
  method: "POST",
  credentials: "include",
  cache: "no-store",
  body: form,
});
```

Do not manually set multipart `Content-Type`; the browser must add its boundary.

## Sources

- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/notes-attachments.controller.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/dto/notes-attachments.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/dto/list-by-owner-query.dto.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/notes-attachments.service.ts`
- `../backend/mutakamel-apps/crm-app/src/crm/notes-attachments/notes-attachments.service.spec.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts`
- `../backend/mutakamel-apps/shared-libs/packages/storage/src/security/mime-sniffer.ts`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/crm.route-contracts.ts`
