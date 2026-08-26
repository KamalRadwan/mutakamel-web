# Migration

Status: **[Verified]**

Last source verification: **2026-08-26**

Owner: **Admin Portal**

This is the record of how the app got from "552 files generated
screen-by-screen with no shared system" to the current design system. It
exists so a future change to any of the numbers below has a baseline to
diff against, and so nobody re-derives a decision (like why `warn` is never
a filled button) that was already made and reasoned about once.

## Verification gate

Every phase below was required to clear the same commands before it counted
as done, run from `admin-portal/`:

```bash
npx tsc --noEmit
rm -rf .next && pnpm build
pnpm lint
pnpm test
node scripts/design/census.mjs --check
node scripts/design/rtl-guard.mjs
```

`census.mjs` (`scripts/design/census.mjs`) counts color-utility usage by
Tailwind family, arbitrary type sizes, bold-or-heavier font weight sites,
`rounded-2xl`/`3xl` usage, gradients, `backdrop-blur`, physical RTL
utilities, `<Navbar />` render sites, hand-rolled `<table>` sites, and toast
call sites, and diffs the total against
`docs/design-system/census.baseline.json`. `--check` fails the phase's gate
on any undeclared regression; `--update` moves the baseline forward once a
phase's delta has been reviewed and is the *intended* delta, not an
accident. `rtl-guard.mjs` hard-fails if physical direction utilities
(`ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`) exceed
its limit (0, as of the current baseline — all real violations were fixed
early and the transitional headroom removed).

## Phase summary

**Part A — Foundation (Phases 0–7).** Safety net (census + RTL-guard
scripts, canary screenshots, a `feat/design-system` branch), dependency
scaffolding (`class-variance-authority`, Radix primitives, `sonner`,
`next-themes`, `@tanstack/react-table`, `cmdk`), the IBM Plex font pairing,
the token architecture in `globals.css` (brand/ink/warn/danger OKLCH ramps,
semantic roles, the 7-step type scale, the 5-step radius scale), route
groups (`(auth)`/`(shell)`), **the theme flip** (one `globals.css` edit that
remapped every Tailwind color family onto the four roles, repainting 9,000+
pre-existing call sites with zero `.tsx` edits), and the codemods that moved
literal `dark:` pairs and arbitrary sizes onto the new semantic scale. See
[tokens.md](tokens.md), [typography.md](typography.md), and
[geometry-and-density.md](geometry-and-density.md) for what each of these
actually produced.

**Part B — Component layer (Phases 8–14).** The toast system
([toast-contract.md](toast-contract.md)), the 26 primitives and 15 patterns
([primitives.md](primitives.md), [patterns.md](patterns.md)), and the app
shell — sidebar, topbar, command palette, and the full 54-route nav map
([shell-and-navigation.md](shell-and-navigation.md)) — which replaced the
permanently-dark, hue-coded 15-item `Navbar.tsx` entirely.

**Part C — Route conversion (Phases 15–21).** Per-route conversion to
`PageHeader`/`DataTable`/`FilterBar`/`FormDrawer`/toast, in ascending order
of risk: `/roles`, `/users`, infrastructure (`/database-servers`,
`/storage-servers`), `/backup`, billing/reporting (partial —
`invoice-shared.tsx` primitives only; `reports-screen.tsx`,
`LoggingScreen.tsx`, `SubscriptionsScreen.tsx`,
`control-plane-audit-screen.tsx`, `AdminNotificationsScreen.tsx`, and the
three invoice screens' internals were explicitly deferred given remaining
scope). **Phases 20 (`/provisioning`, all 9 routes) and 21 (catalogue,
settings, tenants, dashboard route shells) were not attempted** — a
deliberate scope decision given file sizes (`tenants/[id]` alone is 4,189
lines) and the phase count remaining. These routes still compile and pass
their existing tests unchanged; they carry the Phase 6/7 token flip "for
free" but were not converted to the pattern layer.

**Phase 22 — Dashboard charts.** Recovered the 37 chart components deleted
in commit `adb263e` (`recharts` had been installed with zero imports since).
Rather than restoring all 37 unconditionally, each was checked against the
real `analytics`/`overview`/`panels` data contract in
`src/types/dashboard.ts`: 9 wired to always-present `overview`/`panels`
data, 14 more wired to `analytics.subscriptions.*`/`analytics.billing.*`
(each handling the `DashboardDataset` available/unavailable union so an
unconfigured backend projection renders `UnavailableDashboardPanel` instead
of fabricated data), and the remaining 17 — which had no real field to bind
to — deleted rather than kept as unwired dead code. Also fixed
`formatDashboardMetric()` (was string-concatenating money values into
`"USD 1234567.5"`; now real, locale-aware `Intl.NumberFormat`) and collapsed
`toneToColorStyle()`'s 6-hue switch onto the brand/warn/danger/neutral role
set.

**Phase 23 — Content/i18n.** Fixed the specific hardcoded-English sites
called out for this phase (`TablePagination`, `useActionMutation`'s toast
titles; `useThemeToggle`/`useLanguageToggle` were already correct from an
earlier phase). Added a dictionary parity test. **Explicitly not
attempted:** the full 428-inline-ternary-across-80-files inventory, and
`dispatchForbiddenToast`'s hardcoded `"Access Denied"` string in
`axiosClient.ts` — that file is this migration's non-negotiable, untouchable
data-layer boundary and had unrelated in-progress changes from a concurrent
process at the time.

**Phase 24 — Docs.** This file and its siblings.

**Phase 25 — Hardening.** Attempted to flip the design-system ESLint rules
from warn to error per the original plan, and found the rule had been
**silently dead since it was introduced**: two `eslint.config.mjs` blocks
both set `rules["no-restricted-syntax"]` for the same non-design-system
`.ts`/`.tsx` files (one for the 7 migration patterns, one for the toast
double-fire check), and flat config resolves duplicate rule ids per file by
last-write-wins, not by merging arrays — so only one block's patterns were
ever active, and it happened to be the toast-only block. None of the
7 migration patterns (arbitrary text size, bold weight, raw palette color,
gradient budget, blur budget, `rounded-2xl`/`3xl`) had ever actually fired
in a `pnpm lint` run, in any phase of this migration, despite lint being a
gate on every one of them. Fixed by merging same-scope patterns into one
array; running lint against the fix surfaced 2,574 real warnings (mostly
raw-palette-color, concentrated in the Phase 20/21 routes that were never
converted) that had been invisible the entire time. Flipping the whole rule
to "error" as originally planned would have failed the build on all 2,574 —
not safe given Phases 20/21 remain unconverted. Instead: the two patterns
with zero real violations (`font-(black|extrabold|bold)`,
`rounded-(2xl|3xl)`) are now hard errors; the rest stay warnings until the
deferred routes convert. Also: verified `.field`/`.primary-button`/
`.secondary-button`/`.danger-button` and `useAccessibleDialog.ts` still have
real call sites in those same deferred routes and left them in place rather
than deleting live-dependency code — only `.webphone-user-input` (confirmed
zero call sites) was removed. `Navbar.tsx` and the 3 passthrough layouts
were already gone (Phase 14). Confirmed `recharts` and the Phase 22 chart
components are imported only from `(shell)/dashboard/`, so their ~500KB
chunk is route-split and not part of every page's shared bundle.

## Current state vs. the numbers this migration started from

The plan that opened this migration measured, before Phase 0: 9,154
color-utility usages across 14 Tailwind color families (six of them —
blue/cyan/indigo/violet/purple/sky — competing for the single "informational
accent" job); 69% of all text at 12px or smaller (415 arbitrary
`text-[8px]`–`text-[11px]` plus 1,030 stock `text-xs`); 1,078 bold-or-heavier
font-weight sites (280 of them `font-black`) against 101 normal/medium; zero
loaded fonts; 467 hand-rolled `<button>` elements against 21 using a shared
class; and a permanently-dark 15-item navbar with per-item hue-coded icons.

The current baseline (`census.baseline.json`, updated through Phase 22):

| Metric | Current |
| --- | --- |
| Color families in use | **13** (was 14 — see below) |
| `fontBoldOrHeavier` | **0** |
| `rounded-2xl`/`rounded-3xl` | **0** / **0** |
| `physicalRtlViolations` | **0** |
| `navbarRenderSites` | **0** |
| `toastCallSites` | **153** |

**Why "13 families in use", not "4 roles"**: the census counts literal
Tailwind class names still present in source (`text-slate-500`,
`bg-emerald-500`, …), not which *token* they resolve to. Every one of those
13 families is remapped by the theme flip onto one of the four roles at the
CSS variable level — `slate` (3,804 sites) and `emerald` (413) and `rose`
(570) all render correctly on the new palette today — but Phase 7's codemod
to rewrite the class names themselves onto semantic tokens (`bg-slate-900`
→ `bg-card`) covered roughly the top 120 highest-frequency pairs, not every
site in the app. The remaining literal family names are functionally
correct, not yet renamed; a future pass that pushes `colorFamiliesInUse`
toward 4 (rather than "13 families whose CSS variables happen to all point
at 4 ramps") is renaming work, not a visual bug.
