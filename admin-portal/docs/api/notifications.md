# Admin Notifications API

Status: **[Verified]**

Last source verification: **2026-08-12**

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
| `POST /api/admin/core/v1/notifications/device-tokens` | Register push token |
| `DELETE /api/admin/core/v1/notifications/device-tokens/:id` | Revoke push token |
| `POST /api/admin/core/v1/notifications/mark-all-read` | Mark all read |
| `POST /api/admin/core/v1/notifications/read-all` | Mark all read alias |
| `POST /api/admin/core/v1/notifications/:id/read` | Mark one read |
| `POST /api/admin/core/v1/notifications/:id/ack` | Acknowledge alias |
| `POST /api/admin/core/v1/notifications/:id/acknowledge` | Acknowledge |
| `POST /api/admin/core/v1/notifications/:id/dismiss` | Dismiss |
| `DELETE /api/admin/core/v1/notifications/:id` | Dismiss alias |

Use authoritative response statuses from the controller; several one-item
actions return `204` with no body.

## Runtime policy

Read `/notifications/config` before enabling push or realtime. Admin Realtime
remains gated, so the current implementation target is REST polling with
visible refresh/retry state. Do not activate an Admin Socket.IO client from
this documentation work.

Device/push tokens are sensitive browser-bound values. Do not log or expose
them in UI fixtures.

## Current frontend status

All 14 routes are source-integrated. The navbar reads authoritative unread
count and recent notifications; `/notifications` owns the cursor-paginated
inbox, single and bulk read/acknowledge/dismiss/delete actions, configuration,
preferences, and device-token management. The UI applies exact read/manage
permissions, 204 handling, bounded refresh/error states, bilingual copy, and
focused tests. REST is authoritative; Admin Realtime remains separately gated.

## Source map

- `../backend/mutakamel-apps/core-app/src/admin/notifications/`
- `../backend/mutakamel-apps/core-app/src/admin/notifications/dto/`
- `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
