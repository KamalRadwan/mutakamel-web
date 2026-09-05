# Design System

Status: **[Verified current-source index; approved target linked below]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

## Purpose

This is the index for both the current Admin Portal design-system source and
the approved cold-blue update. The two evidence levels are intentionally
separate:

- the existing token, primitive, pattern, shell, and migration documents record
  current source and known conformance gaps;
- [Cold-Blue Design Update](design-update.md) and its related contracts define
  the approved target and are not implementation evidence.

When current source and the target differ, source remains authoritative for
runtime claims until the corresponding roadmap phase is implemented and
verified. New design work follows the approved target.

## Target laws

1. **Separate action from outcome.** Cobalt communicates interaction and
   information; emerald communicates success and health. The transitional
   `brand` role may not keep both meanings.
2. **Accessible compactness.** Dense layouts use controlled spacing and a
   compressed type scale, never invisible focus, undersized Arabic text, or
   inaccessible targets.
3. **One primary action per visible surface.** A page, dialog, or drawer has
   at most one filled primary action. Secondary and row actions stay quiet.
4. **Operational state is explicit.** Loading, refreshing, stale, partial,
   forbidden, failed, and ambiguous outcomes are different states with
   different recovery behavior.
5. **Bilingual parity is structural.** Arabic/RTL and English/LTR share the
   same capability, route meaning, focus behavior, and evidence quality.

## Map

| Area | Reference |
| --- | --- |
| **Approved cold-blue visual and interaction target** | [design-update.md](design-update.md) |
| **Operational state, feedback, permission, and safety UX** | [operational-ux.md](operational-ux.md) |
| **Filters, tables, bulk selection, and charts** | [data-experiences.md](data-experiences.md) |
| **Accessibility, responsive behavior, localization, and performance** | [accessibility-responsive-and-localization.md](accessibility-responsive-and-localization.md) |
| **Implementation phases and exit gates** | [design-update-roadmap.md](design-update-roadmap.md) |
| Color roles, OKLCH ramps, contrast ratios | [tokens.md](tokens.md) |
| Font pairing, type scale, weight policy, Arabic lift | [typography.md](typography.md) |
| Radius, spacing, control/row heights, elevation budgets | [geometry-and-density.md](geometry-and-density.md) |
| The 26 primitives (Button, Field, Dialog, Table, …) | [primitives.md](primitives.md) |
| The 15 composite patterns (DataTable, FormDrawer, …) | [patterns.md](patterns.md) |
| Sidebar, topbar, command palette, and 54-route inventory | [shell-and-navigation.md](shell-and-navigation.md) |
| Local-storage-resolved theme/language and RTL direction wiring | [theming-and-direction.md](theming-and-direction.md) |
| Where a write result belongs — toast vs. in-body | [toast-contract.md](toast-contract.md) |
| Codemod inventory, phase gates, census baselines | [migration.md](migration.md) |
| **UI/UX Pro Max compatibility audit** | [SKILL-AUDIT.md](SKILL-AUDIT.md) |

## Where the code lives

```text
src/design-system/
  index.ts        # public barrel — feature code imports only from here
  lib/             cn.ts, variants.ts
  primitives/      26 files — see primitives.md
  patterns/        15 directories — see patterns.md
  shell/           AppShell, Sidebar, Topbar, SubNav, MobileNav, CommandPalette,
                    nav-config.ts, useNavTree.ts, useSidebar.ts
  feedback/        ToastProvider, useToast, AppToast, toast-bridge
```

`src/app/globals.css` is the current implementation token source of truth;
[design-update.md](design-update.md) is the approved future-state contract.
`AGENTS.md` requires
feature code to import design-system pieces only from `@/design-system` (the
barrel), not by reaching into `src/design-system/primitives/Button` directly
— that indirection is what let every one of the 54 routes repaint from a
handful of files instead of 552.

## Verification

The intended verification command set is run from `admin-portal/`:

```bash
npx tsc --noEmit
rm -rf .next && pnpm build
pnpm lint
pnpm test
node scripts/design/census.mjs --check
node scripts/design/rtl-guard.mjs
```

A green run of the commands proves only their named source/build evidence.
It does not prove contrast, accessible names, keyboard completion, focus
management, responsive reflow, screen-reader behavior, or visual parity.
Those require the runtime matrix in
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#verification-matrix).

`census.mjs --check` currently reports drift but does not exit nonzero, and
its scan excludes `src/design-system`. Treat it as diagnostic until Phase 0 of
the [design-update roadmap](design-update-roadmap.md#phase-0--make-drift-visible)
closes both gaps.
