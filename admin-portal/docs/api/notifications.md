# Admin Notifications API

Status: **[Verified]**

Last source verification: **2026-10-18** (CORE-NOTIF-DEAD-001 canonical actions)

Owner: **Core**

## Read routes

| Method and canonical browser path | Permission |
| --- | --- |
| `GET /api/admin/core/v1/notifications` | `admin.notifications.read` |
| `GET /api/admin/core/v1/notifications/unread-count` | `admin.notifications.read` |
| `GET /api/admin/core/v1/notifications/config` | `admin.notifications.read` |
| `GET /api/admin/core/v1/notifications/preferences` | `admin.notifications.read` |

Inbox query:

```ts
interface NotificationQuery {
  limit?: number; // 1..50
  cursor?: string;
  unreadOnly?: boolean;
}
```

Use the opaque cursor returned by Core. Do not reinterpret it as page/offset.

## Management routes

All routes below require `admin.notifications.manage`:

| Method and canonical browser path | Purpose |
| --- | --- |
| `PUT /api/admin/core/v1/notifications/preferences` | Replace/update preferences |
| `POST /api/admin/core/v1/notifications/read-all` | Mark all read |
| `POST /api/admin/core/v1/notifications/:id/read` | Mark one read |
| `POST /api/admin/core/v1/notifications/:id/acknowledge` | Acknowledge |
| `DELETE /api/admin/core/v1/notifications/:id` | Dismiss |

Each action has one route; the compatibility controls and aliases are removed
under D-068. Use authoritative response statuses from the controller; several one-item
actions return `204` with no body.

## Runtime policy

`GET /notifications/config` returns only `enabled`, `inAppEnabled`,
`realtimeEnabled`, `previewLimit` (1..20), and `pollIntervalMs` (5000..3600000).
The header bell accepts this projection and polls unread counts at that interval
when notifications and in-app delivery are enabled. Admin Realtime
remains gated, so the current implementation target is REST polling with
visible refresh/retry state. Do not activate an Admin Socket.IO client from
this documentation work.

`PUT /notifications/preferences` sends exactly `{ notificationType,
inAppEnabled }`; the response and preference-list entries add `updatedAt`.
The notification type is trimmed, required and limited to 128 characters.
The page edits only in-app preferences. Push/email preferences, quiet hours,
Firebase configuration and device-token management are retired from this client.

## Current frontend status

The supported routes are source-integrated. The navbar reads authoritative unread
count and recent notifications; `/notifications` owns the cursor-paginated
inbox, single and bulk read, acknowledge and recipient-dismiss actions, configuration,
and in-app preferences. The UI applies exact read/manage
permissions, 204 handling, bounded refresh/error states, bilingual copy, and
focused tests. REST is authoritative; Admin Realtime remains separately gated.
Typecheck, lint, tests and authenticated runtime verification remain pending
lead verification for this contract update.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/notifications/`
- `../backend/mutakamel-apps/core-app/src/admin/notifications/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
