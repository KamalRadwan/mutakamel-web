# AI Implementation Playbook

Last verified: **2026-07-25**

## Phase order

Build replacement capability in this order unless a dependency proves a
different order:

1. documentation/contract tooling;
2. original-host admission and not-found boundary;
3. shared Gateway proxy/path/error/envelope layer;
4. tenant auth/session/public action flows;
5. `/auth/me`, permission, organization scope, and module/seat bootstrap;
6. tenant shell and safe route admission;
7. Core workspace capabilities;
8. CRM capabilities;
9. Trade capabilities;
10. async rendering/update/payment/recovery journeys;
11. cutover and old-web retirement.

## Before editing

- Read `AGENTS.md` and current local Next.js docs.
- Check worktree status and preserve unrelated changes.
- Identify exact files in the new portal and old-web replacement source.
- Verify Gateway, controller, DTO, service, enum, and tests.
- Update the API page first when it is incomplete or stale.
- Decide current/target status; do not blend them.

## Feature structure

A nontrivial feature normally owns:

```text
src/features/<area>/<feature>/
  api/
  hooks/
  schemas/
  types/
  components/
  screens/
  tests beside source
```

Use only the folders needed. Keep TSX rendering separate from state/request
logic through feature hooks as required by workspace rules.

## API function

An API function must:

- call the shared client;
- use a canonical path;
- select Core-envelope, raw-CRM, or Trade-envelope parsing from that path;
- define narrow input/output types;
- preserve exact transport values;
- pass idempotency/concurrency evidence explicitly;
- avoid notifications/navigation/React state;
- expose metadata when ETag, Location, pagination, or replay matters.

## Schema

A client schema:

- mirrors the public DTO fields used by the feature;
- provides earlier/localized feedback;
- keeps optional and nullable distinct;
- keeps exact decimals as strings;
- maps UI values to transport values explicitly;
- never becomes authorization or business-state authority.

## Hook

A feature hook:

- owns query/mutation orchestration;
- binds cache keys to tenant/session and organization context;
- cancels stale work;
- maps authoritative capability/error state;
- retains command evidence for exact retry;
- keeps rendering concerns out.

## Page/screen

A page/screen must represent:

- loading;
- data;
- empty;
- invalid input;
- unauthenticated;
- forbidden;
- not found;
- conflict/stale;
- rate limited;
- service unavailable;
- partial/async processing where applicable.

Do not turn `403`, `409`, or `503` into an empty list.

## Mutations

1. Normalize/validate input.
2. Capture current resource/session/context.
3. Generate or retain the exact command idempotency key.
4. Submit once.
5. Interpret accepted/completed separately.
6. Use the server response or re-read state.
7. Preserve ambiguous outcome evidence.
8. Invalidate/update only related queries.
9. Reject any response from a replaced session/context.

## Cross-domain journey

When a journey spans apps:

- use each owner's public API;
- do not import feature internals across domains;
- identify which app owns the final business decision;
- preserve safe projection/eligibility evidence;
- document partial failure and reconciliation;
- test permission/entitlement changes between steps.

## Documentation updates in every feature

- relevant API page;
- `docs/app/capability-map.md`;
- `docs/app/route-map.md` when routing changes;
- `docs/static-data.md` or `docs/rbac-matrix.md` when transport data changes;
- examples when a new pattern is introduced;
- `docs/ai/KNOWN_GAPS.md`;
- test matrix and source-verification date.

## Completion

Do not claim completion from TypeScript compile alone. Run relevant lint,
typecheck, unit, integration, browser, production build, link, and contract
checks; state separately whether a live API/deployment was verified.
