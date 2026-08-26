# Tenant Portal Test Matrix

Status: **Implemented command surface; capability coverage remains incremental**

Last verified: **2026-08-26**

## Current commands

```powershell
pnpm --filter tenant-portal lint
pnpm --filter tenant-portal typecheck
pnpm --filter tenant-portal test
pnpm --filter tenant-portal docs:check
pnpm --filter tenant-portal build
```

The project defines lint, typecheck, Vitest, documentation, and production
build gates. Separate integration and browser commands remain future release
work; source tests are not authenticated deployment proof.

## Required command surface

| Command | Purpose |
| --- | --- |
| `typecheck` | TypeScript without emit |
| `test` | Unit/component tests |
| `test:integration` | Shared client/auth/contract integration |
| `test:e2e` | Browser replacement journeys |
| `docs:check` | Links, metadata, duplicate paths, examples |
| `docs:contracts` | Compare documented/generated routes to Gateway snapshot |
| `lint` | Source and relevant documentation rules |
| `build` | Next production build |

Command names may adapt to workspace conventions, but equivalent coverage is
required.

## Foundation tests

| Area | Required cases |
| --- | --- |
| Host admission | active, suspended, unknown, unverified, malformed, Gateway unavailable |
| Canonical path | Core, CRM, Trade, legacy rejection/compat boundary |
| Proxy headers | trusted-header stripping, original host/proto, cookies, binary bodies |
| Envelopes | success, pagination, 204, application error, Gateway problem, malformed payload |
| Idempotency | UUIDv7, retained exact retry, changed intent |

## Authentication tests

- login and invalid credentials;
- proactive and `401` refresh;
- sequential and concurrent multi-tab refresh using the same reusable session
  credential without sibling-tab revocation;
- independent `refreshUseCount`/`accessIssueCount` increments while ordinary
  refresh leaves `credentialVersion` unchanged;
- login-only remember-cookie preference remains server-authoritative on later
  refresh and does not change idle/absolute deadlines;
- logout and logout-all;
- invite/reset single use and invalid/expired token;
- cross-tab logout/account replacement;
- in-flight stale-generation response;
- exact-`sid` tombstone rejection and non-matching tombstone retention;
- pre-expiry timing, hidden/offline wake-up, single-flight, transient backoff,
  and terminal-stop behavior;
- trusted visible activity only, bounded checkpoint timeout, access-refresh
  replay, and stale-`sid` success rejection;
- Realtime permanent-stop revalidation without socket-owned logout;
- host/token tenant mismatch;
- suspended tenant pre-auth versus protected route.

## Authorization tests

- missing permission;
- own/team/all scope;
- branch/company/channel substitution;
- module absent;
- seat absent/revoked;
- tenant inactive/read-only;
- resource state changed after capability load;
- unknown enum/capability response.

## Feature tests

Each feature:

- request adapter and schema;
- pagination/filter/sort/cursor;
- loading/empty/error/forbidden/conflict/unavailable;
- create/read/update/delete or actual lifecycle commands;
- double-submit/exact replay/stale concurrency;
- route deep-link and refresh;
- localization data behavior;
- safe logging/redaction.

## Async tests

- `202` accepted versus completed;
- poll progress and terminal success/failure;
- stop on logout/navigation;
- recover after reload/focus;
- operation not found/projection delay when documented;
- cancellation and expiry;
- unknown outcome after transport loss.

## Security tests

Use [security verification](../security/security-verification.md) as the
negative matrix.

## Backend verification when a contract changes

Run tests/builds in each affected app only after building its required shared or
app-local packages. Do not run a nonexistent backend root build. Keep backend
validation read-only unless a separate backend change is authorized.

Code-level checks are not live deployment verification.
