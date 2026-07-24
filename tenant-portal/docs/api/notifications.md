# Tenant Notifications API

Base paths:
- `/tenant/notifications`
- `/tenant/email-config`

This module manages in-app notifications, push notifications, user preferences, and the tenant's custom SMTP email configuration.

## Custom Email Configuration

### `GET /tenant/email-config`
Returns the custom SMTP configuration for the tenant.
- **Permissions**: `workspace.email.read`
- **Response**: `200 OK`

### `PATCH /tenant/email-config`
Updates the custom SMTP configuration.
- **Permissions**: `workspace.email.manage`
- **Headers**: `If-Match` (requires strong revision number)
- **Response**: `200 OK`

### `POST /tenant/email-config/verify`
Sends a test email to verify the current configuration.
- **Permissions**: `workspace.email.manage`
- **Headers**: `If-Match`
- **Response**: `200 OK`

### `POST /tenant/email-config/verify-connection`
Tests the SMTP connection without sending an email.
- **Permissions**: `workspace.email.manage`
- **Response**: `200 OK`

## Inbox & Notifications

### `GET /tenant/notifications/config`
Returns notification feature flags and client runtime settings for the tenant portal.
- **Permissions**: `notifications.notification.read`
- **Response**: `200 OK`

### `GET /tenant/notifications`
Returns notifications for the authenticated tenant user using cursor pagination.
- **Permissions**: `notifications.notification.read`
- **Queries**: `limit`, `cursor`, `unreadOnly`
- **Response**: `200 OK` (Paginated Inbox)

### `GET /tenant/notifications/unread-count`
Returns the unread notification count for the authenticated tenant user.
- **Permissions**: `notifications.notification.read`
- **Response**: `200 OK`

### `POST /tenant/notifications/mark-all-read`
Marks all current notifications as read for the authenticated tenant user.
- **Permissions**: `notifications.notification.read`
- **Response**: `200 OK` (Returns updated count)

### `POST /tenant/notifications/:id/read`
Marks one notification as read for the authenticated tenant user.
- **Permissions**: `notifications.notification.read`
- **Response**: `204 No Content`

### `POST /tenant/notifications/:id/acknowledge`
Acknowledges one notification and also records it as read.
- **Permissions**: `notifications.notification.read`
- **Response**: `204 No Content`

### `POST /tenant/notifications/:id/dismiss`
Dismisses one notification for the authenticated tenant user without deleting the notification globally.
- **Permissions**: `notifications.notification.read`
- **Response**: `204 No Content`

## Preferences & Devices

### `GET /tenant/notifications/preferences`
Returns channel preferences for the authenticated tenant user.
- **Permissions**: `notifications.preference.read`
- **Response**: `200 OK`

### `PUT /tenant/notifications/preferences`
Creates or updates channel preferences for one tenant notification type.
- **Permissions**: `notifications.preference.manage`
- **Body**: `UpsertNotificationPreferenceDto`
- **Response**: `200 OK`

### `POST /tenant/notifications/device-tokens`
Registers or refreshes a push notification device token for the authenticated tenant user.
- **Permissions**: `notifications.device_token.manage`
- **Body**: `RegisterDeviceTokenDto`
- **Response**: `201 Created`

### `DELETE /tenant/notifications/device-tokens/:id`
Revokes a device token owned by the authenticated tenant user.
- **Permissions**: `notifications.device_token.manage`
- **Response**: `204 No Content`
