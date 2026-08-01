# Implementation Playbook

Last source verification: **2026-07-30**

## Phase 1: safety foundation

1. Add exact success/pagination contracts and one normalized API error.
2. Preserve Core `errorCode`, Gateway `code`, field errors, and
   `correlationId`.
3. Implement ONE/ALL/ANY RBAC semantics.
4. Move UUIDv7 intent ownership into mutation commands.
5. Add decimal-string and byte-string display helpers.
6. Add shared loading, empty, forbidden, unavailable, conflict, and failure
   states.

## Phase 2: repair false-live workflows

Repair the exact tenant/FQDN/user/subscription/wallet/auth defects in
[KNOWN_GAPS.md](KNOWN_GAPS.md). Add a regression test before marking each
workflow `DONE`.

## Phase 3: complete tenant creation

Sequence live catalogue selection, identity and FQDN validation, database and
Storage Server placement, reverse geocode, provisioning plan, subscription
quote, exact create DTO, and operation tracking. Never submit hardcoded IDs or
optimistically set `ACTIVE`.

## Phase 4: operational modules

Implement reports, subscriptions, invoices, wallet adjustments,
payments/refunds/reconciliation, notifications, audit, logging, and auth/profile
completion as typed domain modules.

## Phase 5: provisioning governance

Implement publisher public-key registry, release drafts/releases, discovery,
fleet rollout, tenant update planning, prerequisite evidence, component/seed
state, managed operations, and V1 retirement. Private publisher signing keys
remain outside the browser and platform.

## Phase 6: bounded gaps

Add module deletion, global catalogue audit, currency-rate batch replacement,
tier Storage entitlements, Storage routing profile, and principal rotation.
Keep Storage migration, attestation, recovery, and Admin Realtime behind their
documented gates.

## Domain implementation shape

Prefer:

```text
src/lib/api/core/
  <domain>-api.ts
  contracts/<domain>.ts
```

Each API-backed area should own:

- typed request and response projections;
- permission requirement;
- initial and background loading state;
- empty, forbidden, unavailable, validation, conflict, stale, transport, and
  terminal async failure states;
- exact retry/idempotency behavior;
- cache/refetch/reconciliation behavior;
- tests for success and negative cases.

Do not mark a phase complete while a BROKEN route or required validation gate
in that phase remains open.
