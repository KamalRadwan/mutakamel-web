# Known Frontend Gaps

Last source verification: **2026-07-30**

This page is a concise implementation queue. The evidence-backed details are in
the [capability matrix](../audit/frontend-capability-matrix.md).

## BROKEN

- Tenant detail calls nonexistent `GET .../tenants/:id/fqdns`; FQDNs belong to
  the safe tenant detail projection.
- Tenant-user suspend, activate, and restore use `PATCH`; Core requires `POST`.
- FQDN create sends `{ domain }`; Core accepts `{ fqdn }`.
- Set-primary FQDN uses `PATCH`; Core requires `POST`.
- Subscription cancellation uses the tenant-nested path; Core uses
  `/subscriptions/:tenantId/cancel`.
- Wallet credit/debit call nonexistent endpoints instead of server preview and
  confirmation.
- Tenant destroy and some provisioning controls report local success without
  authoritative completion.
- Tenant creation now uses authoritative Application/readiness/tier, plan,
  Database, Storage, quote, and create contracts. Identity/FQDN validation is
  still simulated. Candidate discovery also needs three permissions and an
  N+1 readiness/tier sequence until Core exposes a safe composite projection.
- Forgot password is simulated.
- Navbar notifications are static.

## MISSING

- Five reports.
- Global provisioning governance.
- Subscription, invoice, payment/refund/reconciliation administration.
- Correct wallet adjustments.
- Control-plane audit explorer.
- Logging overrides and credential-compatible live stream.
- Notification inbox/preferences/actions.
- Self profile, accept invite, reset password, and logout all.
- Storage routing/principal rotation and bounded catalogue gaps.

## GATED

- Existing-tenant Storage Server migrations.
- Admin Realtime activation and Socket.IO client.
- Storage attestation/recovery operator workflows until their safe release
  contract and evidence package are confirmed.

## REFACTOR

- Central typed domain API modules and exact projections.
- Normalized error with `source` and preserved `correlationId`.
- ONE/ALL/ANY permission requirement component.
- Caller-owned stable UUIDv7 mutation intents.
- Independent tenant-tab queries and explicit forbidden/unavailable/failure
  states.
- Decimal/byte-safe helpers and `meta.total` pagination.
- Removal of explicit `any`, console-only errors, mock fallbacks, and
  cascading manual effects.
- Regression coverage for every repaired contract.

## Evidence still required for a completion claim

- Zero-error/warning lint.
- Passing typecheck, tests, and the default production build.
- Authorized authenticated Gateway/Core runtime exercise.
- Release/deployment verification where applicable.

## Validation snapshot

Source validation on **2026-07-30** produced:

- `npm run docs:check`: PASS; 232 generated Admin Core routes and 57 Markdown
  files checked.
- `npx tsc --noEmit`: PASS.
- `npx vitest run`: PASS; 8 files and 56 tests.
- `npm run lint -- --max-warnings=0`: FAIL; 213 findings, comprising 109
  errors and 104 warnings.
- `npm run build`: FAIL before compilation because Next.js 16 defaults to
  Turbopack while `next.config.ts` defines webpack customization without a
  Turbopack configuration.
- `npm run build -- --webpack`: PASS; this proves the webpack production
  bundle can compile, but it does not close the default-build configuration
  gap.
- Documentation-scoped `git diff --check`: PASS. Repository-wide
  `git diff --check` remains blocked by whitespace in pre-existing Admin and
  Tenant Portal application changes outside this documentation rebuild.
