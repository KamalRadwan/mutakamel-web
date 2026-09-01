# Rebuild Handoff

Written: **2026-08-27**

**You are starting a fresh session with no memory of how this plan was made.
That is expected. Everything you need is written down.**

Read this file completely before touching anything.

## What you are doing

Rebuilding the tenant portal's presentation layer on a new design system, and
deleting the ~60% of the codebase that no user can reach.

You are **not** rewriting the application. The transport and session layer is
production-grade, tested, and stays exactly as it is.

## The shape of the codebase

Three tiers. Treat each differently.

### Tier 1 — the spine. Do not touch.

7,218 lines. `src/lib/api/`, `src/lib/auth/`, `src/lib/notifications/`,
`src/shared/tenancy/`, `src/context/`, `src/proxy.ts`,
`src/lib/navigation/`, `src/hooks/`, `src/components/auth/`.

Auth-generation fencing, single-flight refresh, cross-tab session sync, CSRF,
UUIDv7 idempotency, fail-closed host admission, a Zod-validated realtime
notifications runtime. Covered by tests. It imports nothing from `app/` or
`features/` — verified 0 wrong-direction imports — which is exactly what lets
you rewrite everything above it safely.

Two narrow permitted changes, listed in
[../architecture/data-layer.md](../architecture/data-layer.md#permitted-changes),
plus the third recorded below. Nothing else.

#### Amendment · 2026-08-31 — a third permitted change

**Presentation-only conversion of `src/components/auth/TenantAuthGuard.tsx` and
`src/components/auth/TenantHostStateBoundary.tsx`.**

The "do not touch" fence exists to protect *behaviour* — auth-generation
fencing, single-flight refresh, cross-tab session sync, fail-closed host
admission. It was drawn at directory granularity, and it caught two files that
contain no such behaviour: they are the **rendered chrome** for states the
spine computes elsewhere. `TenantAuthGuard`'s only logic is one redirect
effect; `TenantHostStateBoundary` reads `usePathname()` and a `status` prop it
is handed.

Leaving them fenced cost more than it protected, and
[DEFECTS.md#d16](DEFECTS.md#d16--two-auth-screens-were-never-converted--fixed-2026-08-31) already
schedules their conversion — the fence and the defect list contradicted each
other:

- They are **unconditionally hardcoded Arabic with no English path**, on the
  two surfaces a real outage goes through. An English-speaking operator during
  a degraded session reads Arabic or nothing.
- They carry the entire remaining census debt —
  [D17](DEFECTS.md#d17--the-census-baseline-was-banked-with-violations-in-it--fixed-2026-08-31) —
  which is why `eslint.config.mjs` had to exclude `src/components/auth/**`
  wholesale, blinding the design gates on four files rather than two.

**Scope of the amendment, exactly:**

| Permitted | Not permitted |
| --- | --- |
| `className` values, markup structure, imports of `@/design-system` | Any change to the redirect effect's conditions or dependency array |
| Replacing hardcoded Arabic with `t.*` from both dictionaries | Any change to what `useTenantAuth()` is read for |
| Adding `role`/`aria-*` and a `<title>`-level heading | Any change to `TenantHostAdmission.tsx` or `TenantPortalRuntime.tsx` |

`TenantHostAdmission.tsx` and `TenantPortalRuntime.tsx` stay fenced in full:
they *do* carry spine behaviour. The rest of Tier 1 is unchanged.

Recorded because a binding document is not amended by editing the files it
protects — see MASTER-PLAN task 3.36.

#### Amendment · 2026-08-31 (second) — a fourth and fifth permitted change

**Phase 13 hardening: the CSP nonce (13.1) and the session-ending reason
(13.7).** Two tasks each need exactly one fenced file, and neither can be done
anywhere else.

The fence protects **behaviour**: auth-generation fencing, single-flight
refresh, cross-tab session sync, CSRF, UUIDv7 idempotency, fail-closed host
admission. Adding a response header, and surfacing a code the file already
computes, touch none of them.

**Fourth permitted change — `src/proxy.ts`, CSP only.**

A nonce must be fresh per request, so it can be minted nowhere else:
[../architecture/security-headers.md](../architecture/security-headers.md#the-nonce-problem)
has specified this file since it was written, and
[DECISIONS.md#d16](DECISIONS.md#d16--the-csp-policy-decided-against-what-actually-exists--assumed)
records that no CSP string and no nonce were ever put in it.

| Permitted | Not permitted |
| --- | --- |
| Minting a per-request nonce and setting `Content-Security-Policy` on every response | Any change to **which** module path is supported, or to where an unsupported one redirects |
| Widening `config.matcher` so the header reaches every document, not only `/core`, `/crm`, `/trade` | Any change to the `405` rule, which stays gated on the three module segments exactly as today |
| Passing the nonce forward on the request headers so Next can read it | Any change to host admission, or to `TenantHostAdmission.tsx` |

The matcher is the one genuinely load-bearing line, because the existing
`proxy.test.ts` deliberately pins `/`, `/login`, `/search` and
`/getting-started` as **unmatched**: a matched path with no allowlist entry
used to redirect to `/unavailable`, which is how six finished screens shipped
unreachable (DEFECTS.md D22, Q40). The redirect and the `405` are therefore
re-gated on the module segment itself rather than on the matcher, so widening
the matcher cannot resurrect that defect — and the test now pins the
**behaviour** (`/login` is passed through untouched, and carries the header)
rather than the weaker proxy of it.

**Fifth permitted change — `src/context/AuthContext.tsx` and
`src/components/auth/TenantAuthGuard.tsx`, the ended reason only.**

[OPEN-QUESTIONS.md#q18](OPEN-QUESTIONS.md#q18--the-session-ending-reason-cannot-reach-session-expired)
names this exactly: the seven session-ending codes are classified in
`AuthContext` and then discarded, so `/session-expired` can never say why.

| Permitted | Not permitted |
| --- | --- |
| Adding `endedReason` to `TenantAuthContextValue`, set from the code `getAuthErrorCode` already reads | Any change to **when** `ENDED` is set, or to any refresh, bootstrap or lock condition |
| Appending that reason to the `/session-expired` destination the guard **already** chooses | Any change to **which** destination the guard chooses, or to the effect's `!isAuthenticated && !isPublic` condition |
| Adding `endedReason` to the guard effect's dependency array | `AuthContext`'s own two `router.replace("/login")` calls |

That last row is the second half of Q18 and it stays **open**: re-pointing
those two calls is redirect logic in a spine file, it decides where a user
lands when a session ends mid-work, and it wants its own review rather than a
ride on this one. Q18 is therefore narrowed, not closed — see its entry.

`TenantHostAdmission.tsx` and `TenantPortalRuntime.tsx` stay fenced in full.
The rest of Tier 1 is unchanged.

### Tier 2 — live features. Keep the logic, replace the markup.

~6,500 lines of hooks with strict runtime response validation, serving 9 CRM
routes plus `/core/authentication`. The hooks are good. The components are
not.

### Tier 3 — delete.

14,428 lines that no user can load. Full manifest in
[PHASE-1-DELETE.md](PHASE-1-DELETE.md).

## Why the deletion comes first

`Button` is imported by 103 files. That sounds like a large conversion — but
**58 of those are in Tier 3**. Delete first and the UI conversion drops to
**25 files**.

Deleting first also removes 9 dependencies, halves the color debt (1,992 →
1,052), and makes every census number honest. Do not convert a file you are
about to delete.

## Phases

| Phase | What | Doc |
| --- | --- | --- |
| 1 | Delete Tier 3 | [PHASE-1-DELETE.md](PHASE-1-DELETE.md) |
| 2 | Tokens, fonts, theming, motion | [PHASE-2-FOUNDATION.md](PHASE-2-FOUNDATION.md) |
| 3 | Primitives, patterns, views, shell | [PHASE-3-COMPONENTS.md](PHASE-3-COMPONENTS.md) |
| 4 | Convert the 25 screens; build the missing views | [PHASE-4-SCREENS.md](PHASE-4-SCREENS.md) |
| 5 | Enforcement gates | [../design/enforcement.md](../design/enforcement.md) |

Phases are ordered by dependency, not preference. Do not start phase N+1 with
phase N's gate red.

## The gate

After **every** phase, from `tenant-portal/`:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm docs:routes:check && pnpm build
```

From phase 5, add:

```bash
pnpm design:census -- --check && pnpm design:rtl
```

A green run proves *type-validated, lint-validated, unit-tested*. It does
**not** prove the app works in a real authenticated session — say so honestly
when you report.

> `pnpm typecheck` is currently red for a stale-artifact reason. Run
> `rm -rf .next` first. See [DEFECTS.md](DEFECTS.md#d7--typecheck-is-red-on-a-stale-artifact).

## Non-negotiables

1. **Never edit `../backend/`.** Read it to verify contracts.
2. **Port 5002.** Never another.
3. **Never invent** a field, enum value, permission, route or error code. If
   source does not prove it, it does not exist.
4. **No mock data, no simulated success.** If it is not server-backed, it
   renders the unavailable boundary.
5. **Both languages, both themes, every screen.** Not a follow-up pass.
6. **Decimal strings are never `Number()`d.**
7. **Delete, do not comment out.**

## Definition of done for any file you touch

- [ ] Zero raw palette utilities — semantic tokens only
- [ ] Zero hand-rolled `<button>`/`<input>`/`<select>`/`<table>`
- [ ] Zero `lang === "ar" ?` string ternaries
- [ ] Zero physical direction utilities
- [ ] Zero arbitrary `text-[Npx]`
- [ ] Zero `rounded-xl`/`2xl`/`3xl`
- [ ] Zero unused imports, vars, types, props, exports
- [ ] Zero commented-out code
- [ ] Correct in light **and** dark
- [ ] Correct in Arabic **and** English
- [ ] Keyboard operable, visible focus
- [ ] Under ~300 lines, or split

## Code quality

The user asked for this explicitly, so it is a gate, not a preference:

- **Human-readable.** Names say what things are. No abbreviations that need a
  lookup.
- **Documented.** Comment *why*, never *what*. Every non-obvious constant
  carries its backend source path.
- **No duplication.** Two implementations of one thing means one moves up a
  layer.
- **No garbage.** No unused anything, no dead branches, no speculative props,
  no `any`, no default exports outside Next's required files.

`knip` is added in phase 5 to catch unreferenced exports and files
mechanically. Do not wait for it — do not create the garbage.

## What this documentation does NOT give you

All nine questions opened during the rebuild are now closed — see
[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md). Two things remain genuinely open, and
both are deliberate:

| Gap | Why, and what to do |
| --- | --- |
| **Readex Pro has not been rendered** | Availability and the Arabic subset are verified; whether its Arabic fits a **36px** row at `text-xs` needs a look — the app now renders, so open a populated table in Arabic. Fallback is Zain. **Do not follow — superseded 2026-09-01:** this gap closed by replacement, not by measurement. The Arabic face is IBM Plex Sans Arabic and the row is 44px, so there is no width question left and no Zain to fall back to. Reading the new face on a populated Arabic table is still worth a look, but it is not this open item. Of the two gaps named above, only the 412-route one remains |
| **Semantic detail for 412 routes** | Core beyond auth/notifications, and all of Trade. Route-level tables cover them. No screen uses them — documenting a contract nobody builds against rots before it is read |

Everything else is specified to a value, not a principle: tokens (with
**computed** contrast), type, geometry, motion, all 25 primitives and 13
patterns, the three-view contract, both detail screens, the conversion flow,
shell, theming, i18n, accessibility, testing, security headers, the CRM
contracts, 293 DTO fields, 95 error codes, and every permission and enum wire
value.

## When you are unsure

1. Re-read the relevant `docs/` page. The answer is very likely there.
2. If it is a **contract** question, read backend source. Precedence is in
   [../CONTRACT.md](../CONTRACT.md#source-precedence).
3. If it is a **design** question, the answer is in `docs/design/`. If it
   genuinely is not, pick the option most consistent with the five laws and
   record it in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).
4. **Never invent a backend contract.** Record the gap instead.

A question you had to ask a human is a bug in these docs. Log it in
`OPEN-QUESTIONS.md` so it gets fixed.

## Reading order

1. [../README.md](../README.md)
2. [../architecture/file-architecture.md](../architecture/file-architecture.md)
3. [../design/README.md](../design/README.md) — the five laws
4. [../design/anti-patterns.md](../design/anti-patterns.md)
5. [PHASE-1-DELETE.md](PHASE-1-DELETE.md)
6. Then each phase doc as you reach it

Before writing markup for a screen, read
[../design/views.md](../design/views.md) — the three-view contract is the
single most detailed spec here and the easiest to get wrong.

## Before you write CRM code, read the audit review

[CRM-AUDIT-REVIEW.md](CRM-AUDIT-REVIEW.md) is this project's response to an
external documentation-versus-implementation audit of `crm-app`, dated
2026-08-31. **Meet the verdict before the code, not after.** It carries three
things you will otherwise reconstruct badly:

1. **Which audit claims were re-verified, and how.** Four were re-checked
   against source and a live PostgreSQL. All four held — but two were *sharper*
   than the audit stated, and one claim about the backend was later found
   **wrong** when Phase 14 re-read it before acting
   ([D23](DEFECTS.md#d23--editing-a-widgets-name-can-destroy-its-query-spec--fixed-2026-08-31)).
   That is the standard: a claim is a claim until you have opened the file.
2. **Ten product decisions**, each written into the document that owns it rather
   than left in the review. This project has already answered the same question
   three times under three numbers (Q14, Q70, Q83). The decisions exist so that
   does not happen a fourth time.
3. **What is explicitly not this repository's to fix.** Most of the audit's
   findings are `crm-app`'s. Adding them here as portal tasks would be the same
   category error the audit warns about. They are recorded as external
   dependencies in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) — Q17, Q36, Q72, Q120
   and Q121 — and nowhere else.

Its verdict on readiness is **NOT READY**, and it holds on both sides of the
wire for different reasons. Do not read a green `pnpm verify` as contradicting
it: the gate proves type-validated, lint-validated and unit-tested, and nothing
about a real authenticated session.
