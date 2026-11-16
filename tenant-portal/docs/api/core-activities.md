# Core activities: reminder settings

Status: **verified against source; runtime checks pending lead verification**

Last source verification: **2026-11-04**

The existing `POST /api/tenant/core/v1/activities` and
`PATCH /api/tenant/core/v1/activities/:id` accept optional
`reminderOffsetMinutes`: a JSON integer from 0 to 2147483647 or null. Null disables
the reminder; absent on PATCH preserves it. Zero sends at the start/due instant.
Use the existing UUIDv7 idempotency key and, on PATCH, the activity's `If-Match`.
The ordinary activity permissions and target/assignee authorization still apply.

Activity responses include `reminderOffsetMinutes` and read-only
`reminderSentAt` (ISO instant or null). Runtime validators reject malformed values
and sent evidence without an offset. The bilingual form stores a text input while
editing, validates whole nonnegative minutes, and sends numbers only at the API
boundary. Blank means disabled; clearing a stored offset sends explicit null.
The field is hidden when logging a completed activity.

Worker checks due reminders every minute in bounded tenant/activity batches.
Only live open activities are eligible. Notification persistence and the sent
marker commit together, so a retry keeps one IN_APP notification. Existing
in-app preferences and active-user policy apply. Changing due time, offset or
assignee re-arms the reminder; text edits preserve sent evidence. Fleet backlogs
or unavailable databases can delay delivery. This uses Core activities, including
lead TODOs; there are no CRM reminder routes or tables in the portal flow.

The workspace accepts a portal-only `activityId` UUIDv7 query parameter for
notification deep links. It loads the activity with the existing
`GET /api/tenant/core/v1/activities/:id` and opens the shared detail modal;
calendar filters do not have to contain the activity. Closing removes only
`activityId`, retaining the workspace filters. Invalid IDs make no read request;
missing read access, forbidden and missing activities retain their boundaries.
