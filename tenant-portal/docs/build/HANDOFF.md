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
[../architecture/data-layer.md](../architecture/data-layer.md#permitted-changes).
Nothing else.

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
> `rm -rf .next` first. See [DEFECTS.md](DEFECTS.md#d7).

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
| **Readex Pro has not been rendered** | Availability and the Arabic subset are verified; whether its Arabic fits a 40px row at `text-xs` needs a look. **Check it in phase 2, before converting screens.** Fallback is Zain |
| **Semantic detail for 412 routes** | Core beyond auth/notifications, and all of Trade. Route-level tables cover them. No screen uses them — documenting a contract nobody builds against rots before it is read |

Everything else is specified to a value, not a principle: tokens (with
**computed** contrast), type, geometry, motion, all 21 primitives and 12
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
