# Core — Notifications

Status: **verified**

Last source verification: **2026-08-28**

Owning app: **core-app** (delivery effects performed by `worker-app`)

Canonical prefix: `/api/tenant/core/v1/notifications`

Upstream: `/tenant/notifications`

Portal status: **partial** — list, read, read-all and realtime are live. Nine
of the fourteen routes are not used.

Source inspected:
`core-app/src/tenant/notifications/notifications.controller.ts`,
`tenant-portal/src/lib/notifications/tenant-notification-runtime.ts`,
`tenant-portal/src/context/TenantRealtimeProvider.tsx`.

## Routes — all 14

| Method | Canonical path | Permission | Status |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/notifications` | `notifications.notification.read` | 200 |
| GET | `/api/tenant/core/v1/notifications/unread-count` | `notifications.notification.read` | 200 |
| GET | `/api/tenant/core/v1/notifications/config` | `notifications.notification.read` | 200 |
| POST | `/api/tenant/core/v1/notifications/:id/read` | `notifications.notification.read` | **204** |
| POST | `/api/tenant/core/v1/notifications/read-all` | `notifications.notification.read` | 200 |
| POST | `/api/tenant/core/v1/notifications/mark-all-read` | `notifications.notification.read` | 200 |
| POST | `/api/tenant/core/v1/notifications/:id/acknowledge` | `notifications.notification.read` | **204** |
| POST | `/api/tenant/core/v1/notifications/:id/ack` | `notifications.notification.read` | **204** |
| POST | `/api/tenant/core/v1/notifications/:id/dismiss` | `notifications.notification.read` | **204** |
| DELETE | `/api/tenant/core/v1/notifications/:id` | `notifications.notification.read` | **204** |
| GET | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.read` | 200 |
| PUT | `/api/tenant/core/v1/notifications/preferences` | `notifications.preference.manage` | 200 |
| POST | `/api/tenant/core/v1/notifications/device-tokens` | `notifications.device_token.manage` | 200 |
| DELETE | `/api/tenant/core/v1/notifications/device-tokens/:id` | `notifications.device_token.manage` | **204** |

> **Correction, 2026-08-28.** An earlier version of this page listed only three
> routes and described them as "authenticated". Both were wrong: notifications
> are permission-gated, and three distinct permissions are involved. Everything
> in the table above is read from the controller decorators.

## Three permissions, not one

| Permission | Covers |
| --- | --- |
| `notifications.notification.read` | Reading, marking read, acknowledging, dismissing, deleting |
| `notifications.preference.read` | Reading delivery preferences |
| `notifications.preference.manage` | Writing delivery preferences |
| `notifications.device_token.manage` | Registering and removing push device tokens |

A user can hold `notification.read` without `preference.read`. Gate the
preferences screen separately from the dropdown.

Note that `notification.read` also authorises **destructive** actions
(`dismiss`, `DELETE /:id`) — there is no separate delete permission. Confirm
before deleting; the permission will not stop it.

## Duplicate route families

Two pairs do the same job. Pick one and use it consistently:

| Pair | Use |
| --- | --- |
| `POST /read-all` · `POST /mark-all-read` | **`/read-all`** — it is what the portal already calls |
| `POST /:id/acknowledge` · `POST /:id/ack` | **`/:id/acknowledge`** — `/ack` is the abbreviation alias |

Do not mix them in one client.

## GET /unread-count

Returns the authoritative unread count.

**This is the badge's source of truth after a cold load.** The realtime runtime
maintains the count live once connected, but on first paint — and after any
reconnect where events were missed — the count must come from here, not from
counting the loaded page. A page is not the whole set.

## GET /config

Server-declared notification configuration (channels available, categories).
Read it before rendering a preferences screen rather than hardcoding the
channel list.

## POST /:id/read

Returns **`204` with no body.** Do not expect the updated notification back —
update optimistically and reconcile from the next resync.

## dismiss vs delete

| Action | Effect |
| --- | --- |
| `POST /:id/dismiss` | Removes it from the user's active list; recoverable server-side |
| `DELETE /:id` | Deletes it |

Neither is currently surfaced in the portal. If you add them, `DELETE` needs a
confirm; `dismiss` does not.

## Preferences

`GET` then `PUT` — the write is a **`PUT`**, so it replaces the preferences
document. Send the full object; a partial body clears what you omit.

Not built. Requires its own screen and its own permission gate.

## Device tokens

Push registration for mobile clients. **The browser is not a device-token
client** — the tenant portal registers `clientType: "WEB"` sessions and
receives notifications over the realtime connection, not push. Do not call
these from this app.

## The runtime already exists

`src/lib/notifications/tenant-notification-runtime.ts` (876 lines) is a
Zod-validated store handling ordering, deduplication, unread counting and
cursor-based resync. It is part of the spine and **is not rewritten** during
the design-system work.

```ts
tenantNotificationRuntime.subscribe
tenantNotificationRuntime.getSnapshot
resyncTenantNotifications(cursor, generation)
markTenantNotificationRead(id)
markAllTenantNotificationsRead()
```

The rebuild replaces only the dropdown's **markup**.

## Realtime

`TenantRealtimeProvider` connects through `@mutakamel/realtime-app-client`:

| Event | Effect |
| --- | --- |
| `session.ready.v1` | Connection established for a generation |
| `notification.created.v1` | Insert, ordered |
| `notification.updated.v1` | Update in place |
| `notification.unread-count-changed.v1` | Update the badge |
| `realtime.sync.required.v1` | Trigger a cursor resync |
| `system.server-draining.v1` | Prepare to reconnect |

The connection is **fenced to the auth generation** — a socket opened under a
previous session cannot deliver into the current one. That is why
`TenantRealtimeProvider` sits inside `TenantAuthProvider`.

Realtime is an optimization, never the source of truth. On reconnect, resync
from the cursor and refresh `unread-count`.

## Frontend notes

- Notification body text is **server-supplied and already localized** by
  request language. Display it; never parse it. Surrounding chrome comes from
  the dictionary.
- Timestamps render through `Intl` with the active locale.
- Marking read is optimistic with rollback.

## Async ownership

`worker-app` performs delivery but is **never** called from the browser. A
`202` from any command route is not completion.

## Portal status

| Capability | Status |
| --- | --- |
| List with cursor resync | live |
| Mark one read | live |
| Mark all read (`/read-all`) | live |
| Unread badge | live via realtime — **`/unread-count` not wired for cold load** |
| Realtime insert/update/count | live |
| Topbar dropdown | live — markup replaced in phase 3 |
| `/config` | not used |
| Acknowledge / dismiss / delete | not used |
| Preferences screen | not started |
| Device tokens | not applicable to the browser |
