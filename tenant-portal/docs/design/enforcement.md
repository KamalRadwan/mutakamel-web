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
pnpm design:identifiers   # bidi isolation on machine identifiers
pnpm build
```

All seven green is the definition of done for a phase. It proves
*type-validated, lint-validated, unit-tested*. It does **not** prove the app
works in a real authenticated session — say so honestly when reporting.

## census.mjs

`scripts/design/census.mjs` counts the signals this system intends to change
and diffs them against `docs/design/census.baseline.json`.

| Counter | Target | Notes |
| --- | ---: | --- |
| `colorUtilityTotal` | 0 | The 22 raw Tailwind families |
| `colorFamiliesInUse` | 0 | |
| `roleRampUtilities` | ratchet | See below — no zero target yet |
| `arbitraryTypeSize` | 0 | |
| `fontBoldOrHeavier` | 0 | |
| `roundedXlOrAbove` | 0 | |
| `gradients` | ≤ 2 | |
| `backdropBlur` | ≤ 1 | |
| `handRolledButtons` | **2** | Both in `src/context/AuthContext.test.tsx` — test-harness markup, not UI. Named, not silently excluded |
| `handRolledTables` | 0 | |
| `physicalRtlViolations` | 0 | |
| `languageTernaries` | **5** | The real floor — see below |
| `arabicIndicDigits` | 0 | The numeral decision, dictionary side |
| `localeUnawareFormatting` | 0 | The numeral decision, formatter side |

### The three things 3.30 fixed

Until MASTER-PLAN task 3.30 this script could report a clean run while the
things it exists to catch were sitting in the tree:

1. **It skipped all of `src/design-system/`** — the ratchet was blind to its own
   subject. Every hardcoded ramp step inside the system was uncounted by every
   counter. It now walks that directory and reports it under
   `designSystemCounts`, a **separate** block that ratchets the same way but
   carries no zero target: the design system is where a ramp step, a
   `<button>` and a `<table>` legitimately live. `globals.css` is tallied with
   it, being the token source rather than feature code.
2. **It counted only the 22 Tailwind families**, so `brand-*`, `ink-*`,
   `positive-*`, `caution-*` and `negative-*` were invisible and
   "`colorUtilityTotal: 0`" did not mean "no raw ramp step in feature code".
   `roleRampUtilities` counts them. It is a **ratchet, not a zero target**: the
   measured feature-code figure is real, and several of those sites have no
   semantic token to move to yet (role-tinted banners, icon tints). Driving it
   down needs new semantic tokens, which is design-system work, not a sweep.
3. **The gradient counter could not fire.** It matched v3's `bg-gradient-to-`
   while the code uses Tailwind v4's `bg-linear-to-`, so the baseline read
   `gradients: 0` while one gradient existed. Both spellings now match.

### The two counters that cannot reach zero, and why

Task 3.17 re-baselined honestly rather than closing on a number that was not
true. Two counters have a floor above zero, and every site is named here so the
next reader can tell a floor from a regression:

**`languageTernaries` floor: 5.**

| Site | Count | Why it is exempt |
| --- | ---: | --- |
| `src/i18n/I18nContext.tsx` | 3 | The provider must branch on language to pick the dictionary object and compute `dir`. This is the mechanism the rule is implemented *by*; it cannot use itself |
| `src/lib/format/localized.ts` | 2 | `localizedName`/`alternateName` contain the syntax **by definition** — [i18n.md](i18n.md#the-one-exemption-bilingual-data-fields) makes this the one permitted home for bilingual **data-field** selection |

Any count above 5 is a real violation. That is the point of the helper: it
removes the syntax from feature code entirely and restores the counter as a
gate rather than a number with a footnote.

**`handRolledButtons` floor: 2**, both in `src/context/AuthContext.test.tsx`.
They are a test harness's own controls, which is why `eslint.config.mjs`
already excludes test files from the hand-rolled-button rule with the same
reasoning. The census is deliberately **not** taught to skip them — a named
floor is honest, a silent exclusion is not.

**`handRolledTables` floor: 1**, in
`src/app/(tenant)/crm/dashboards/[id]/components/WidgetDataTable.tsx`
(banked 2026-08-31, Phase 9).

It is **not** a `DataTable` reimplementation, which is what this counter exists
to catch. It is a chart's accessible text equivalent: task 9.14 requires every
dashboard chart to carry the same numbers in a form a screen reader can
traverse, and a real `<table>` with a `<caption>` is that form — an SVG with an
`aria-label` is not. It has no pagination, no sorting, no selection and no
server state; it renders a `WidgetTableModel` and nothing else. Building it on
`DataTable` would make the counter clean and the screen worse. A **second**
hand-rolled table in feature code is still the regression to catch.

### Reading the design-system block

Three numbers under `designSystemCounts` look like budget breaches and are not.
All three were invisible before 3.30, which is exactly why they are counted now.

| Counter | Value | What it actually is |
| --- | ---: | --- |
| `backdropBlur` | 3 | **One** mechanism — the modal scrim — with three call sites: `AlertDialog`, `Dialog`, `Sheet`. The documented budget of 1 is one *use*; the counter measures occurrences. A fourth that is not a scrim is the regression to catch |
| `gradients` | 1 | `Skeleton`'s shimmer sweep, the only gradient in the product. Budget is 2 |
| `handRolledButtons` / `handRolledTables` | 6 / 3 | The definition sites. `Button` is where a `<button>` is supposed to be, and `Table` is where a `<table>` is supposed to be |

`roleRampUtilities` is the number to watch here. It is high in both blocks and
has no target yet: several sites have no semantic token to move to (role-tinted
banners, icon tints), so closing the gap means **adding tokens**, which is
design-system work rather than a sweep. It ratchets meanwhile, which is what
stops it growing while nobody is looking.

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

### The two numeral counters

The digit decision is settled and it is **Western digits in both languages**
([typography.md](typography.md#the-digit-decision--settled)). `INTL_LOCALE.ar`
is `ar-EG-u-nu-latn`, so everything the app *formats* obeys it — and nothing
watched the half that is hand-written. The Arabic dictionary carried **24
Arabic-Indic digits across 12 strings**, so one screen could show a formatted
count in `0-9` beside a hardcoded limit in the Arabic-Indic block.

`arabicIndicDigits` counts literal `\u0660-\u0669` / `\u06F0-\u06F9` anywhere
under `src/`. `localeUnawareFormatting` catches the formatter-side twin: a
locale-conversion call with **no argument** resolves to the *runtime's* default
locale, so its output differs between a developer's laptop, a user's browser
and CI. The attachment-size label was exactly that, plus the English word
"bytes" appended to it — `formatBytes` in `src/lib/format/number.ts` replaced
both.

Both ratchet at 0. Where a test must name the Arabic-Indic block to assert the
rule, it writes code-point escapes rather than the characters — the test that
pins a rule must not be the thing that trips its gate.

## identifier-guard.mjs

`pnpm design:identifiers`. Fails on a monospace element that is not
bidi-isolated, and on any `break-all`.

This app's chrome is Arabic, so the paragraph direction is RTL and a bare Latin
identifier inside it is reordered by the Unicode bidirectional algorithm. The
id a user reads — and copies out of a screenshot into a support ticket — stops
being the id the system holds. [accessibility.md](accessibility.md#bidirectional-text)
had said "wrap identifiers in `<bdi>`" from the start; the tree contained
**104 monospace elements, 98 of them with neither `<bdi>` nor `dir`, and not one
`<bdi>` anywhere in feature code.** A written rule with no gate is a wish.

The rule: an element carrying `font-mono` must be `<bdi>` (which
`IdentifierText` renders) or must set `dir` itself. Two exemptions:

- **`tabular-nums` alongside `font-mono`** marks a numeric column, not an
  identifier. A figure is already `Intl`-formatted with an explicit locale.
- **A named file list**, each entry a file another session owned while U7-U17
  landed. Every one is a real violation left deliberately rather than edited
  across a session boundary. A named floor is honest; a silent exclusion is
  not. Delete an entry when its owner lands and the guard covers it.

`break-all` is banned outright: it is `word-break: break-all`, which hyphenates
ordinary Arabic and English prose mid-syllable. The rule for an unbreakable
token is `wrap-anywhere`, which `identifierText` already carries. Three
`break-all` sites survive under a named exemption for the same
session-ownership reason; all three already set `dir`, so they are
bidi-correct and only their wrapping utility is wrong.

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
