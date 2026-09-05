# Migration

Status: **[Verified historical record; next target approved]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

This is the record of how the app got from "552 files generated
screen-by-screen with no shared system" to the current design system. It
exists so a future change to any of the numbers below has a baseline to
diff against, and so nobody re-derives a decision (like why `warn` is never
a filled button) that was already made and reasoned about once.

## Next design update

The emerald-primary migration recorded below is not the final visual contract.
The approved cold-blue update separates cobalt `action` from emerald `success`,
adds operational UX and accessibility contracts, and corrects enforcement gaps
discovered after this migration was documented.

Use [Cold-Blue Design Update](design-update.md) for the target and
[Cold-Blue Design Update Roadmap](design-update-roadmap.md) for implementation
phases. The historical phase record below is preserved as evidence rather than
rewritten as if the new design already shipped.

## Verification gate

Every phase below was intended to clear the same commands before it counted as
done, run from `admin-portal/`:

```bash
npx tsc --noEmit
rm -rf .next && pnpm build
pnpm lint
pnpm test
node scripts/design/census.mjs --check
node scripts/design/rtl-guard.mjs
```

`census.mjs` (`scripts/design/census.mjs`) scans all of `src`, including
`src/design-system`. It counts stock and product-ramp utilities, direct white,
stock shadows, raw chart hex values, sub-13px text, visible-motion sites
without a reduced-motion variant, native one-off controls, hand-built tables,
and the earlier geometry, typography, RTL, navigation, and toast signals. The
canonical native input/button/textarea owners and canonical Table primitive
are excluded only from their corresponding one-off counts.

`--check` hard-fails on file-count, metric, or family-distribution drift.
`--update` moves `docs/design-system/census.baseline.json` only after review.
`rtl-guard.mjs` independently hard-fails if physical direction utilities
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
  shell — sidebar, topbar, command palette, and the 54-route inventory
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
scope).

**Phase 20 — `/provisioning` (all 9 routes) is now complete**: the
governance screen (3 `DataTable`s, `Tabs`, `AmbiguousOutcomePanel` for the
discovery-run mutation), the fleet module (`FleetDirectoryScreen`,
`FleetPreviewScreen`, `FleetRolloutScreen`, plus `shared.tsx`'s hero/dialogs),
`PublisherKeysScreen`, and the releases module (index, detail, draft, and
draft-detail screens plus `release-shared.tsx`/`release-definition-form.tsx`)
all render through `PageHeader`/`DataTable`/`Dialog`/`AlertDialog`/`Field`
now. Every `CommandFeedback`/`MutationFeedback` state machine that carries
idempotency-key evidence stayed in-body as `AmbiguousOutcomePanel`, per the
non-negotiable in the original plan.

**Phase 21 is effectively complete.** The dashboard route shell is done:
`DashboardHeader` (`PageHeader` + range/auto-refresh controls),
`DashboardTabsNav` (`Tabs`, dropped the 14-hue per-tab icon map), `page.tsx`
(`Skeleton`, token-based error/forbidden panels), `DashboardGroupsOverview`
and `DashboardGroupPanel` (`Card`/`Badge`, blue/green/amber/slate tones
collapsed onto the brand/warn/danger/neutral roles), `KpiCard` (renders
through the shared `StatCard` pattern), and every chart component under
`components/charts/` have zero raw-palette-color lint warnings.
Applications-catalogue is fully converted. `tenants/[id]` was refactored
into `src/features/admin/tenant-workspace/` (access/billing/core/
provisioning/storage sub-modules) — no longer a single 4,189-line file;
every panel in that module (`TenantFqdnPanel`, `TenantProfilePanel`,
`TenantLifecyclePanel`, `TenantBillingPanel`, `TenantWorkspaceScreen`, the
access panel/dialogs) renders through `Card`/`CardHeader`/`Badge`/`Button`.
**The tenant-creation wizard and Settings pattern-layer gap are now closed
too.** `tenants/new/*` (`page.tsx`, `TenantApplicationsStep.tsx`,
`TenantInfrastructureStep.tsx`, `TenantAddressGeocoding.tsx`) renders every
input/select/checkbox/textarea/button through the shared primitives now; the
wizard's create-recovery banner (a client-persisted idempotency-key retry
marker) moved from a hand-rolled warn box to `AmbiguousOutcomePanel`. The
5-pill step nav and the tri-state loading/forbidden/empty tiles stayed
hand-rolled deliberately — no stepper or generic tri-state primitive exists
elsewhere to align with, the same "forbidden ≠ a 403 client gate" pattern
already accepted, unmigrated, in `invoice-shared.tsx`/`release-shared.tsx`.

Settings converted the same way: `SettingsSidebar` moved from a vertical
icon list to `SubNav` (adding `SETTINGS_SUBNAV` to `nav-config.ts`, which
finally makes `SubNav`'s own doc comment — "Backup, Settings, and
Provisioning all use this" — true); `SettingField.tsx`'s boolean/string/
number/enum controls moved to `Switch`/`Input`/`Select`; `SettingSearch`,
`SaveSettingsBanner`, and `SettingsResourceBoundary` moved to `Input`/
`Button`/`ErrorState`; `AuthSessionsPanel` and `AuthInvalidationReplayPanel`
moved to `Button`/`Badge`/`Field`/`ConfirmActionModal`. The real pre-existing
gap flagged here previously — `useSettings.ts` tracking idempotency-key/
ambiguous-write-outcome evidence internally but never exposing it, so an
unconfirmed save only ever showed a toast that disappeared — is fixed:
`SettingFieldData` now carries `ambiguous`/`idempotencyKey`/`correlationId`,
and `SettingField` renders `AmbiguousOutcomePanel` with a working
retry-exact action instead. The same gap existed a second time in
`useAuthInvalidationReplay.ts` (an idempotency key computed and retained per
retryable fingerprint, never returned) and got the identical fix.

**`/settings/webphone` was not part of that pass** and stayed on the
pre-migration idiom — it was written after the settings conversion, against
raw `slate`/`blue`/`rose`/`emerald`/`amber` pairs with explicit `dark:`
variants, `font-bold`/`font-black`, `text-[11px]`, `rounded-2xl`, and
hand-rolled `<button>`/pill elements. Because its sidebar link still pointed
at the deleted `/settings/asterisk`, the screen was unreachable, so nobody hit
it and lint was never run against a route anyone was looking at. Converted
2026-09-03: 120 `no-restricted-syntax` errors to zero. Every light/dark pair
collapsed into one semantic token (`bg-card`, `bg-muted`, `border-border`,
`border-input`, `text-foreground`, `text-muted-foreground`, `text-info`,
`text-warning`, and the `*-subtle` pairs for success/warning/destructive),
11 hand-rolled buttons became `Button` (`primary`/`secondary`/`destructive`/
`ghost`), and 4 status pills became `Badge`. The one deliberate visual change:
`SeatCounter`'s over-allowance pill used a second, darker amber tint that the
single `warning-subtle` token cannot express, so it took a `border-warning`
outline to stay legible on the tinted card. (`SeatCounter`, `ScopeSection` and
`ExtensionsSection` were deleted later the same day when the screen was cut back
to the SIP server chain — the token lesson stands, the component does not.)

`StatCard` (`src/design-system/patterns/kpi/StatCard.tsx`) gained an optional
`tone` prop (`brand`/`warn`/`danger`/`neutral`) driving an icon badge and a
top-border accent, so the dashboard's per-metric semantic coloring could move
onto the same shared primitive every other KPI tile in the app already uses
(backup, storage-servers, database-servers, users, applications-catalogue,
roles, subscriptions) instead of staying a one-off. The prop is optional and
every existing untoned call site is unaffected.

### Phase 22

**Dashboard charts.** Recovered the 37 chart components deleted
in commit `adb263e` (`recharts` had been installed with zero imports since).
The first pass wired 9 to always-present `overview`/`panels` data and 14
more to `src/types/dashboard.ts`'s `analytics.subscriptions.*`/
`analytics.billing.*` fields, deleting the remaining 17 that had no field to
bind to. **That first pass trusted the frontend type contract without
checking the backend, and was wrong about a large piece of it** — corrected
in a follow-up once a parallel session grepped the actual Core service:

- `analytics` has **no backend producer at all**. `AdminDashboardResponse`
  (`core-app/.../admin-dashboard.service.ts`) is `{asOf, authorizedGroups,
  range, sections, panels, overview} & DashboardGroups` — no `analytics`
  key, anywhere. `data.analytics` is always `undefined` at runtime, so
  `{analytics && (...)}` never executed. All 14 of those chart components
  were unreachable dead code from the moment they were wired, not "gated
  for when the backend catches up" — there was never a producer to catch
  up. They and the 8 chart-primitive files they alone depended on
  (`BaseBarChart` included) were deleted; see
  `DashboardOverviewCharts.tsx`.
- `overview.domainHealth.regions` is not intermittently missing, it is
  **always** stripped: Core's `filterOverview` rebuilds `domainHealth` as a
  literal object listing only 6 fields, `regions`/`countries` excluded, even
  though the upstream `domainHealth` object it filters from has both. This
  is what actually caused the "can't access property 'length',
  overview.domainHealth.regions is undefined" production crash the first
  defensive-guard fix (below) patched around. The real per-country data
  does reach the browser, at a different path — the `tenants` group's
  `breakdowns.byCountry`, built from the same `countryBreakdown: 
  DashboardRegionItem[]` source. `RegionalDistributionBarChart` now reads
  from there instead.

The lesson: `src/types/dashboard.ts` is a frontend-authored guess at the
response shape, not verified backend evidence — AGENTS.md's source
precedence (Gateway/Core source outranks frontend types) applies to
internal type files too, not just docs. A type declaring a field doesn't
mean a controller sends it.

A follow-up crash fix (separate from this correction) added a `safeArray()`
guard around every array read in `DashboardOverviewCharts.tsx`, since the
`regions` finding proved the declared-vs-actual gap is real and not
limited to that one field.

Also fixed `formatDashboardMetric()` (was string-concatenating money values
into `"USD 1234567.5"`; now real, locale-aware `Intl.NumberFormat`) and
collapsed `toneToColorStyle()`'s 6-hue switch onto the brand/warn/danger/
neutral role set — both still stand.

**Phase 23 — Content/i18n.** Fixed the specific hardcoded-English sites
called out for this phase (`TablePagination`, `useActionMutation`'s toast
titles; `useThemeToggle`/`useLanguageToggle` were already correct from an
earlier phase). Added a dictionary parity test.

The full inline-ternary inventory this phase originally deferred (`lang ===
"ar" ? … : …` scattered outside `src/i18n/dictionaries/{en,ar}.ts`, instead
of living in the shared dictionary) was picked back up in a later session
and closed out completely: the real count once boolean-derived variants
(`const isArabic = lang === "ar"`, then `isArabic ? … : …` at dozens of call
sites per file) were included was 487 sites across 99 files, not the
originally-estimated 428/80 — that estimate came from a grep pattern that
only matched the literal `lang === "ar" ?` shape and missed the
boolean-derived one entirely. Every genuinely scattered site is now
converted; a large minority of the original count turned out to already be
acceptable local bilingual patterns that don't belong in the central
dictionary (a per-file `const copy = lang === "ar" ? AR : EN` object, a
`Record<Key, [en, ar]>` translation-lookup table, or a design-system
primitive branching on its own `lang` prop for a few words of built-in
micro-copy) — see the dictionary/i18n docs for how to tell the two apart.
`dispatchForbiddenToast`'s hardcoded `"Access Denied"` string in
`axiosClient.ts` remains untouched — that file is this migration's
non-negotiable, untouchable data-layer boundary.

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
raw-palette-color, concentrated in the Phase 20/21 routes that were
unconverted at the time) that had been invisible the entire time. Flipping
the whole rule to "error" as originally planned would have failed the build
on all 2,574 — not safe given how much of the app was still unconverted, so
this phase originally promoted only the two patterns with zero real
violations (`font-(black|extrabold|bold)`, `rounded-(2xl|3xl)`) to hard
errors and left the rest as warnings.

**That blocking condition is now gone.** Every one of the 7 migration
patterns is confirmed at zero real violations app-wide (see the numbers
table below); the whole `no-restricted-syntax` rule — all 7 migration
patterns plus the toast double-fire check — is now `"error"`, in both
`eslint.config.mjs` blocks (app code and `src/design-system/` itself). The
toast double-fire check's AST selector has a known false-positive shape
(matches "catch block contains both a toast.error(...) call and a
403/AUTHORIZATION literal", not whether they're in mutually-exclusive
branches) — every real site of that shape in this app has already been
resolved by extracting a shared `isForbiddenError(err)` helper (see e.g.
`src/app/(shell)/users/api/adminUsersApi.ts`) so the literal no longer
co-occurs with the toast call; if this ever fires on genuinely correct new
code, that extraction is the fix, not disabling the line — see the comment
above the rule definition in `eslint.config.mjs`.

Also from the original Phase 25 pass: `.field`/`.primary-button`/
`.secondary-button`/`.danger-button` and `useAccessibleDialog.ts` still had
real call sites in the then-deferred routes and were left in place rather
than deleting live-dependency code; only `.webphone-user-input` (confirmed
zero call sites) was removed at the time. `Navbar.tsx` and the 3 passthrough
layouts were already gone (Phase 14). Confirmed `recharts` and the Phase 22
chart components are imported only from `(shell)/dashboard/`, so their
~500KB chunk is route-split and not part of every page's shared bundle.

**Follow-up closure:** once every route finally converted, `.field`,
`.secondary-button`, and `.danger-button` had zero remaining call sites and
were deleted from `globals.css`; `.primary-button`'s one remaining call site
(`TenantWorkspaceScreen.tsx`) was swapped to the `Button` primitive, then
that class was deleted too. `useAccessibleDialog.ts` had already been
deleted once its last consumer converted to the design-system `Dialog`.
Phase 25.2/25.3 are now fully closed, not just partially.

## Current state vs. the numbers this migration started from

The plan that opened this migration measured, before Phase 0: 9,154
color-utility usages across 14 Tailwind color families (six of them —
blue/cyan/indigo/violet/purple/sky — competing for the single "informational
accent" job); 69% of all text at 12px or smaller (415 arbitrary
`text-[8px]`–`text-[11px]` plus 1,030 stock `text-xs`); 1,078 bold-or-heavier
font-weight sites (280 of them `font-black`) against 101 normal/medium; zero
loaded fonts; 467 hand-rolled `<button>` elements against 21 using a shared
class; and a permanently-dark 15-item navbar with per-item hue-coded icons.

The current baseline (`census.baseline.json`, regenerated 2026-08-29 for
roadmap Phase 0) is the machine-readable source for current counts. It covers
the whole application, including shared design-system code, and records known
migration debt rather than claiming conformance. Keep the values in the JSON
instead of duplicating a table here; every reviewed implementation phase can
then update one authoritative snapshot.

The legacy stock Tailwind-family counter now uses the same `.ts`/`.tsx` scope
as `colorUtilityTotal`, eliminating the former `globals.css` comment false
positives. The separate direct-ramp total and per-family map expose remaining
`brand`, `ink`, `warn`, `danger`, `action`, `surface`, `success`, and `info`
usage even when the stock-family count is zero. A semantic-token migration is
therefore visible instead of being mistaken for completion.

`handRolledTables: 3` is the last real, honest signal of unconverted
surface: `LoggingScreen.tsx`'s `LiveRowsTable` (a continuously-appending
live-tail panel with no stable page/total-pages concept — `DataTable`'s
`pagination` prop is required, not optional, so this is a genuine fit
mismatch, not an oversight) and `TenantProvisioningWorkspaceView.tsx`
(converted for i18n in a later session; its table was not in scope for
that pass).
