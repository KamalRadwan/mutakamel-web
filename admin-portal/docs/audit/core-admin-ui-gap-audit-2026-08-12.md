# Core Admin UI parity audit and upgrade record

Audit date: **2026-08-12**

Web route verdict: **SOURCE PARITY ACHIEVED**

Release verdict: **NOT YET RUNTIME VERIFIED**

The hard-checked Core Admin contract contains 240 unique method/path routes.
The current Admin Portal has a reachable exact production call for all 240:
**240 direct, 0 equivalent, 0 missing**. This is source-level browser capability
parity, not proof of an authenticated deployment or production readiness.

The complete route-by-route evidence is maintained in the machine ledger. The
generated route inventory remains the transport source of truth:
[admin-core-api-routes.json](../generated/admin-core-api-routes.json).

## Scope and audit method

The audit:

1. Enumerated all 445 current Core controller handlers and all 439 Gateway Core
   contracts from compiler-backed source evidence.
2. Reconciled the 240 Admin handlers with the 240 Admin Gateway contracts. The
   sets are a bijection: no missing, orphan, or duplicate Admin contract.
3. Enumerated every Admin Portal page, production API callsite, form, button,
   input, select, textarea, permission guard, and runnable test file.
4. Counted a route as direct only when reachable production UI code calls the
   exact canonical method/path. An unused wrapper did not count.
5. Reviewed connected features for permission composition, DTO-aligned
   validation, state/error handling, pagination, bilingual behavior, mutation
   identity, and focused tests.

The current Core Admin method mix is 97 GET, 100 POST, 24 PATCH, 16 DELETE, and
3 PUT operations. Its exact method/path set SHA-256 is
`c6a514ec7ea2c0d1ce6d3afe67a794395b0968993b3a44c22a23a3fb278c395b`.

## Intentional non-Admin exclusions

The remaining 205 Core handlers are not Admin Portal omissions:

| Ownership | Handlers | Treatment |
| --- | ---: | --- |
| Tenant | 155 | Tenant-facing product responsibility |
| Tenant template | 41 | Tenant/template platform responsibility |
| Internal | 5 | Backend-to-backend only |
| Public | 3 | Public edge, not an Admin module |
| Direct service | 1 | Intentionally direct, not Gateway Admin |
| **Total excluded** | **205** | **Not counted as Admin UI gaps** |

## Current Admin Portal inventory

The settled working-tree scan contains:

- 52 `page.tsx` files: 50 rendered pages and 2 redirects;
- 33 production API-callsite files with 253 direct Axios method occurrences;
- 2 additional transport callsite files with 5 `fetch`/`EventSource` uses;
- 59 forms, 455 buttons, 208 native inputs, 75 selects, and 30 textareas;
- 162 runnable test files and 837 static test declaration sites, including
  multiline parameterized cases.

These are static source counts, not runtime DOM totals or a test-run result.

## Exhaustive route-family comparison

| Core Admin family | Routes | Direct | Equivalent | Missing | Source status |
| --- | ---: | ---: | ---: | ---: | --- |
| Applications | 14 | 14 | 0 | 0 | Connected |
| Catalogue and currency | 17 | 17 | 0 | 0 | Connected |
| Control-plane audit | 2 | 2 | 0 | 0 | Connected |
| Auth invalidation outbox | 1 | 1 | 0 | 0 | Connected |
| Auth | 11 | 11 | 0 | 0 | Connected |
| Dashboard | 1 | 1 | 0 | 0 | Connected |
| Database servers | 20 | 20 | 0 | 0 | Connected |
| Invoices | 7 | 7 | 0 | 0 | Connected |
| Logging | 6 | 6 | 0 | 0 | Connected |
| Notifications | 14 | 14 | 0 | 0 | Connected |
| Payments and reconciliation | 5 | 5 | 0 | 0 | Connected |
| Permission catalogue | 1 | 1 | 0 | 0 | Connected |
| Provisioning governance | 31 | 31 | 0 | 0 | Connected |
| Reports | 5 | 5 | 0 | 0 | Connected |
| Roles | 6 | 6 | 0 | 0 | Connected |
| Storage servers | 8 | 8 | 0 | 0 | Connected |
| Subscriptions | 8 | 8 | 0 | 0 | Connected |
| System settings and SMTP | 7 | 7 | 0 | 0 | Connected |
| Tenant FQDN validation | 1 | 1 | 0 | 0 | Connected |
| Tenants and tenant access | 54 | 54 | 0 | 0 | Connected |
| Wallets | 6 | 6 | 0 | 0 | Connected |
| Users, profile, and WebPhone | 15 | 15 | 0 | 0 | Connected |
| **Total** | **240** | **240** | **0** | **0** | **100% exact source representation** |

## Exhaustive missing-route register

**Empty.** No current Core Admin method/path lacks an exact reachable Admin
Portal production call.

Four reads that were previously accepted as equivalent projections are now
direct integrations:

- `GET /system-settings/:key` is used for authoritative per-setting reload;
- `GET /tenants/:id/fqdns` owns the tenant FQDN list state;
- `GET /tenants/:tenantId/subscription/items` is reconciled with subscription
  detail before rendering;
- `GET /wallets/:walletId/ledger` is reconciled with the tenant wallet ledger.

Paths above are relative to `/api/admin/core/v1`.

## Connected-UI defect reconciliation

`RESOLVED` means the identified source defect was repaired and has focused
test evidence. It does not mean the feature has passed an authenticated
deployment smoke test.

| ID | Area | Status | Current source evidence |
| --- | --- | --- | --- |
| UI-001 | Roles update gate | `RESOLVED` | Metadata controls and hook require `admin.roles.update`. |
| UI-002 | Roles critical pair | `RESOLVED` | Permission replacement requires update plus critical; partial sets fail closed. |
| UI-003 | Nullable role description | `RESOLVED` | Clearing sends explicit `null` and reconciles the response. |
| UI-004 | Role pagination | `RESOLVED` | List uses server page/limit/meta with loading, retained-data, and error states. |
| UI-005 | Role/catalogue read separation | `RESOLVED` | Role metadata loads independently; catalogue denial degrades editing only. |
| UI-006 | Role validation and intent | `RESOLVED` | Empty names fail before transport and one caller-owned UUIDv7 follows each exact intent/retry. |
| UI-007 | Settings critical pair | `RESOLVED` | Generic and SMTP saves enforce update plus critical in UI and hooks. |
| UI-008 | Top-up invariant | `RESOLVED` | Shared edit/save validation enforces min <= max and orders dependent writes safely. |
| UI-009 | Settings load failures | `RESOLVED` | Pages distinguish forbidden/unavailable/error from empty and expose safe retry. |
| UI-010 | SMTP defaults/validation | `RESOLVED` | State stays unknown until read; contract and cross-field validation are enforced. |
| UI-011 | SMTP dirty verification | `RESOLVED` | Connection testing is blocked while form state differs from saved Core state. |
| UI-012 | Settings child permissions | `RESOLVED` | Layout and children apply their own Core permissions. |
| UI-013 | Profile failure state | `RESOLVED` | Profile renders forbidden/unavailable/error evidence and retry. |
| UI-014 | Tenant database filter | `RESOLVED` | Filter options load independently from the authoritative database registry. |
| UI-015 | Tenant geography | `RESOLVED` | Creation uses canonical country/calling-code/timezone data and save-boundary validation. |
| UI-016 | Navigation permissions | `RESOLVED` | Desktop, mobile, grouped, and user-menu destinations are permission filtered. |
| UI-017 | Composite permission component | `RESOLVED` | `RequirePermission` supports exclusive ONE, ALL, and ANY requirements. |
| UI-018 | Public auth allowlist | `RESOLVED` | Invite acceptance and password reset are narrowly public; other routes stay protected. |
| UI-019 | Catalogue guard/i18n | `RESOLVED` | List preflights application-read permission and list/audit pages have Arabic/English tests. |
| UI-020 | Database entry guards | `RESOLVED` | Database list/detail/create fail closed before protected reads. |
| UI-021 | Backup unused wrappers | `RESOLVED` | Unjustified Worker `getRun`/`getRestore` wrappers and wrapper-only tests were removed. |
| UI-022 | Stable mutation identity | `RESOLVED` | A TypeScript AST scan found 151 production Axios write calls and 0 bare/implicit-policy calls. Idempotent writes own retry-stable UUIDv7 intents; non-idempotent WebPhone call-log and forgot-password writes explicitly opt out and are non-replayable. |
| UI-023 | Documentation drift | `RESOLVED` | Current docs use 240 direct/0 equivalent/0 missing and no longer claim simulated forgot-password or missing profile. |
| UI-024 | Storage-migration drift | `RESOLVED` | The eight historical routes are marked absent from current Core/Gateway source and excluded from parity. |

## Small-phase delivery and remaining plan

A web capability is source-complete only when it has a reachable exact client,
response validation, page/control, exact permission behavior, DTO-aligned input
validation, loading/empty/forbidden/error/success states, Arabic/English copy,
safe mutation recovery, focused tests, and current documentation.

### Phase 0 - Inventory and comparison: complete

- Hard-check all 445 Core handlers, 439 Gateway contracts, and 240 Admin routes.
- Produce the semantic route ledger and intentional-exclusion register.
- Reconcile every Admin route against reachable web and mobile evidence.

### Phase 1 - Existing UI correctness: complete

- Roles, settings/SMTP, profile, tenant filters/geography, navigation, composite
  RBAC, auth allowlist, Catalogue i18n/guard, and database entry guards are fixed.
- Remove unjustified unused Backup wrappers.
- Complete the caller-owned intent migration. The settled-tree AST policy scan
  reports 151 production writes and zero implicit-policy calls.

### Phase 2 - Formerly missing web modules: complete

- Deliver standalone reports, cross-tenant subscriptions, reverse geocoding,
  invite/reset/logout-all/outbox replay, notifications, invoice administration,
  logging, and all provisioning-governance submodules.
- Deliver exact pages, controls, permissions, validation, error states, bilingual
  copy, and focused tests for each slice.

### Phase 3 - Exact-read promotion: complete

- Replace the four equivalent-projection classifications with exact production
  calls and strict reconciliation.
- Regenerate the route ledger to 240 direct, 0 equivalent, 0 missing.

### Phase 4 - Web release verification: remaining

- Run full typecheck, lint, Vitest, production build, and documentation checks
  against the settled tree.
- Exercise representative read/write/critical/error flows through an
  authenticated Gateway/Core session.
- Verify the deployed build separately; source parity is not deployment proof.

UI-022 focused validation passed: 6 files/64 tests, TypeScript `--noEmit`, and
scoped ESLint. The final users/profile/WebPhone AST slice found 9 writes: 8
idempotent calls with explicit caller UUIDv7 policy and 1 explicitly
non-replayable call-log write, with 0 auto-key dependencies. A separate
transport test asserts raw auth/activity fetches send no unsupported
idempotency header.

### Phase 5 - Mobile and backend gate: remaining

The Flutter Admin surface is not at parity: the machine matrix currently
classifies 0 routes finished, 44 as partial/fixture-only, 79 not started, and
117 not applicable. Mobile cannot safely reuse the Web-only cookie/browser
Admin authentication channel. Keep mobile implementation gated until the
backend publishes and verifies an authorized mobile Admin authentication
contract; do not weaken browser authentication or edit backend policy from this
frontend task.

## Reproducible evidence

Durable repository evidence:

- [Generated JSON route inventory](../generated/admin-core-api-routes.json)
- [Generated Markdown route inventory](../generated/admin-core-api-routes.md)
- [Frontend capability matrix](frontend-capability-matrix.md)

Machine audit artifacts:

```text
C:\Users\kamal\AppData\Local\Temp\mutakamel-core-admin-web-mobile-parity-ledger-current\
C:\Users\kamal\AppData\Local\Temp\mutakamel-admin-ui-ledger-2026-08-12\
```

The backend semantic ledger SHA-256 is
`8f35afa398d71d69412cafaad5447b9def7152e87596e9e02f3f9ae23e018fb2`.

## Verification limitation

The Gateway dependency directory cannot currently be restored locally because
private GitHub Packages authentication returns 401 without `NODE_AUTH_TOKEN`.
No backend source was changed. Static Core/Gateway Admin parity is complete,
but Gateway test execution remains a credential-dependent verification gate.
