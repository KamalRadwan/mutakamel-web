# Known Frontend Gaps

Last source verification: **2026-09-09** (Addon/commercial scope amendment).

The exhaustive evidence and status history are in the
[Core Admin UI parity audit](../audit/core-admin-ui-gap-audit-2026-08-12.md)
and [capability matrix](../audit/frontend-capability-matrix.md).

## Core Admin web route gaps

The historical 240-route baseline had **240 direct, 0 equivalent, 0 missing**.
New Addon/commercial contracts expand the current inventory and are not covered
by that parity claim. See the [Addon contract boundary](../api/application-addons-target.md)
and [Admin receipt](../plans/application-catalogue-frontend-track.md).
Catalogue forms, full canonical subscription directory/detail/items, purpose-based invoice detail and reviewed initial tenant creation/first-subscription seed are source-integrated.
Aggregate preparation, preview/apply, operation recovery and original receipt lookup are mounted in tenant billing. Governed definition adoption and final integrated runtime acceptance remain open. Commercial negotiation, legacy read/evidence fallbacks and scalar plan-change commands have been removed. Mobile/Partner are excluded,
not release blockers.

This closes the former false/missing claims for tenant FQDN and access methods,
wallet adjustments, forgot password, invite/reset/logout-all, self profile,
notifications, reports, subscriptions, invoices, logging, audit, and all
provisioning-governance routes.

## Remaining web verification

- UI-022 is complete: a TypeScript AST scan found 151 production Axios write
  calls and 0 bare/implicit-policy calls. Idempotent writes own stable UUIDv7
  intents; non-idempotent calls explicitly opt out and are non-replayable.
  Focused validation passed 6 files/64 tests, TypeScript `--noEmit`, and scoped
  ESLint; a transport test asserts raw auth/activity calls omit unsupported
  idempotency headers.
- Run the full test, typecheck, strict lint, build, and documentation suite after
  the working tree settles.
- Exercise representative read, write, critical, forbidden, validation,
  timeout, and reconciliation paths through an authenticated Gateway/Core
  session.
- Verify the deployed build separately. Source parity is not deployment or
  release-readiness proof.

## External and gated work

- Existing-tenant Storage Server migration is historical design only: its eight
  proposed routes are absent from current Core/Gateway source.
- Storage Server credential rotations have no read projection. Core returns a
  rotation's id once, from the command that starts it, then requires that id to
  revoke the old key hours later; no route lists or reads rotations, and the
  server projection carries no rotation state. The portal keeps the handle in
  the operator's own browser as a stopgap
  ([contract](../api/storage-servers.md#credential-rotation-has-no-read-projection)),
  which cannot help a different browser or survive cleared site data. Closing
  this needs the rotation exposed on the storage-server read route.
- Admin Realtime Socket.IO activation remains gated; notifications use the
  integrated REST contract.
- Worker Backup package/schema adoption and authenticated runtime evidence are
  separate release blockers from Core Admin parity.
- Mobile and Partner are outside the user's active scope and are not inspected,
  implemented, tested or used as release blockers by this track.

## Historical backend/tooling verification limitation

An earlier task recorded a private-registry credential failure. That historical
observation is not evidence of a current blocker: the coordinator owns current
package publication/adoption and Gateway execution evidence. This Admin track
does not print registry credentials, edit backend source or claim backend
verification from its frontend tests.
