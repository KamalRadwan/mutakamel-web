# Core — Notifications

Status: **verified**

Last source verification: **2026-10-18**

Owning app: **core-app** (delivery effects performed by `worker-app`)

Canonical prefix: `/api/tenant/core/v1/notifications`

Upstream: `/tenant/notifications`

Portal status: **partial** — inbox, in-app preferences, and realtime are live.

The shell bell and notification REST reconciliation require
`notifications.notification.read` in the current session permission projection.
Without that grant, notification events are ignored and no shell notification
config, list or count requests run. Granting access hydrates the projection;
removing access clears cached items and the unread count. Session, connection
and other realtime lifecycle handling remain active independently.

Source inspected:
`core-app/src/tenant/notifications/notifications.controller.ts`,
`tenant-portal/src/lib/notifications/tenant-notification-runtime.ts`,
`tenant-portal/src/context/TenantRealtimeProvider.tsx`.

## Supported routes

| Method | Canonical path | Permission | Status |
| --- | --- | --- | --- |
| GET | `/api/tenant/core/v1/notifications` | `notifications.notification.read` | 200 |
| GET | `/api/tenant/core/v1/notifications/:id` | `notifications.notification.read` | 200 / 404 |
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

> **Correction, 2026-08-28.** An earlier version of this page listed only three
> routes and described them as "authenticated". Both were wrong: notifications
> are permission-gated, and three distinct permissions are involved. Everything
> in the table above is read from the controller decorators.

## Three permissions, not one

| Permission | Covers |
| --- | --- |
| `notifications.notification.read` | Reading, marking read, acknowledging, dismissing, deleting |
| `notifications.preference.read` | Reading in-app preferences |
| `notifications.preference.manage` | Writing in-app preferences |

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

## GET /:id

Verified **2026-10-17**: detail loading makes one recipient-scoped lookup, even
for notifications older than the first 250 inbox records or absent from the
realtime cache. Core uses the current tenant database and authenticated user;
unknown IDs, another recipient's IDs and dismissed notifications all return
`404 NOTIFICATION_NOT_FOUND` without notification content. No new permission,
schema or database privilege is needed.

The response is one `NotificationView` in Core's `data` envelope, with the same
fields as a list item. The portal validates its shape and requested ID. Only an
authoritative 404 renders not found; permission, network and invalid-response
errors remain failures. Reloads after read/acknowledge fetch current recipient
state through this lookup.

### Delivery channel labels (2026-10-17)

Notification detail resolves the canonical `IN_APP` wire channel through
`coreNotifications.wireChannelNames` in both Arabic and English. Preference
controls retain their separate `inApp` identifier and `channelNames` labels;
they are not wire-channel aliases. Unsupported channel codes retain the
translated unknown-code fallback and deduplicated warning. Push and email
delivery channels are not offered as supported labels.

## GET /unread-count

Returns the authoritative unread count.

The shell obtains the same authoritative unread projection from the notification
list response during cold loads and reconciliation. It never counts the loaded
page to derive the badge: a page is not the whole set. The dedicated count route
remains available to other consumers.

## GET /config

Server-declared notification configuration for in-app and realtime delivery.

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

Verified **2026-10-17**: the preferences hook loads `/config` and `/preferences`
together. `config.preferenceCatalogue` supplies the supported notification types
and their in-app defaults; persisted preferences override those defaults by type.
Only catalogue entries are offered, including when the user has no saved rows.
Missing or invalid catalogue data is a load error, never a guessed list of types.

The first toggle sends `PUT /preferences` with `notificationType` and
`inAppEnabled`, creating an override. The saved response updates the row; reload
merges the persisted override with the catalogue again. Read-only users see the
same effective values without writable controls. Tenant-wide channel switches
continue to disable the in-app controls when delivery is disabled.

Push, email, and quiet-hours preferences are not exposed until delivery for those
channels is implemented. Email remains disabled by default (D-067).

## Push and email delivery

Push device-token registration and push/email preferences are not supported.
The portal has no device-token UI and must not call device-token endpoints.

## The runtime already exists

`src/lib/notifications/tenant-notification-runtime.ts` (876 lines) is a
Zod-validated store handling ordering, deduplication, unread counting and
cursor-based resync. It is part of the spine and **is not rewritten** during
the design-system work.

```ts
tenantNotificationRuntime.subscribe
tenantNotificationRuntime.getSnapshot
resyncTenantNotifications(generation, cursor)
refreshTenantNotifications(generation, cursor)
markTenantNotificationRead(id)
markAllTenantNotificationsRead()
```

The shell uses `refreshTenantNotifications` to share REST requests and publish
loading, ready and retryable error states without changing the data revision.

### Socket-independent shell loading (2026-10-17)

For an authenticated generation with `notifications.notification.read`, the
provider initializes the cache through REST without waiting for a socket or
`session.ready.v1`. This also runs when realtime deployment mode is off.
Foreground focus, returning to a visible page, network recovery and opening
the bell reconcile through the same bounded REST reader; concurrent refreshes
share a request. There is no background polling loop. A mark-read mutation
reconciles after any request that began before its write.

The dropdown distinguishes loading, a successfully empty inbox, and a failed
load. Failures show `errors.notificationLoadFailed` in the active language and
a working Retry action. A failed refresh retains the previous items, unread
count and cursor. A REST 403 renders the existing `PermissionGate` instead of
the notification list. Generation changes clear the cache and its loading state;
late responses cannot populate a different session's cache. Users without read
authorization do not initialize the cache or see the bell.

### Bounded shell reconciliation (2026-10-17)

Recovery source reviewed **2026-10-18**: failed provider resyncs retain their
pending cursor and retry after 1, 2 and 4 seconds, including bounded convergence
failures caused by concurrent unread updates. Network failures, 408, 429 and 5xx
responses retry automatically; other HTTP failures require a recovery trigger.
After exhaustion, the translated error and Retry remain available. Focus and
online recovery restart the bounded sequence. Previously loaded rows stay
visible with a translated stale notice while refreshing or failed. Cleanup
cancels scheduled retries; obsolete generations cannot parse another page or
publish a late response. Automated verification is pending lead execution.

Initial hydration and reconnect reconciliation read at most ten pages of fifty
notifications per attempt. The recent window commits atomically even when Core
reports older history via `hasNext`; retained inboxes above 500 records do not
require a history crawl. The badge uses the list response's authoritative
`unreadCount`, `unreadRevision` and `unreadChangedAt`, independently of the
number of cached rows, and preserves a newer realtime unread revision.

Concurrent changes, including an unread revision advancing between REST pages,
retry within the existing three-attempt bound. Conflicting authority at the same
revision is rejected. Recipient
versions prevent stale reads or dismissals from replacing newer state, including
a read followed by cache eviction. Eviction is not treated as dismissal. REST
defines window membership and recipient cursor order; a delayed creation outside
a truncated window does not force older pages to load or displace recent rows.
Invalid or failed responses leave the prior cache and cursor intact.

## Realtime

### Shell connection feedback (2026-10-18)

The provider subscribes to the coordinator's generation-scoped connection
snapshot as well as application events. The shell reads the retained snapshot
on mount, including failures that occur before session readiness. Handshake
rejection, failed credential refresh and exhausted retries show stopped live
updates even while the browser remains online. Connecting and retry-wait states
show translated reconnecting feedback; deployment mode off remains quiet.

A newly blocked connection triggers REST session revalidation. The REST client
owns definitive session termination; a socket denial alone does not sign out the
user or restart a blocked generation. The stopped banner offers Reload, which
revalidates authorization through normal portal startup before reconnecting.
A replacement auth generation discards previous failure feedback, and a valid
session-ready event clears previous application stop and drain messages.
Superseded coordinator subscriptions are removed and cannot publish into the
new generation.

`TenantRealtimeProvider` connects through `@mutakamel/realtime-app-client`:

| Event | Effect |
| --- | --- |
| `session.ready.v1` | Connection established for a generation |
| `notification.created.v1` | Insert, ordered |
| `notification.updated.v1` | Update in place |
| `notification.unread-count-changed.v1` | Update the badge |
| `realtime.sync.required.v1` | Trigger a cursor resync |
| `system.server-draining.v1` | Prepare to reconnect |
| `system.access-revoked.v1` / `TOKEN_EXPIRED` | Coordinate one REST cookie refresh, then obtain fresh socket admission |

Verified **2026-10-17**: established-socket expiry recovers even if the expiry
warning is disabled or missed. The client delegates to the provider's existing
`coordinateTenantSessionRefresh` path, sharing concurrent REST refresh work.
The auth generation and logical presence session stay unchanged; presence
emission resumes only after a fresh validated `session.ready.v1`. The notification
cache is retained during refresh. A rejected refresh stops without looping.
Session invalidation, other access revocations, and tenant suspension remain
terminal for realtime and retain the existing REST revalidation policy.

The connection is **fenced to the auth generation** — a socket opened under a
previous session cannot deliver into the current one. That is why
`TenantRealtimeProvider` sits inside `TenantAuthProvider`.

Realtime is an optimization, never the source of truth. On reconnect, resync
from the cursor and refresh `unread-count`.

## Frontend notes

### Inbox pagination ownership (2026-10-17)

The inbox fences first-page and load-more responses by query generation and
the requested cursor. Changing the unread filter, refreshing, or unmounting
aborts superseded page requests. Late results and errors cannot alter the
current query's rows, cursor, unread count, or loading state, even if the
transport finishes after cancellation. Only one page request runs per query;
the unread filter remains usable while a load-more request is pending.

### Shared notification invalidation (2026-10-18)

The inbox and detail subscribe to runtime data invalidation, including recipient
updates outside the bounded shell window. Loading-status changes do not trigger
queries. Successful commands invalidate the open screens immediately and start
shell reconciliation after any pre-command refresh; realtime delivery is not
required to display the saved recipient state. Failed reconciliation retains the
shell's existing retryable error handling.

The inbox re-reads its loaded page depth through its own REST cursors and current
unread filter, committing the refreshed rows, count and next cursor together.
It keeps its historical pages independently of the shell cache. Superseded
queries are aborted and fenced. Detail invalidation always uses the ID lookup;
an older response cannot replace a newer lookup or successful command reload.

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
| Unread badge | live via authoritative REST list projection on cold load, then realtime and foreground reconciliation |
| Realtime insert/update/count | live |
| Topbar dropdown | live — markup replaced in phase 3 |
| `/config` | live for in-app and realtime flags |
| Acknowledge / dismiss / delete | not used |
| In-app preferences | live |
| Push/email preferences and device tokens | unavailable until delivery exists |
