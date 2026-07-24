# Notifications API — `/admin/notifications`

Browser prefix: `/api/admin/core/v1`. The `/admin/...` forms below are Core
controller-relative paths, not browser request URLs.

Base Path: `admin/notifications`
Guard: `AdminGuard`

---

## GET `/admin/notifications/config` — Get Runtime Config
**Permission**: `admin.notifications.read`

### Frontend Notes
- Check before initializing push/realtime clients
- Fall back to polling when realtime is disabled

---

## GET `/admin/notifications` — List Notifications
**Permission**: `admin.notifications.read`

### Query Parameters — `NotificationQueryDto`
```typescript
{
  limit?: number;       // 1-50, default 20
  cursor?: string;      // Opaque pagination cursor
  unreadOnly?: boolean;
}
```

### Frontend Notes
- Use `nextCursor` for infinite scroll
- `unreadOnly=true` for badge-backed inbox filters

---

## GET `/admin/notifications/unread-count` — Unread Count
**Permission**: `admin.notifications.read`

### Response
```typescript
{ count: number }
```

---

## GET `/admin/notifications/preferences` — List Preferences
**Permission**: `admin.notifications.read`

---

## PUT `/admin/notifications/preferences` — Upsert Preference
**Permission**: `admin.notifications.manage`

---

## POST `/admin/notifications/device-tokens` — Register Device Token
**Permission**: `admin.notifications.manage`

---

## DELETE `/admin/notifications/device-tokens/:id` — Revoke Device Token
**Permission**: `admin.notifications.manage`

---

## POST `/admin/notifications/mark-all-read` — Mark All Read
**Permission**: `admin.notifications.manage`

### Response
```typescript
{ updated: number }
```

---

## POST `/admin/notifications/read-all` — Mark All Read (Alias)
**Permission**: `admin.notifications.manage`

---

## POST `/admin/notifications/:id/read` — Mark One Read
**Permission**: `admin.notifications.manage`
**HTTP Status**: 204

---

## POST `/admin/notifications/:id/acknowledge` — Acknowledge
**Permission**: `admin.notifications.manage`
**HTTP Status**: 204

---

## POST `/admin/notifications/:id/dismiss` — Dismiss
**Permission**: `admin.notifications.manage`
**HTTP Status**: 204

---

## DELETE `/admin/notifications/:id` — Dismiss (Alias)
**Permission**: `admin.notifications.manage`
**HTTP Status**: 204
