# Cold-Blue Design Update Roadmap

Status: **[Source migration complete; runtime conformance remains]**

Plan approval: **2026-08-29**

Current-source audit: **2026-08-29**

Owner: **Admin Portal**

## Migration policy

The update is incremental and semantic-first. Do not perform a global color
search-and-replace or treat a successful build as visual completion.

Each phase must preserve dark mode, Arabic/RTL, permission behavior, transport
semantics, and operator recovery evidence. Current API/backend contracts are out
of scope unless a separate task explicitly authorizes them.

## Phase 0 — Make drift visible

Implementation status: **Complete, with one recorded evidence waiver.**

- Correct `scripts/design/census.mjs --check` so reviewed baseline drift exits
  nonzero.
- Add the approved target documents to the required documentation-check list.
- Audit `src/design-system` as well as feature code.
- Count direct ramp utilities, theme-sensitive `white`, stock shadows, raw chart
  hex values, sub-floor text, missing reduced-motion variants, native one-off
  controls, and hand-built tables.
- Capture representative current screenshots before token changes.

The census now scans 686 source files, fails on undeclared drift, and records no
prohibited categories in the reviewed baseline. The requested pre-change
screenshots were missed. They were not reconstructed after implementation,
because checking out the prior source would be destructive and could overwrite
user changes; this is an explicit evidence waiver, not a substituted artifact.

Exit: the baseline is truthful, documented, and capable of failing CI.

## Phase 1 — Semantic token foundation

Implementation status: **Source complete.**

- Introduce `action`, `success`, `surface`, `warn`, `danger`, and `ink` contracts.
- Map existing emerald `brand` usage to success before introducing action blue.
- Implement the cold-blue light surface ramp.
- Preserve current dark surfaces.
- Convert shared primitives and shell components before feature routes.
- Replace theme-sensitive direct white, brand, and ink values with semantics.

Exit: changing semantic tokens repaints every shared primitive without feature
component edits.

## Phase 2 — Shared accessibility and interaction

Implementation status: **Source and unit coverage complete; full keyboard,
screen-reader, coarse-pointer, and runtime target-size evidence remains.**

- Implement actual coarse-pointer hit areas.
- Add skip-to-content and route focus.
- Add localized accessible names and consistent focus rings.
- Build the missing Combobox and replace `CountrySelect`.
- Replace hand-built menus/disclosures with design-system primitives.
- Add reduced-motion behavior to every animated primitive.
- Make dialog, sheet, menu, and alert labels bilingual.

Exit: shared primitives pass keyboard, target-size, accessible-name, focus-return,
and reduced-motion tests.

## Phase 3 — Critical workflows and shell

Implementation status: **Source and public-auth-state coverage complete;
authenticated, keyboard-only, and screen-reader workflow evidence remains.**

- Create a shared AuthShell; repair login validation and persistent failures.
- Repair tenant-creation labels, step semantics, summaries, and focus recovery.
- Build one nested permission-filtered route tree for shell, breadcrumbs, mobile
  navigation, and command search.
- Make topbar, PageHeader, breadcrumbs, and SubNav stable at 320–360px.
- Correct WebPhone collision, safe-area, RTL positioning, and focus management.

Exit: auth and tenant creation work in both languages, themes, keyboard-only,
screen-reader smoke tests, and narrow widths.

## Phase 4 — Data surfaces

Implementation status: **Shared source migration and unit coverage complete;
the required real-viewport table matrix remains.**

- Upgrade FilterBar to persistent labels and named date groups.
- Upgrade DataTable sorting, refreshing, selection, scroll-region access, and
  live status.
- Flatten nested data cards and standardize row action overflow.
- Add selection-scope and bulk-action patterns.
- Define one responsive strategy for every production table.

Exit: table refresh preserves data/focus and all table controls are keyboard
complete at desktop and narrow widths.

## Phase 5 — Charts and operational evidence

Implementation status: **Chart tokens, palette source guard, viewport-lazy
loading, reserved dimensions, reduced-motion fallback, and representative
dashboard refresh guarding are implemented. Runtime CVD and performance
measurements, plus product-wide refresh integration, remain.**

- Introduce validated chart-specific tokens.
- Add legends/direct labels, localized summaries, and data-table alternatives.
- Make axes, formatting, and layout locale/RTL aware.
- Connect chart animation to reduced motion and lazy-load below-fold charts.
- Apply the operational state, freshness, notification, and destructive-action
  contracts to representative domains.

Exit: charts and asynchronous operations expose exact values and recovery
evidence without hover or color dependence.

## Phase 6 — Route migration and verification

Implementation status: **Source migration complete; protected-route and full
conformance-matrix verification remains.**

- Migrate remaining routes in risk order, beginning with shared/high-frequency
  screens.
- Run the complete language/theme/width/state matrix from
  [Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#verification-matrix).
- Record route-level evidence in the
  [UI quality matrix](../audit/ui-quality-matrix.md).
- Record source, unit, type, lint, build, authenticated runtime, and deployment
  evidence independently.
- Update current-source design documents only after each phase is verified.

Exit: no unreviewed visual drift, no dark/RTL regression, and authenticated
representative workflows satisfy the target contracts.

## Recommended change-set boundaries

1. Audit enforcement and semantic tokens.
2. Shared primitives and shell accessibility.
3. Authentication and tenant creation.
4. FilterBar, DataTable, bulk actions, and responsive data surfaces.
5. Charts, operational states, and WebPhone safety.
6. Remaining routes, visual regression, and documentation closure.

Avoid one large reskin commit; it makes semantic regressions and source evidence
too difficult to review.

## Definition of done

Source implementation gates are complete: typecheck and lint pass; 1,168 tests
across 199 files pass; the RTL guard reports zero violations; the 686-file
design census reports no prohibited categories and its baseline check passes;
and documentation checks cover 75 Markdown files and 246 routes. These checks
do not replace the runtime evidence below.

- Cold-blue light surfaces are consistent across shell, auth, forms, tables,
  dialogs, and dashboards.
- Action blue and success green are independent semantic roles.
- Shared primitives contain no theme-sensitive direct palette dependencies.
- Dark mode and Arabic/RTL remain fully functional.
- Critical targets, focus, forms, menus, tables, and charts meet their documented
  accessibility contracts.
- Refresh, stale, partial, forbidden, ambiguous, and terminal states are distinct.
- The design census fails on undeclared drift.
- Authenticated runtime evidence exists for representative protected workflows.

The source-level portions of these targets are implemented. Runtime-dependent
portions—including dark/RTL parity across protected routes, critical-control
accessibility, operational-state behavior, authenticated workflows, the full
keyboard/screen-reader/responsive/zoom/coarse-pointer matrix, CVD review, and
performance measurements—remain open. Limited public observations are recorded
in the [UI quality matrix](../audit/ui-quality-matrix.md).
