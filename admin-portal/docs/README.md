# Admin Portal Documentation

Status: **[Verified]**

Last source verification: **2026-08-26**

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
6. [Generated 240-route inventory](generated/admin-core-api-routes.md)
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
| Design system: tokens, primitives, patterns, shell, migration record | [design-system/README.md](design-system/README.md) |

## Current route evidence

The hard-checked current Core Admin inventory contains 240 canonical browser
routes: 97 GET operations and 143 non-GET operations. Core and Gateway expose
the same 240 method/path set with zero missing, orphan, or duplicate contracts.
Worker Admin routes are documented separately and are not counted in that
inventory.

The generated inventory is transport evidence only. Controller/DTO behavior
comes from the hand-written domain guides and owning backend source.

## Status boundaries

- `DONE`, `PARTIAL`, `BROKEN`, `MISSING`, `GATED`, and `REFACTOR` describe
  frontend source state.
- Tests, typecheck, lint, and build are reported independently.
- Live authenticated status requires a real authorized Gateway/Core session.
- Deployment-verified status requires evidence from the target environment.

The current Web source has 240 direct Core Admin calls, 0 equivalent-only
representations, and 0 missing route capabilities. Call this **source route
parity**, not authenticated runtime, deployment verification, or release
readiness while those independent gates remain open.

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
