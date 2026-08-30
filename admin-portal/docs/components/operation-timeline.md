# Component Specification: `OperationTimeline`

Status: **[Approved target; current implementation is presentation-only]**

Last source verification: **2026-08-29**

## Purpose and authority

`OperationTimeline` presents an ordered sequence of operation steps. The current
shared component accepts `steps`, `title`, and `description`; it does not own
operation fetching, permissions, retry, cancel, or progress reconciliation.

The [Tenant operations API contract](../api/tenant-operations.md) is
authoritative for wire statuses, permission combinations, retry/cancel
availability, polling, and terminal behavior. This component must not copy a
partial permission or enum list.

## Target composition

- Route/container owns operation identity, freshness, polling, and actions.
- Timeline receives localized, already-authorized presentation steps.
- Retry and cancel render outside or in a composable action slot governed by the
  domain contract and [Operational UX](../design-system/operational-ux.md).
- Operation, correlation, and idempotency evidence uses the shared copyable code
  treatment.

## Step presentation

Each step communicates:

- localized name and optional description;
- semantic status label;
- start/end timestamp with explicit timezone;
- safe progress or evidence text when available;
- failure/recovery relationship when the domain exposes it.

Success uses emerald; warning uses amber; failure uses red; pending/running uses
neutral structure plus text and optional motion. Color and motion are never the
only status signals. Under reduced motion, running indicators become static but
remain labelled.

## State and freshness

- Initial loading reserves the sequence layout.
- Polling keeps existing steps mounted and announces only meaningful status
  changes.
- Disconnected/stale polling shows the last authoritative update.
- Partial failure keeps completed and safe evidence visible.
- Terminal failure identifies the failed step and valid recovery route.
- Conflict and cancellation are not collapsed into generic failure.

## Accessibility and responsive behavior

- The step sequence uses list semantics.
- Current step/status is expressed in text and programmatic state.
- Expandable evidence is keyboard operable with focus return.
- Narrow screens stack timestamps/evidence without shrinking type below the
  bilingual floor.
- The timeline itself does not create competing live regions for every step.

## Current documentation correction

Previous versions documented nonexistent `operationId`, progress, retry, and
cancel props on the shared component and used stale `/admin/...` page routes.
Those claims are superseded by this source-aligned boundary.
