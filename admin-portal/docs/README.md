# Admin Portal Documentation

Status: **[Partially verified; generated Admin route inventory is stale]**

Last source verification: **2026-09-03** (tenant placement moves; generated route inventory)

Last design documentation update: **2026-08-29**

This documentation describes the current Admin Portal source, all
browser-visible Core Admin capabilities, exact integration defects, required
frontend contracts, and backend/release gates. Documentation completion does
not mean frontend parity or deployment completion.

## Start here

1. [Documentation contract](DOCUMENTATION_CONTRACT.md)
2. [AI Start Here](ai/START_HERE.md)
3. [Frontend integration guide](frontend-integration-guide.md)
4. [Frontend capability matrix](audit/frontend-capability-matrix.md)
5. [API domain index](api/README.md)
6. [Generated Admin route inventory](generated/admin-core-api-routes.md)
7. [Known gaps](ai/KNOWN_GAPS.md)
8. [Implementation playbook](ai/IMPLEMENTATION_PLAYBOOK.md)
9. [Test matrix](ai/TEST_MATRIX.md)

## Critical browser rules

```text
Core Admin:   /api/admin/core/v1/*
Worker Admin: /api/admin/worker/v1/*
```

API Gateway is the only browser edge. Never use controller-relative
`/admin/*` or upstream `/api/v1/admin/*` paths in frontend requests.

Protected requests use the shared authenticated client with:

```ts
credentials: "include";
```

The Gateway/Core boundary infers the browser channel. Frontend code does not
send a caller-selected authentication-mode header.

Do not store JWT access or refresh tokens in browser-readable storage.

## Database migration error contract

Source contract verified **2026-10-17**: Worker migration command feedback
matches full `WORKER.MIGRATION.*` precondition codes and
`WORKER.TENANT_CLAIM.HELD`, preserving `details` from Worker envelopes or
Gateway Problem Details. Active-run conflicts show the run-specific message;
lint refusals show the migration and safety rule in the existing bilingual
alert. Test expiry, checksum mismatch and missing approval use `UNTESTED`,
without speculative portal mappings. This is source integration; runtime,
typecheck and lint remain lead verification gates.

## Tenant storage migration lookup

Source behavior updated **2026-10-31**: after a successful lookup of an
in-flight migration, the workspace keeps polling every five seconds even if
a poll fails. The last known migration stays visible alongside the error;
only a successful response clears that error. Polling stops when the migration
is settled (including a retained source awaiting release), on `clear()`, or
when the lookup unmounts. Cancelled requests cannot restart polling.

## Tenant ownership transfer confirmation

Source behavior updated **2026-10-31** (AUDIT29X-APB-2): the transfer dialog
requires the current owner's email exactly, including case and whitespace,
before enabling transfer. The submit handler enforces the same check. Enter
in the candidate search field is prevented from submitting even after the
email matches and a candidate is selected. The Arabic/English prompt uses
local dialog state; the confirmation email is not added to the command.
Regression specs cover both languages; automated checks and the admin
production rebuild remain pending lead verification.

## Tenant component decommission confirmation

Source behavior updated **2026-10-31**: **Create decommission** requires the
retention acknowledgment, then opens the shared `DestructiveActionModal`.
Confirmation requires the exact tenant `name` plus ` · ` plus the selected
component key. Opening, cancelling, or entering a different name sends no
command. The hook captures the validated request body when opening the dialog
and submits it only on confirmation. Background polling pauses while the
dialog is open. Confirmation and dismissal are blocked while a command is in
flight, and repeated confirmation clicks send the command once. English and
Arabic share this behavior; runtime and check execution remain pending lead
verification.

## Localized operational error feedback

Source behavior updated **2026-10-31** (AUDIT29X-APB-5): tenant billing,
FQDN preflight and command failures, destruction load/refresh failures,
initial-commercial create options, and commercial-change catalogue failures
select reviewed Arabic/English messages through the shared error helper.
Local billing and FQDN codes have explicit mappings; unknown codes use the
localized generic fallback. Error codes and correlation IDs remain below
the message. Existing wallet recovery and release-upgrade guidance is retained.
Regression specs cover both languages; checks and the admin rebuild remain
pending lead verification.

Source behavior updated **2026-10-31** (AUDIT29X-APW-5): publisher keys,
database migration mutation notices, storage server list/detail screens, and
provisioning governance use `shared/api/localized-api-error.ts` to select
reviewed Arabic or English copy by error code. Unknown codes and local
exceptions use a localized generic fallback; raw backend/exception messages
are never used as display text on these surfaces, including errors passed to
the shared error-state component and storage action toasts. Error codes and
correlation IDs remain visible. Storage form validation keeps its existing
localized field guidance, and migration precondition diagnostics are preserved.

The reviewed `ADMIN_PERMISSION_DENIED` reason
`admin.migrations.manage is required to start a migration.` selects a dedicated
Arabic/English dictionary entry. Both the code and exact reason must match;
other text under that code uses the general permission guidance. Display text
always comes from the dictionary, preserving actionable permission information
without exposing appended or unknown backend wording.

Regression specs cover the affected displays in Arabic and English, including
unknown codes and preserved diagnostics. Unit execution, typecheck, lint, and
the admin production rebuild remain lead verification gates.

## Billing currency rate confirmations

Source behavior updated **2026-10-31** (AUDIT29X-APS-1): activating or
deactivating a managed currency opens the shared confirmation modal before any
write. Batch Save opens a confirmation showing the changed-row count and each
changed currency's old and new exact decimal rate and status, including new
currencies and status-only changes. Decimal padding alone does not count as a
change. Confirmation submits the captured batch; every listed row is upserted
and omitted currencies remain unchanged. Cancel sends nothing and keeps the
batch draft. No audit reason is sent until the backend accepts that field
(AUDIT29X-PRC-2).

All row actions are disabled during saving. A shared synchronous ref guard
prevents overlapping single and batch writes, including rapid confirmations,
while preserving the existing idempotency-key behavior. Arabic and English use
the same flow. Unit execution, typecheck, lint, and the admin production rebuild
remain pending lead verification.

## Tenant billing refund and cancellation confirmation

Source behavior updated **2026-10-31** (AUDIT29X-APB-4): refunds require a
trimmed audit note of 10–500 characters. The refund button enforces these
limits, and the hook refuses invalid notes without sending a request, with
reviewed Arabic/English validation copy. The confirmation shows the payment's
provider amount and currency. Cancellation and each payment's refund checkbox
clear when an attempt starts and remain unticked after success or failure;
another attempt requires fresh confirmation. Cancellation still sends no body.
Regression specs cover validation and confirmation reset; automated checks and
the admin production rebuild remain pending lead verification.

## Documentation map

| Area | Reference |
| --- | --- |
| Source precedence/status evidence | [DOCUMENTATION_CONTRACT.md](DOCUMENTATION_CONTRACT.md) |
| System ownership | [ai/SYSTEM_CONTEXT.md](ai/SYSTEM_CONTEXT.md) |
| Source verification workflow | [ai/SOURCE_OF_TRUTH.md](ai/SOURCE_OF_TRUTH.md) |
| Current frontend/live/mock status | [audit/frontend-capability-matrix.md](audit/frontend-capability-matrix.md) |
| API contracts | [api/README.md](api/README.md) |
| Full Gateway method/path inventory | [generated/admin-core-api-routes.md](generated/admin-core-api-routes.md) |
| HTTP success/error envelopes | [architecture/http-and-error-contract.md](architecture/http-and-error-contract.md) |
| Document CSP, nonce flow and security headers | [architecture/security-headers.md](architecture/security-headers.md) |
| Permissions/idempotency/data states | [architecture/permissions-idempotency-and-state.md](architecture/permissions-idempotency-and-state.md) |
| Shared DTOs | [models/dtos.md](models/dtos.md) |
| Wire enums | [models/enums.md](models/enums.md) |
| Browser projections | [models/interfaces.md](models/interfaces.md) |
| Permission catalogue | [rbac/permissions.md](rbac/permissions.md) |
| Navigation mapping | [guides/sidebar-navigation.md](guides/sidebar-navigation.md) |
| Reusable component behavior | [components/README.md](components/README.md) |
| Design system: current source and approved cold-blue target | [design-system/README.md](design-system/README.md) |
| Cold-blue design update | [design-system/design-update.md](design-system/design-update.md) |
| Operational UX presentation | [design-system/operational-ux.md](design-system/operational-ux.md) |
| Data, accessibility, responsive, and localization contracts | [design-system/data-experiences.md](design-system/data-experiences.md), [design-system/accessibility-responsive-and-localization.md](design-system/accessibility-responsive-and-localization.md) |
| UI-quality evidence tracker | [audit/ui-quality-matrix.md](audit/ui-quality-matrix.md) |

## Current route evidence

The generated Admin route inventory was regenerated on **2026-09-03** and
`docs:check` passes: it now records **250** Core Admin routes across 23
route-key domains. The dependent hand-written counts and statuses elsewhere in
this documentation set were **not** re-reviewed against that regeneration, so
the previously recorded 240-route claim below remains unverified; treat any
per-domain count in the hand-written guides as stale until that separate API
documentation task runs.

The generated inventory is transport evidence only. Controller/DTO behavior
comes from the hand-written domain guides and owning backend source. The
cold-blue design update does not change or reverify API route inventory.

## Status boundaries

- `DONE`, `PARTIAL`, `BROKEN`, `MISSING`, `GATED`, and `REFACTOR` describe
  frontend source state.
- Tests, typecheck, lint, and build are reported independently.
- Live authenticated status requires a real authorized Gateway/Core session.
- Deployment-verified status requires evidence from the target environment.

The last verified hand-written baseline recorded 240 direct Core Admin calls,
0 equivalent-only representations, and 0 missing route capabilities. The
regenerated inventory now lists 250 routes, so that baseline and the **source
route parity** label are not current evidence until the hand-written guides are
re-reviewed against it. Even after re-verification, source parity would not
prove authenticated runtime, deployment verification, or release readiness.

## Validation

Run from `C:\mutakamel.ai\frontend\admin-portal`:

```powershell
npm run docs:check
npx tsc --noEmit
npx vitest run
npm run lint -- --max-warnings=0
npm run build
```

Regenerate the route inventory after Gateway changes:

```powershell
npm run docs:routes
```

## Backend source roots

Paths below are relative to `C:\mutakamel.ai\frontend`:

```text
../backend/mutakamel-apps/api-gateway-app
../backend/mutakamel-apps/core-app
../backend/mutakamel-apps/worker-app
../backend/mutakamel-apps/realtime-app
```

Backend source is read-only unless a separate backend task explicitly
authorizes changes.
