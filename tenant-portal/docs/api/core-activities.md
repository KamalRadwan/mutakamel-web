# Core activities: reminder settings

Verified against Core/Worker source on 2026-10-19. Runtime checks pending lead verification.

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
