# Known Frontend Gaps

Last source verification: **2026-08-12**

The exhaustive evidence and status history are in the
[Core Admin UI parity audit](../audit/core-admin-ui-gap-audit-2026-08-12.md)
and [capability matrix](../audit/frontend-capability-matrix.md).

## Core Admin web route gaps

None. Current Admin Portal source has exact reachable production calls for all
240 Core Admin routes: **240 direct, 0 equivalent, 0 missing**.

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
- Admin Realtime Socket.IO activation remains gated; notifications use the
  integrated REST contract.
- Worker Backup package/schema adoption and authenticated runtime evidence are
  separate release blockers from Core Admin parity.
- Flutter Admin is not at parity and cannot safely use the Web-only browser
  cookie authentication channel. Mobile implementation requires an authorized
  backend mobile Admin authentication contract.

## Backend/tooling verification limitation

The local Gateway dependency directory cannot currently be restored because
private GitHub Packages returns 401 without `NODE_AUTH_TOKEN`. Static
Core/Gateway Admin reconciliation is complete; Gateway test execution remains
credential-dependent. No backend source was changed by this frontend task.
