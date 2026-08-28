# Enforcement

Status: **Specification**

Written: **2026-08-27**

A design system that is only written down decays. These are the mechanical
gates that keep it true.

## The gates

From `tenant-portal/`:

```bash
pnpm typecheck            # tsc --noEmit
pnpm lint                 # eslint, including the design rules below
pnpm test                 # vitest run
pnpm docs:check           # route inventory + API reference + links
pnpm design:census -- --check
pnpm design:rtl
pnpm build
```

All seven green is the definition of done for a phase. It proves
*type-validated, lint-validated, unit-tested*. It does **not** prove the app
works in a real authenticated session — say so honestly when reporting.

## census.mjs

`scripts/design/census.mjs` counts the signals this system intends to change
and diffs them against `docs/design/census.baseline.json`.

| Counter | Target |
| --- | ---: |
| `colorUtilityTotal` | 0 |
| `colorFamiliesInUse` | 0 |
| `arbitraryTypeSize` | 0 |
| `fontBoldOrHeavier` | 0 |
| `roundedXlOrAbove` | 0 |
| `gradients` | ≤ 2 |
| `backdropBlur` | ≤ 1 |
| `handRolledButtons` | 0 |
| `handRolledTables` | 0 |
| `physicalRtlViolations` | 0 |
| `languageTernaries` | 0 |

`--check` fails on any undeclared regression. `--update` moves the baseline
forward **once a phase's delta has been reviewed and is the intended delta**.

Two honesty rules:

- Never run `--update` to make a red gate green. If the delta was not intended,
  fix the code.
- The census counts **literal class names in source**, including inside
  comments and strings. A non-zero count that turns out to be prose is still
  worth removing, because the next person cannot tell the difference. Do not
  teach the script to ignore comments — that would mask real regressions.

`src/design-system/` is exempt: it legitimately defines the tokens and
utilities being counted.

### Starting baseline

Measured 2026-08-27, before any work:

```json
{
  "fileCount": 310,
  "colorUtilityTotal": 1992,
  "colorFamiliesInUse": 17,
  "arbitraryTypeSize": 83,
  "fontBoldOrHeavier": 157,
  "fontNormalOrMedium": 30,
  "roundedXlOrAbove": 151,
  "gradients": 19,
  "backdropBlur": 14,
  "handRolledButtons": 46,
  "handRolledTables": 3,
  "physicalRtlViolations": 16,
  "languageTernaries": 189
}
```

Committed at `docs/design/census.baseline.json`. Two counters are higher than
the figures quoted elsewhere in these docs, because the scripts match more
broadly than a hand grep: `physicalRtlViolations` is 16 rather than 13 (it also
catches `border-l`/`border-r` and `rounded-l-`/`rounded-r-`), and
`languageTernaries` is 189 rather than 151 (it also catches `isRtl`/`isArabic`
forms, not just `lang === "ar"`). **The script's numbers are authoritative.**

Phase 1's deletion alone should roughly halve most of these.

## rtl-guard.mjs

Hard-fails if any physical direction utility appears. Limit: **0**, with no
transitional headroom.

```text
ml- mr- pl- pr- left- right- text-left text-right border-l border-r
rounded-l rounded-r
```

This app is RTL by default; a physical utility is a bug the moment it is
written.

### It is red today. That is correct.

There are **16 violations** in the tree right now, so `pnpm design:rtl` and
therefore `pnpm verify` fail out of the box. This is a real finding, not a
misconfigured gate — treat the output as a to-do list.

Expected trajectory:

| After | Count | Why |
| --- | ---: | --- |
| today | 16 | |
| phase 1 | **4** | 12 are inside `features/crm/dashboards/`, which is deleted |
| phase 3 | 2 | `ToastContext` is replaced by the design-system toast |
| phase 4 | **0** | `opportunity-card.tsx` converts |

The four survivors are `src/components/ui/ToastContext.tsx` (2) and
`src/features/crm/pipeline/components/board/opportunity-card.tsx` (2). If the
count is anything other than the number in this table at the end of a phase,
something unintended happened.

## ESLint rules

Add to `eslint.config.mjs`, scoped to `.ts`/`.tsx` **outside**
`src/design-system/`:

| Pattern | Level | Why |
| --- | --- | --- |
| `text-[Npx]` | **error** | Use the 7-step scale |
| `font-bold\|extrabold\|black` | **error** | Three weights only |
| `rounded-(xl\|2xl\|3xl)` | **error** | Scale stops at 8px |
| Raw palette utility (`bg-slate-800`) | warn → error after phase 4 | Use tokens |
| `bg-gradient-` | warn | Budget is 2 |
| `backdrop-blur` | warn | Budget is 1 |
| `lang === "ar" ?` around a string | **error** | Zero-ternary rule |
| Deep `@/design-system/...` import | **error** | Barrel only |
| `toast.error` in a `catch` referencing 403 | warn | Double-fire |

### The trap that made these useless elsewhere

In flat config, two blocks setting `rules["no-restricted-syntax"]` for the
same files resolve **last-write-wins, not merged**. The sibling portal had
exactly this: seven design patterns silently never fired for the entire
migration, and flipping them on afterwards surfaced 2,574 hidden warnings.

**Put every `no-restricted-syntax` pattern for a given file scope in one
array.** After adding the rules, verify they actually fire:

```bash
pnpm lint 2>&1 | grep -c "no-restricted-syntax"
```

If that returns 0 on the pre-conversion codebase, the rules are dead — there
are 1,992 raw color utilities in there right now.

## knip

```bash
pnpm add -D knip
```

Catches unreferenced exports and files nothing imports — the "no garbage"
requirement, mechanically. Run it from phase 5.

## CI ordering

Cheap and specific first, so a failure names itself:

```text
1. pnpm typecheck
2. pnpm lint
3. pnpm design:rtl
4. pnpm design:census -- --check
5. pnpm test
6. pnpm docs:check
7. pnpm build
8. knip
```

## What none of this catches

Be honest about the gap. These gates cannot see:

- Whether a color combination is actually readable
- Whether Arabic text is well set at a given size
- Whether a board column ordering makes sense to a salesperson
- Whether the app works against a real backend session

Those need a human looking at the running app in both languages and both
themes. The gates keep the mechanical parts true so that review time is spent
on the parts that need judgment.
