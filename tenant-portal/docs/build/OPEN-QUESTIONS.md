# Open Questions

Last review: **2026-08-28**

Questions the documentation cannot answer. **Add to this file rather than
guessing or asking a human mid-build.** An entry here is a bug in the docs.

Format: the question, why it cannot be answered from source, what was done
instead, and who can settle it.

## Status

**All eleven questions opened during the rebuild are resolved** — nine during
the 2026-08-27 documentation rebuild, two (Q10, Q11) during Phase 2/3
execution.
The list is kept as a record of how each was settled, because the reasoning
matters more than the answer.

| # | Question | Resolution |
| --- | --- | --- |
| Q1 | Who owns security headers? | **Nginx Proxy Manager** for transport headers; the app owns CSP (nonce) — [security-headers.md](../architecture/security-headers.md) |
| Q2 | Detail routes for leads and customers? | **Build both** — [detail-screens.md](../design/detail-screens.md) |
| Q3 | Lead conversion flow? | **Three-step drawer** with a persistent success panel — [detail-screens.md](../design/detail-screens.md#lead-conversion) |
| Q4 | Font validation | Availability + Arabic subset **verified**; visual density check deferred to phase 2 — see below |
| Q5 | Request-body field shapes | **Generated** — [dto-fields.md](../reference/dto-fields.md), 46 classes, 293 fields |
| Q6 | Test strategy | **Written** — [testing.md](../architecture/testing.md) |
| Q7 | Accessibility checklist | **Written** — [accessibility.md](../design/accessibility.md) |
| Q8 | Palette never rendered | **Computed and fixed** — `pnpm design:contrast`; see below |
| Q9 | Core / Trade enums and permissions | Core **extracted** (64 permissions); Trade deliberately deferred |

---

## Q4 — Font validation · partially closed

**Verified 2026-08-28** by fetching the Google Fonts CSS directly:

- **Readex Pro** — available, three weights, and a genuine Arabic subset
  (`U+0600-06FF`, `U+0750-077F`, `U+FB50-FDFF`, `U+FE70-FEFC`) alongside latin
  and latin-ext.
- **DM Mono** — available at 400 and 500.
- **Zain** — available, confirmed as a viable fallback.

**Still open:** whether Readex Pro's Arabic is too wide for a 40px table row at
`text-xs`. That needs a rendered look, which this environment could not
reliably produce.

**Action in phase 2:** load the fonts, open a populated table in Arabic, and
look. If rows overflow, switch to **Zain** and record the change in
[typography.md](../design/typography.md).

---

## Q8 — Palette · closed, and it caught three real defects

`node scripts/design/contrast.mjs` now computes every ratio from the OKLCH
values rather than estimating them. Running it the first time found:

1. **Five brand steps were outside the sRGB gamut** (500–900, chroma 6–15% too
   high). The browser would have silently clipped them to a different color
   than specified. Chroma reduced to 96% of the in-gamut maximum; all steps now
   resolve cleanly.
2. **"`negative-600` fails contrast" was false** — it measures 5.09 and would
   have been acceptable. `negative-700` is kept as a *margin* choice, and the
   documented reason is corrected.
3. **"No amber step clears AA against both labels" was false** —
   `caution-500` with an `ink-950` label measures 8.42. The rule *"amber is
   never a filled button"* stands, but on **semantic** grounds, not contrast.

All twelve required pairings now pass. The tightest is `brand-500` as the light
focus ring at **3.19** against a 3.0 bar — noted in
[tokens.md](../design/tokens.md#contrast-resolution) so nobody erodes it.

---

## Q9 — Trade permissions · deliberately deferred

Core's 64 tenant permissions are extracted into
[permissions.md](../reference/permissions.md#core-tenant-permissions), from the
controllers — there is no packaged catalogue for them.

Trade has 231 Gateway routes and **no portal screen**. Enumerating its
permissions now would produce documentation that rots before it is read.
Extract from `trade-app/src/**/*.controller.ts` when a Trade screen is first
built, and add the section in the same change.

---

## Q10 — Hand-rolled theme mechanism vs. `next-themes` · resolved

`docs/build/PHASE-2-FOUNDATION.md`'s theming step and
[theming.md](../design/theming.md) give exact code for a hand-rolled
`ThemeProvider` (`useSyncExternalStore` over `tenant_theme`, driven by the
same inline bootstrap script that also fixes D4's language/direction flash).
[DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md)'s library table separately
lists `next-themes` — "Well-tested flash prevention; do not reimplement" —
among the full system's dependencies.

DESIGN-SYSTEM.md's supersession notice at the top names exactly what it
overrides: "the warm-neutral palette and the 36px/40px density in
tokens.md and geometry.md." It does not name theming.md, and its library
table reads as a survey of every dependency the finished system uses across
all phases (it also lists 16 Radix packages and `sonner`, which are Phase 3
material), not a phase-2-specific instruction.

**Assumed:** implemented Phase 2 exactly as theming.md/PHASE-2-FOUNDATION.md
specify — no `next-themes`. One atomic inline script sets both `lang`/`dir`
and the initial `.dark` class before hydration; a second, separate
`next-themes` script would only cover the theme half and add a second
blocking script for no compounding benefit. `ThemeProvider` lives at
`src/design-system/theme/ThemeProvider.tsx` (no path was specified for it).

**Settle with:** if a later phase wants `next-themes` specifically, swapping
it in is a contained change — `ThemeProvider`'s public shape
(`{ theme, isDark, setTheme }`) and the `tenant_theme` storage key can stay
the same either way.

## Q11 — Shell size tokens: shell.md vs. DESIGN-SYSTEM.md · resolved

[shell.md](../design/shell.md) defines `--size-topbar: 3rem` (48px),
`--size-sidebar: 15rem` (240px), `--size-sidebar-rail: 3.25rem` (52px).
[DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md) §3 defines the same three
concerns under slightly different names — `--size-topbar: 2.75rem` (44px),
`--size-sidebar: 14.5rem` (232px), `--size-rail: 3rem` (48px) — and opens §7
with "Shell for every authenticated page: 232px sidebar (48px rail) + 44px
topbar," restating shell numbers directly rather than only general density.

Same resolution as Q10: DESIGN-SYSTEM.md is the newer (2026-08-28 vs
2026-08-27), more specific "decisions" file, and gives explicit conflicting
values for tokens it names itself — not silence on a mechanism shell.md
owns. **Assumed:** DESIGN-SYSTEM.md's numbers (44px/232px/48px) win; already
implemented in `globals.css`'s Phase 2 commit (`--size-topbar`,
`--size-sidebar`, `--size-rail`). Use these same token names and values when
building `AppShell` in Phase 3 — do not reintroduce shell.md's
`--size-sidebar-rail` name or its 48/240/52 values.

## How to add one

Do not delete a resolved entry — the reasoning is the value. Append new
questions below with the same shape:

```markdown
## Q10 — <the question>

<why it cannot be answered from source>

**Assumed:** <what you did instead>
**Settle with:** <who or what closes it>
```
