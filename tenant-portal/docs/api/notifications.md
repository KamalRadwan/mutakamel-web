# Tenant notifications and email configuration API

> **Contract status:** Current; two backward-compatible notification aliases remain active
> **Last verified:** 2026-08-14
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefixes:** `/api/tenant/core/v1/notifications`, `/api/tenant/core/v1/email-config`
> **Controller-relative prefixes:** `/tenant/notifications`, `/tenant/email-config`
> **Tenant Portal status:** Notification inbox runtime tested; email configuration remains planned. The Portal consumes validated realtime events, acknowledges a delivery only after applying it to its bounded in-memory cache, performs atomic bounded REST recovery, and uses the canonical read mutations. Dated 2026-07-25 documentation referenced consolidated notification/email UI; that `mutakamel-web-app` workspace is absent from the current checkout and is not live-runtime evidence.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Notification controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/notifications` and `../backend/mutakamel-apps/core-app/src/common/notifications`
- Email controller/service/DTOs: `../backend/mutakamel-apps/core-app/src/tenant/email-config`
- Current Portal runtime: `src/lib/notifications/tenant-notification-runtime.ts`, `src/context/TenantRealtimeProvider.tsx`, and `src/components/layout/NotificationsDropdown.tsx`
- Historical consolidated-frontend references (absent from the current checkout): `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings` and `../backend/mutakamel-apps/mutakamel-web-app/src/shared`

## Security and envelopes

All routes require a tenant JWT, verified matching host, current session/subscription, and listed permission. Inbox rows and preferences are always scoped to the authenticated identity.

Unknown DTO fields are rejected. JSON successes/errors use the Core envelopes. Notification list pagination is cursor-based inside `data`:

```json
{
  "success": true,
  "data": {
    "items": [],
    "unreadCount": 0,
    "nextCursor": null,
    "hasNext": false
  },
  "correlationId": "019f9871-fd40-7680-bfbb-fd535b5880c8",
  "timestamp": "2026-07-25T12:00:00.000Z"
}
```

## Notification routes

| Method and canonical browser path | Permission | Contract |
|---|---|---|
| `GET /api/tenant/core/v1/notifications/config` | `notifications.notification.read` | Runtime feature/provider config |
| `GET /api/tenant/core/v1/notifications` | `notifications.notification.read` | Cursor inbox |
| `GET /api/tenant/core/v1/notifications/unread-count` | `notifications.notification.read` | `{unreadCount}` |
| `GET /api/tenant/core/v1/notifications/preferences` | `notifications.preference.read` | Current user preferences |
| `PUT /api/tenant/core/v1/notifications/preferences` | `notifications.preference.manage` | Upsert one type |
| `POST /api/tenant/core/v1/notifications/device-tokens` | `notifications.device_token.manage` | Register/refresh |
| `DELETE /api/tenant/core/v1/notifications/device-tokens/:id` | `notifications.device_token.manage` | `204`, own token only |
| `POST /api/tenant/core/v1/notifications/read-all` | `notifications.notification.read` | Preferred bulk-read path |
| `POST /api/tenant/core/v1/notifications/mark-all-read` | same | Active legacy alias |
| `POST /api/tenant/core/v1/notifications/:id/read` | `notifications.notification.read` | `204` |
| `POST /api/tenant/core/v1/notifications/:id/acknowledge` | same | Preferred acknowledge path; `204` |
| `POST /api/tenant/core/v1/notifications/:id/ack` | same | Deprecated-compatible alias; `204` |
| `POST /api/tenant/core/v1/notifications/:id/dismiss` | same | Preferred dismissal; `204` |
| `DELETE /api/tenant/core/v1/notifications/:id` | same | Active legacy dismissal alias; `204` |

Inbox query: `limit` default 20, integer 1–50; optional opaque `cursor`; optional strict `unreadOnly` boolean. Never inspect or modify a cursor.

Preference body:

- `notificationType`: required/non-empty, maximum 128.
- Optional booleans: `inAppEnabled`, `pushEnabled`, `emailEnabled`.
- Optional `quietHours`: object; its internal policy is server-owned, so preserve unknown existing keys rather than inventing a schema.

Device body: `provider=fcm|apns|web-push`, required non-empty `token` max 4,096, optional `deviceId` max 128, `platform` max 32, and `enabled` boolean. The response exposes `tokenHash`, never a reusable raw token.

Notification view fields are `id`, `sourceApp`, `notificationType`, `priority`, `title`, `body`, nullable `actionUrl`/entity fields, `channels`, metadata, and created/read/acknowledged/delivered timestamps. Treat action URLs as untrusted navigation input and allow only portal-owned destinations.

Safe inbox example:

```http
GET /api/tenant/core/v1/notifications?limit=20&unreadOnly=true
Cookie: __Host-mutakamel-tenant-access=<redacted>
```

## Tenant email configuration

| Method and canonical browser path | Permission | Headers/body |
|---|---|---|
| `GET /api/tenant/core/v1/email-config` | `workspace.email.read` | Returns `ETag: "<revision>"`; private/no-store |
| `PATCH /api/tenant/core/v1/email-config` | `workspace.email.manage` | Strong `If-Match`, UUIDv7 `X-Idempotency-Key`, partial body |
| `POST /api/tenant/core/v1/email-config/verify` | `workspace.email.manage` | Strong `If-Match`, UUIDv7 idempotency key, no body |
| `POST /api/tenant/core/v1/email-config/verify-connection` | `workspace.email.manage` | UUIDv7 idempotency key, no body |

Gateway classifies all three commands as write-sensitive and will not transport-retry without its replay contract. Generate one UUIDv7 key per exact command.

Provider/static wire values:

- `providerDriver`: `smtp|ses|sendgrid|platform-shared`.
- `status`: `ACTIVE|SUSPENDED`.
- `smtpProtocol`: `smtp|smtps`.
- Returned `credentialsMode`: `TENANT_VERSIONED_REF|TENANT_ENCRYPTED_SMTP|PLATFORM_SHARED`.

PATCH accepted fields:

| Field | Validation |
|---|---|
| `fromAddress` | string, max 320 |
| `fromName` | string, 1–200 |
| `replyTo` | nullable string, max 320 |
| `senderDomain` | string, max 253 |
| `providerDriver` | enum above |
| `providerCredentialsRef` | nullable string, max 512; not for SMTP |
| `smtpHost` | string, max 253 |
| `smtpPort` | integer 1–65,535 |
| `smtpSecure` | boolean |
| `smtpProtocol` | `smtp|smtps` |
| `smtpUsername` | string, max 320 |
| `smtpPassword` | string, 1–1,024; write-only |
| `dkimSelector` | nullable DNS-like lowercase selector, max 63 |
| `dailyQuota` | nullable integer 1–1,000,000 |
| `rateLimitPerMin` | nullable integer 1–10,000 |
| `status` | `ACTIVE|SUSPENDED` |

GET never returns raw credential references or passwords. It returns configuration flags/fingerprints such as `providerCredentialsConfigured`, `smtpPasswordConfigured`, revisions, verification state, and effective plan-capped quotas.

`If-Match` must be exactly one strong positive revision such as `"4"`. Missing returns `428 TENANT_EMAIL_CONFIG_PRECONDITION_REQUIRED`; malformed/stale returns `TENANT_EMAIL_CONFIG_STALE_REVISION`. Both GET and successful conditional commands return the current ETag.

Expected email errors also include empty/no-change patch, invalid provider/SMTP tuple, `TENANT_EMAIL_CONFIG_NOT_READY`, dependency/secret-reference failures, plan quota violations, forbidden verify body, and `TENANT_EMAIL_CONFIG_VERIFICATION_FAILED`.

## Cache, retry, and AI rules

- Treat notification/email reads as private tenant/user data; email config explicitly uses `no-store, private`.
- Update unread badges from server results; do not derive a durable count only from local list mutations.
- Realtime delivery receipts are sent only after a validated event is committed to the current authentication generation's in-memory cache. Duplicate delivery IDs must match the complete prior payload; conflicts trigger REST recovery without a receipt.
- REST recovery follows at most ten 50-item pages, rejects inconsistent cursors, duplicate rows, changing unread counts, malformed views, and partial results, and swaps the visible cache only after the complete bounded read succeeds.
- Authentication generation changes, logout, access revocation, and tenant unavailability clear the notification cache before stale data can be rendered to another account.
- Prefer `read-all`, `acknowledge`, and POST `dismiss` in new code; aliases are migration-only.
- Preserve the email ETag with form state. On conflict, refetch and show a merge decision.
- Never display, log, or echo SMTP passwords, provider references, device tokens, or notification metadata without field-level review.
- Notification actions and configuration verification are synchronous HTTP contracts; delivery itself is asynchronous and must be reflected only from later server state/events.
