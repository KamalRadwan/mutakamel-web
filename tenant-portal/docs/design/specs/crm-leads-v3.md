# CRM Leads v3: Ocean Navy restyle (spec, lead decisions, token contract)

Status: in implementation (2026-10-26). Reference image: [`../mockups/crm-leads-v3.png`](../mockups/crm-leads-v3.png).

This page is the single source every implementer reads. Part 1 lists the lead's decisions,
which override the owner's spec wherever they differ. Part 2 is the exact token and
utility contract. Parallel tasks code against these names before the token task has
landed, so a name is never invented or renamed. Part 3 is the owner's original
specification.

## Part 1. Lead decisions (binding)

1. **Tokens, not a stylesheet.**
   - Every spec colour, shadow, gradient, radius and type size becomes a token in
     `src/app/globals.css`, sections 2-5.
   - Components use only the utilities in Part 2.
   - Component `.tsx` files carry no raw hex, `rgb()` or `oklch()`, and no arbitrary
     `[...]` colour, shadow or size values.
   - No new class selectors go into `globals.css`. The `.dossier-*` and `.trade-*`
     sections stay untouched in this round.
2. **Dark mode is mandatory.**
   - Every new semantic role has a `.dark` counterpart.
   - The spec gives only light values. The token task chooses dark values that keep
     the same meaning and pass `pnpm design:contrast`: at least 4.5:1 for text and
     at least 3:1 for non-text and UI boundaries.
3. **White-label survives.**
   - Spec blues equal the default `brand` ramp:

     | Spec hex | Brand step |
     | --- | --- |
     | `#EFF6FF` | 50 |
     | `#DBEAFE` | 100 |
     | `#BFDBFE` | 200 |
     | `#93C5FD` | 300 |
     | `#2563EB` | 600 |
     | `#1D4ED8` | 700 |
     | `#1E40AF` | 800 |

     Map them to `--color-brand-*` so a tenant brand still recolours them.
   - The navy header, the brand strip and the avatar gradient are fixed chrome. They
     are not white-labelled, which matches today's `--color-chrome`.
4. **Fonts.**
   - Latin uses **Plus Jakarta Sans**. Arabic uses **Cairo**. Load both through
     `next/font/google` in `src/app/fonts.ts`, with weights 400, 500, 600, 700 and 800.
   - IBM Plex Mono stays for monospace.
   - The weight ceiling that remaps bold, extrabold and black to 600 is lifted for 700
     and 800. 900 stays forbidden.
5. **Small type is allowed only through named steps.**
   - The steps are `text-micro` (10px, count chips only), `text-badge` (11px) and
     `text-caption` (12px). They are used only where Part 3 names them.
   - The Arabic lift (`html[lang="ar"]`) applies to every step. Like the pre-v3
     steps, the type steps are fixed rem values: the `--ui-scale` density multiplier
     scales chrome geometry (`--size-*`), not type.
6. **Gradients are allowed only as the named `bg-gradient-*` utilities in Part 2.**
   Raw `bg-linear-*`, `bg-radial-*` and `bg-conic-*` stay banned in feature code.
7. **"No purple" scope.** No violet, purple, indigo, fuchsia or pink appears in:
   - chrome
   - buttons
   - active tabs
   - avatars
   - stage and count badges
   - card borders and icons
   - KPI badges

   User-selectable data colours are exempt: the tag and card colour pickers' `purple`
   and `pink` swatches. Those are tenant data, not chrome.
8. **The "[ - ]" square is the outline "expand card" button** beside `…` on board cards.
   - Remove it from the card face.
   - Expanding stays reachable as an **"Expand card"** item inside `LeadCardMenu`,
     reusing i18n key `crmLeads.executive.expandCard`.
9. **Activity classification follows the spec exactly.** These rules live in
   `crm/shared/crm-activity-tone.ts`, which Customers and Opportunities share. Let
   `startOfToday` be local midnight.
   - `OVERDUE`: `due < startOfToday`
   - `TODAY`: `startOfToday <= due <= now`
   - `FUTURE`: `due > now`
   - `NONE`: no next activity

   When `activityAt` parses, it wins over the server `bucket`. The server bucket is
   only the fallback. Known follow-up: the server-side "Overdue Activity" KPI still
   counts `due < now`, and it is reported to the owner.
10. **Column activity bar.**
    - A column with zero leads renders 100% `activity-none`.
    - Otherwise the bar shows proportional segments, `count / columnTotal`, in the
      four activity colours with a 2px gap.
    - A zero-count segment never renders. There is no forced `flexGrow` minimum.
      Exception: the segment of the state the column is currently filtered by stays
      rendered and highlighted at count 0, with a minimal width, so the filter can be
      seen and cleared. This restores the pre-v3 behaviour.
    - Cards in CONVERTED and DISQUALIFIED stages show the neutral "Converted" or
      "Closed" pill and a neutral start bar instead of their activity state. This
      restores the pre-v3 behaviour.
    - The bar's denominator is the leads loaded in the column, not the server column
      total.
11. **Scope.**
    - This round covers the tenant-portal global shell, the shared design-system
      primitives and tokens, and `/crm/leads`.
    - The same round also carried the admin portal: tokens, fonts, Topbar, Sidebar,
      the primitives and the Topbar controls. Its primary blue is the `action` ramp,
      and `brand` stays its green alias.
    - Customers and Opportunities inherit the tokens, shell and primitives
      automatically. Their own boards are a later round.
    - Extracting a shared tokens package for both portals is a later round. Today
      each portal holds its own copy of the tokens.

## Part 2. Token and utility contract

All roles are declared in `:root` with a `.dark` counterpart and bridged through
`@theme inline`. The utility each name produces is listed.

### New ramps (section 2, theme-invariant)

| Ramp | Source | Notes |
| --- | --- | --- |
| `--color-accent-50…950` | Tailwind **sky** | 600 = `#0284C7` |
| `--color-aqua-50…950` | Tailwind **teal** | 600 = `#0D9488` |
| `--color-ember-50…950` | Tailwind **orange** | 500 = `#F97316` |
| `--color-navy-800/900/950` | spec header | 800 = `#132C52`, 900 = `#0F2342`, 950 = `#091526` |

Stars use the existing `caution` ramp at 500 (`#F59E0B`) if it matches Tailwind amber.
If it does not, add `--color-amber-500`. Check the theme-flip aliases first.

### Semantic roles to utilities

| Role (CSS var) | Light value | Utility |
| --- | --- | --- |
| `--surface-column` | `#F6F8FC` | `bg-surface-column` |
| `--surface-column-header` | `#FFFFFF` | `bg-surface-column-header` |
| `--surface-toolbar` | `#FFFFFF` | `bg-surface-toolbar` |
| `--surface-subtle` | `#F8FAFC` | `bg-surface-subtle` |
| `--line-column` | `#DCE3EF` | `border-line-column` |
| `--line-card` | `#E2E8F0` | `border-line-card` |
| `--line-control` | `#CBD5E1` | `border-line-control` |
| `--line-divider` | `#E8EEF6` | `border-line-divider`, `bg-line-divider` |
| `--foreground` (update) | `#0F172A` | `text-foreground` |
| `--foreground-secondary` | `#334155` | `text-foreground-secondary` |
| `--muted-foreground` (update) | `#64748B` | `text-muted-foreground` |
| `--nav-foreground` | `#E2E8F0` | `text-nav-foreground` |
| `--nav-foreground-strong` | `#F8FAFC` | `text-nav-foreground-strong` |
| `--nav-switcher-surface` / `-line` / `-fg` | `rgba(14,165,233,.16)` / `rgba(56,189,248,.35)` / `#E0F2FE` | `bg-nav-switcher-surface`, `border-nav-switcher-line`, `text-nav-switcher-fg` |
| `--nav-tab-active-line` | `rgba(125,211,252,.45)` | `border-nav-tab-active-line` |
| `--nav-chrome-line` | `rgba(148,163,184,.2)` | `border-nav-chrome-line` |
| `--activity-none` / `-today` / `-future` / `-overdue` | `#CBD5E1` / `#F97316` / `#16A34A` / `#EF4444` | `bg-activity-none` and the matching `bg-`, `border-` and `text-` forms of each |
| `--activity-{none,future,today,overdue}-surface` | spec `--pill-*-bg` | `bg-activity-today-surface`, … |
| `--activity-{…}-line` | spec `--pill-*-border` | `border-activity-today-line`, … |
| `--activity-{…}-text` | spec `--pill-*-text` | `text-activity-today-text`, … |
| `--star-filled` / `--star-empty` | `#F59E0B` / `#CBD5E1` | `text-star-filled`, `fill-star-filled`, `text-star-empty` |
| `--kpi-{total,new,rated,qualified,overdue}-surface` | spec §3B bg | `bg-kpi-new-surface`, … |
| `--kpi-{…}-line` | spec §3B border | `border-kpi-new-line`, … |
| `--kpi-{…}-text` | spec §3B text | `text-kpi-new-text`, … |
| `--kpi-{…}-count` | spec §3B count bg | `bg-kpi-new-count` (count text is `text-white` in both themes) |
| `--entity-person-surface` / `-fg` | `#EFF6FF` / `#2563EB` | `bg-entity-person-surface`, `text-entity-person-fg` |
| `--entity-company-surface` / `-fg` | `#F0F9FF` / `#0284C7` | `bg-entity-company-surface`, `text-entity-company-fg` |
| `--count-active-surface` / `-fg` | `#EFF6FF` / `#1D4ED8` | `bg-count-active-surface`, `text-count-active-fg` |
| `--count-zero-surface` / `-fg` | `#F1F5F9` / `#64748B` | `bg-count-zero-surface`, `text-count-zero-fg` |
| `--count-danger-surface` / `-fg` | `#FEF2F2` / `#DC2626` | `bg-count-danger-surface`, `text-count-danger-fg` |
| `--chip-active-line` / `-fg` | `#93C5FD` / `#1D4ED8` | `border-chip-active-line`, `text-chip-active-fg` |

### Gradients (`:root` / `.dark` vars plus `@utility`)

| Utility | Light value |
| --- | --- |
| `bg-gradient-header` | `linear-gradient(90deg, #091526 0%, #0F2342 52%, #132C52 100%)` |
| `bg-gradient-brand-strip` | `linear-gradient(90deg, #2563EB 0%, #0EA5E9 35%, #10B981 70%, #F59E0B 100%)` |
| `bg-gradient-primary` | `linear-gradient(135deg, var(--color-brand-600) 0%, var(--color-accent-700) 100%)` |
| `bg-gradient-avatar` | `linear-gradient(135deg, var(--color-accent-700) 0%, var(--color-aqua-700) 100%)` |
| `bg-gradient-logo` | `linear-gradient(135deg, var(--color-brand-600) 0%, var(--color-accent-700) 55%, var(--color-aqua-700) 100%)` |
| `bg-gradient-canvas` | `linear-gradient(180deg, #EDF2F8, #E4EBF5)` |
| `bg-gradient-chip-active` | `linear-gradient(135deg, var(--color-brand-50), var(--color-brand-100))` |

Review correction **2026-10-26 (T26)**: primary, avatar and logo use the table's
stops in both themes. This deliberately deviates from the owner's 600-step sky
and teal stops (and the previous dark logo's brand-500): they do not clear the
4.5:1 floor for small white text. Brand-600, accent-700 and aqua-700 retain the
blue/teal identity with darker fills. `scripts/design/contrast.mjs` now claims
white against every stop of all three gradients in light and dark, and checks
nav chrome against the actual navy header stops rather than `--color-chrome`.

T26 also moves all next/font variable classes to `<html>` in the root layout
and global error boundary; the font aliases now resolve where they are declared.
The redundant root font aliases are removed. The brand cluster can shrink and
its name truncates; the AppSwitcher label appears from `md`. Filter chips cap at
`max-w-64`, truncate only the label and retain the remove control. Language and
theme toggles default to semantic surface colours; GlobalNav alone opts into
`tone="chrome"`. The UserMenu name shows from `lg` only (`hidden lg:inline`), so
the header fits at tablet widths, and the trigger keeps its accessible name. The
branding comment now records that the header is a fixed navy, not tenant-hued
(T28).

### Shadows, radii, sizes, type

| Token | Value | Utility |
| --- | --- | --- |
| `--shadow-toolbar` | spec | `shadow-toolbar` |
| `--shadow-column` | spec | `shadow-column` |
| `--shadow-card` | spec | `shadow-card` |
| `--shadow-nav-active` | `0 4px 14px rgba(2,132,199,.42)` | `shadow-nav-active` |
| `--radius-card` | 13px | `rounded-card` |
| `--radius-column` | 16px | `rounded-column` |
| `--size-topbar` (update) | 58px | `h-(--size-topbar)` |
| `--size-toolbar` | 48px | `h-(--size-toolbar)` |
| `--size-toolbar-control` | 33px | `h-(--size-toolbar-control)` |
| `--text-micro` | 10px | `text-micro` |
| `--text-badge` | 11px | `text-badge` |
| `--text-caption` | 12px | `text-caption` |
| `--text-label` | 12.5px | `text-label` |
| `--text-tab` | 13.5px | `text-tab` |
| `--text-card-title` | 14px | `text-card-title` |
| `--text-column-title` | 14.5px | `text-column-title` |
| `--font-sans` (update) | Plus Jakarta Sans, Cairo, system-ui | `font-sans` |
| `--font-arabic` | Cairo | `font-arabic` |

The `text-tab` name avoids a utility collision with `--color-nav`.

### Shared logic contract (task T5)

```ts
// src/app/(tenant)/crm/shared/crm-activity-tone.ts (existing export, new rules)
export type CrmActivityState = "NONE" | "TODAY" | "FUTURE" | "OVERDUE";
export function crmActivityState(next: { activityAt: string; bucket?: string } | null, now?: Date): CrmActivityState;

// src/app/(tenant)/crm/shared/crm-activity-segments.ts (new)
export interface CrmActivitySegment { state: CrmActivityState; count: number; percent: number }
/** Empty input → [{ state: "NONE", count: 0, percent: 100 }]. Zero-count states omitted. Order: FUTURE, TODAY, OVERDUE, NONE. */
export function crmActivitySegments(states: readonly CrmActivityState[]): CrmActivitySegment[];
```

### i18n contract (task T4; values en / ar)

| Key | en | ar |
| --- | --- | --- |
| nav `presetDashboards` (value only, key kept) | `Dashboard` | `لوحة التحكم` |
| `crmLeads.card.activityStates.NONE` | `No activities` | `لا توجد أنشطة` |
| `crmLeads.emptyStage.title` | `No leads in this stage` | `لا توجد عملاء محتملون في هذه المرحلة` |
| `crmLeads.emptyStage.hint.default` | `Drag a lead here or add a new one.` | `اسحب عميلاً محتملاً إلى هنا أو أضف عميلاً جديداً.` |
| `crmLeads.emptyStage.hint.NURTURING` | `Move leads here for long-term nurturing or add a new lead.` | `انقل العملاء المحتملين إلى هنا لرعايتهم على المدى الطويل أو أضف عميلاً جديداً.` |
| `crmLeads.emptyStage.hint.DISQUALIFIED` | `Unqualified or closed leads will appear neatly archived here.` | `ستظهر هنا العملاء المحتملون غير المؤهلين أو المغلقون مؤرشفين بشكل منظم.` |
| `crmLeads.emptyStage.quickAdd` | `Quick Add Lead` | `إضافة سريعة لعميل محتمل` |

## Part 3. Owner's specification (verbatim)

The owner's Markdown spec, "Mutakamel CRM — Design System & Leads Kanban Handoff
Specification", is kept in [`crm-leads-v3-owner-spec.md`](crm-leads-v3-owner-spec.md).
