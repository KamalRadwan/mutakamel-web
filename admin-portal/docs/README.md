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
