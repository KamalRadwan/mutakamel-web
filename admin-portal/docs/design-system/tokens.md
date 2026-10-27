# Tokens

Status: **[Verified current source — Ocean Navy v3 aligned]**

Last source verification: **2026-10-26**

Owner: **Admin Portal**

Source: `src/app/globals.css`, `src/design-system/theme-contrast.test.ts`.

## Role architecture (`2026-10-26`)

Admin Portal shares the Ocean Navy v3 palette and semantic token contract with
Tenant Portal while preserving Admin's ramp naming:

| Role | Meaning | Ramp name |
| --- | --- | --- |
| Action | Primary actions, active controls, focus rings, informational (`info`), and v3 blue accents | `action` (cobalt, hue ~254→267, anchored at `600 = #1d4ed8`) |
| Success | Healthy, completed, connected, verified states (`brand` remains a green alias of `success`) | `success` (emerald/green, hue 149→163) |
| Danger | Destructive actions, errors, failed states | `danger` (warm vermilion, hue 26→30 — deliberately *not* rose/hue ~15) |
| Warn | Caution, degraded, needs-attention — border/tint/dot/text only, **never a filled button** | `warn` (amber, hue 92→44; deliberate hue torsion keeps low steps from reading olive) |
| Ink / Surface | Text, borders, surfaces, neutral states | `ink` (`25`→`1000`, 13 steps, hue 232→245 cold machined steel) with `surface-25…300` |

**Admin-specific invariant:** `brand` is **not** repointed to blue in Admin
Portal. `--color-brand-*` aliases `--color-success-*` so legacy green status
sites remain green, while every v3 blue token (`--primary`, `kpi-new-*`,
`entity-person-*`, `count-active-*`, `chip-active-*`, `bg-gradient-primary`,
`bg-gradient-logo`, `bg-gradient-chip-active`) binds to `--color-action-*`.
There is no tenant white-label layer in Admin Portal.

### Ocean Navy v3 ramps (`accent`, `aqua`, `ember`, `navy`)

Added **2026-10-26** in the `@theme` block of `src/app/globals.css`, matching
Tenant Portal's sRGB-in-gamut OKLCH values verbatim:

| Ramp | Steps | Anchor | Purpose |
| --- | --- | --- | --- |
| `--color-accent-50…950` | 11 | `600 = #0284c7` (Tailwind sky) | Fixed sky chrome highlights, company entity badges (`entity-company-*`), and secondary stops of `bg-gradient-primary`, `bg-gradient-avatar`, and `bg-gradient-logo` (no purple/violet/indigo in chrome) |
| `--color-aqua-50…950` | 11 | `600 = #0d9488` (Tailwind teal) | User/operator avatar (`bg-gradient-avatar`) and brand mark (`bg-gradient-logo`) gradient stops |
| `--color-ember-50…950` | 11 | `500 = #f97316` (Tailwind orange) | "Due today" activity health (`--activity-today`), distinct from amber rating stars |
| `--color-navy-800/900/950` | 3 | `#132c52` / `#0f2342` / `#091526` | Fixed Ocean Navy `Topbar` gradient stops (`bg-gradient-header`), invariant across light and dark modes |
| `--color-chrome` | 1 | `#000068` | Fixed inverted nav fallback (`--nav`) |

### "In progress" is cobalt + motion

The `progress` tone resolves to the `info` role — cobalt (`action`) — and keeps
its pulsing dot and `border-dashed` treatment. `StatusBadge` always renders a
text label, the dashed border is a structural difference no other tone uses, and
colour is additive reinforcement rather than the sole signal. Under reduced
motion, the pulse stops while the label, cobalt tint, and dashed border remain
distinct.

## Legacy palette compatibility (the theme flip)

`src/app/globals.css` remaps Tailwind's stock color family variables directly
onto the semantic ramps so third-party or transitional markup cannot introduce
warm grey or unvetted purple/rose defaults:

```text
brand  (success/healthy) <- emerald, green
danger                   <- red, rose
warn                     <- amber, orange, yellow
ink    (everything else) <- slate, gray, zinc, neutral, stone, lime, teal,
                             cyan, sky, blue, indigo, violet, purple,
                             fuchsia, pink
```

Production code consumes semantic roles (`bg-card`, `bg-surface-column`,
`text-foreground-secondary`, `border-line-column`, `bg-gradient-primary`) rather
than direct family or ramp steps.

## Semantic roles (`:root` and `.dark`)

Declared on `:root`, overridden in `.dark`, and bridged through `@theme inline`
so theme changes repaint utilities without `dark:` overrides in component JSX.

**Trap:** shadcn's `--accent` means "neutral hover fill" (`surface-100` /
`ink-800`), whereas `--color-accent-50…950` is the Ocean Navy sky ramp. Do not
wire generic hover fills to sky/blue expecting shadcn neutral hover behavior.

| Token / Group | Light (`:root`) | Dark (`.dark`) |
| --- | --- | --- |
| `--background` / `--canvas` | `surface-50` | `ink-1000` |
| `--foreground` | `#0f172a` | `ink-100` |
| `--foreground-secondary` | `#334155` | `#cbd5e1` |
| `--muted` / `--muted-foreground` | `surface-100` / `#64748b` | `ink-900` / `ink-400` |
| `--card` / `--popover` | `white` / `white` | `ink-950` / `ink-900` |
| `--surface-column` | `#f6f8fc` | `#070f1a` |
| `--surface-column-header` / `--surface-toolbar` | `#ffffff` | `ink-950` |
| `--surface-subtle` | `#f8fafc` | `#111c2b` |
| `--line-column` / `--line-card` | `#dce3ef` / `#e2e8f0` | `#1e2d42` / `#243449` |
| `--line-control` / `--line-divider` | `#cbd5e1` / `#e8eef6` | `#62758f` / `#1b293b` |
| `--primary` / `--primary-foreground` | `action-600` / `white` | `action-400` / `ink-1000` |
| `--secondary` / `--accent` | `surface-100` | `ink-800` |
| `--selected` / `--selected-foreground` | `surface-selected` / `action-800` | `action-950` / `action-200` |
| `--info` / `-subtle` / `-vivid` | `action-700` / `action-100` / `action-500` | `action-400` / `action-950` / `action-400` |
| `--success` / `-subtle` / `-vivid` | `success-800` / `success-100` / `success-600` | `success-300` / `success-950` / `success-400` |
| `--warning` / `-subtle` / `-vivid` | `warn-800` / `warn-100` / `warn-600` | `warn-300` / `warn-950` / `warn-400` |
| `--destructive` / `-subtle` / `-vivid` | `danger-700` / `danger-100` / `danger-500` | `danger-400` / `danger-950` / `danger-400` |
| `--border` / `--input` / `--ring` | `surface-200` / `control-border` / `action-500` | `oklch(0.49 0.024 237)` / `oklch(0.49 0.024 237)` / `action-400` |
| `--row-zebra` | `surface-25` | `ink-950` |
| `--sidebar` / `--sidebar-active` / `--sidebar-border` | `surface-25` / `action-800` / `surface-200` | `ink-950` / `action-200` / `ink-800` |

### Ocean Navy v3 domain & chrome roles (`2026-10-26`)

| Group | Tokens | Notes |
| --- | --- | --- |
| Ocean Navy `Topbar` chrome | `--nav`, `--nav-foreground` (`#e2e8f0`), `--nav-foreground-strong` (`#f8fafc`), `--nav-muted-foreground` (`ink-300`), `--nav-active` (`#38bdf8`), `--nav-switcher-{surface,line,fg}`, `--nav-tab-active-line`, `--nav-chrome-line`, `.nav-surface` | Invariant dark Ocean Navy header in both themes; `.nav-surface` repoints generic control roles (`--foreground`, `--muted-foreground`, `--accent`, `--card`, `--border`, `--input`, `--ring`) on the bar while Radix portals under `<body>` keep `--popover` |
| Activity health & pills | `--activity-{none,today,future,overdue}` and `--activity-{none,future,today,overdue}-{surface,line,text}` | Opaque pastel fills + deep labels in `:root`; `rgb(... / 0.14–0.15)` tints + pastel labels in `.dark` |
| Rating stars | `--star-filled` (`#f59e0b` / `#fbbf24`), `--star-empty` (`#cbd5e1` / `#475569`) | Explicit amber hex so theme-flip `amber -> warn` does not shift star hue |
| KPI badges | `--kpi-{total,new,rated,qualified,overdue}-{surface,line,text,count}` | `kpi-new-*` maps to `action-{50,200,800,600}` (light) and `action-{950,800,200,600}` (dark); inner count chip uses white text in both themes |
| Entity, count & filter chips | `--entity-{person,company}-{surface,fg}`, `--count-{active,zero,danger}-{surface,fg}`, `--chip-active-{line,fg}` | `entity-person-*`, `count-active-*`, and `chip-active-*` map to `action-*`; `entity-company-*` maps to `accent-*` |

## Named gradients (`@utility bg-gradient-*`)

Raw `bg-linear-*`, `bg-radial-*`, and `bg-conic-*` remain banned in feature
components. Seven named utilities expose the v3 gradients, with `primary`,
`logo`, and `chip-active` mapped to `action`:

| Utility | Light (`:root`) | Dark (`.dark`) |
| --- | --- | --- |
| `bg-gradient-header` | `90deg: navy-950 → navy-900 (52%) → navy-800` | Same (invariant Ocean Navy chrome) |
| `bg-gradient-brand-strip` | `90deg: #2563eb → #0ea5e9 (35%) → #10b981 (70%) → #f59e0b` | Same |
| `bg-gradient-primary` | `135deg: action-600 → accent-700` | `135deg: action-600 → accent-700` |
| `bg-gradient-avatar` | `135deg: accent-700 → aqua-700` | `135deg: accent-700 → aqua-700` |
| `bg-gradient-logo` | `135deg: action-600 → accent-600 (55%) → aqua-600` | `135deg: action-500 → accent-600 (55%) → aqua-600` |
| `bg-gradient-canvas` | `180deg: #edf2f8 → #e4ebf5` | `180deg: #040911 → #060d17` |
| `bg-gradient-chip-active` | `135deg: action-50 → action-100` | `135deg: action-950 → action-900` |

Verified **2026-10-26**: the primary endpoint and both avatar stops use the
700 steps in light mode to support white text at 4.5:1 or better, matching the
dark-mode stops.

## Contrast verification (`theme-contrast.test.ts`)

`src/design-system/theme-contrast.test.ts` parses `src/app/globals.css` directly
and asserts WCAG 2.2 AA contrast across both `:root` and `.dark` (resolving
OKLCH, hex, alpha-composited `rgb(... / a)` surfaces, and multi-stop gradients):

- **Text pairs (`≥ 4.5:1`)**: dual-use dark `--primary` (`7.24:1` on `card`,
  `7.68:1` fill) and `--destructive` (`7.04:1` on `card`, `7.47:1` fill);
  `--foreground`, `--foreground-secondary`, and `--muted-foreground` against
  `--card`, `--surface-column`, and `--surface-subtle`; `--nav-foreground`,
  `--nav-foreground-strong`, and `--nav-switcher-fg` against Ocean Navy header
  stops; all four `activity-*-text` pairs; all five `kpi-*-text` pairs plus
  white text on all five `kpi-*-count` fills; all three `count-*-fg` pairs; and
  `--chip-active-fg` across `--gradient-chip-active`; white text on every stop
  of `--gradient-primary` and `--gradient-avatar` in both themes.
- **Five spec colours darkened one step for AA compliance**: matching Tenant
  Portal's v3 audit, light-mode `--activity-none-text` and `--count-zero-fg` use
  `#475569` (`6.92:1` on `#f1f5f9`), `--count-danger-fg` (and
  `--activity-overdue-text`) uses `#b91c1c` (`5.92:1` on `#fef2f2`), and KPI
  count fills use `#b45309` (`5.02:1`), `#15803d` (`5.01:1`), and `#dc2626`
  (`4.83:1`) under white text.
- **Non-text pairs (`≥ 3:1`)**: dark `--border` / `--input` (`3.04:1`) and
  `--ring` (`7.24:1`) on `--card`, light `--input` (`3.15:1`) on `--card`,
  `--ring` on `--background`, `--nav-active` on `--gradient-header`,
  `entity-{person,company}-fg` on their badge surfaces, and dark
  `--line-control` (`#62758f`) on `--surface-subtle` and `--card`.

## Elevation, radii, and control-height tokens

- **Shadows (`@theme inline`)**: `--shadow-pop`, `--shadow-overlay`,
  `--shadow-toolbar`, `--shadow-column`, `--shadow-card` (soft `rgb(15 23 32)` /
  `rgb(15 23 42)` drop shadows in `:root`; `inset 0 1px 0 0 rgb(255 255 255 / 0.04–0.08)`
  top hairlines in `.dark`), and `--shadow-nav-active`
  (`0 4px 14px rgb(2 132 199 / 0.42)` in `:root`, `0.36` in `.dark`).
- **Radii (`@theme`)**: generic steps `--radius-xs..xl` (`3/4/6/8/10px`) plus
  named v3 surfaces `--radius-card` (`13px` → `rounded-card`) and
  `--radius-column` (`16px` → `rounded-column`).
- **Control & chrome sizes (`:root`)**: `--size-control-xs..xl`
  (`24/32/36/40/44px`), `--size-brand-strip` (`3px`), `--size-toolbar` (`48px`),
  and `--size-toolbar-control` (`33px`).

## Chart colors

`--chart-action`, `--chart-success`, `--chart-warning`, `--chart-danger`, and
`--chart-qualitative-1..6` hold marks inside `L 0.625–0.681` in light mode and
calibrated `400`/brightened steps in dark mode (`≥ 3:1` non-text against
`--card`), while `--chart-axis` holds `≥ 4.5:1` text contrast — enforced by
`src/app/(shell)/dashboard/components/charts/ChartPalette.test.ts`.
