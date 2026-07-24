# Tenant Activities API

Base paths:
- `/tenant/activities`
- `/tenant/activity-types`

This module manages system and user activities (tasks, events, log entries), their assignments, and their lifecycles.

## Activity Types

### `GET /tenant/activity-types`
Returns the available activity types for the tenant.
- **Permissions**: `activities.read`
- **Response**: `200 OK`

## Activities

### `POST /tenant/activities`
Creates a new activity.
- **Permissions**: `activities.create`
- **Headers**: `x-idempotency-key`
- **Body**: `CreateActivityDto`
- **Response**: `201 Created`

### `GET /tenant/activities`
Lists activities with pagination and filtering.
- **Permissions**: `activities.read`
- **Queries**: Pagination, filtering
- **Response**: `200 OK` (Paginated)

### `GET /tenant/activities/assignees`
Returns potential assignees for activities.
- **Permissions**: `activities.assign`
- **Response**: `200 OK`

### `GET /tenant/activities/:id`
Retrieves details of a specific activity.
- **Permissions**: `activities.read`
- **Response**: `200 OK`

### `PATCH /tenant/activities/:id`
Updates an existing activity.
- **Permissions**: `activities.update`
- **Headers**: `If-Match` (Requires strong ETag), `x-idempotency-key`
- **Body**: `UpdateActivityDto`
- **Response**: `200 OK`

### `POST /tenant/activities/:id/complete`
Marks an activity as completed.
- **Permissions**: `activities.complete`
- **Headers**: `If-Match` (Requires strong ETag), `x-idempotency-key`
- **Body**: `CompleteActivityDto`
- **Response**: `200 OK`

### `POST /tenant/activities/:id/cancel`
Cancels an activity.
- **Permissions**: `activities.cancel`
- **Headers**: `If-Match` (Requires strong ETag), `x-idempotency-key`
- **Body**: `CancelActivityDto`
- **Response**: `200 OK`
