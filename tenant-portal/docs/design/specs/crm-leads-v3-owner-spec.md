# CRM Leads v3: owner specification (verbatim)

Received 2026-10-26. Lead decisions in [`crm-leads-v3.md`](crm-leads-v3.md) Part 1 override this
page where they differ, specifically: tokens instead of raw values, dark counterparts, white-label
mapping, the "[ - ]" interpretation, and the purple exemption for user-selected data colours.

---

You are refactoring the UI and Design System of **Mutakamel CRM** (specifically the Global Top Navigation, Secondary Filter/KPI Bar, and the `/crm/leads` Kanban Pipeline view).

Follow every rule in this specification strictly: add the new Design System tokens, apply the exact component dimensions/colors, fix the layout/truncation/contrast bugs, and **delete** all deprecated UI elements listed below.

## 1. Mandatory Removals & Text Changes (MUST DO FIRST)

1. **Top Navigation — Rename First Tab**:
   - Change `Preset Dashboards` → **`Dashboard`**.
   - Fix its text contrast on the dark header (must use `#E2E8F0` instead of dark/muted slate).
2. **Secondary Toolbar — Convert KPI Filters to Small Compact Badges**:
   - Make the KPI items (`Total`, `New`, `Rated 3 Stars`, `Qualified`, `Overdue Activity`) compact **small badges** (`height: 24px`, `font-size: 11px`, `border-radius: 6px`), NOT large buttons.
3. **Lead Cards — Remove Stage Duration (`Time in Stage`)**:
   - Completely **delete** the `10d in stage` / time-in-stage element from the Kanban lead cards.
4. **Lead Cards — Remove Broken Empty Placeholder `[ - ]`**:
   - Completely **delete** the empty square `[ - ]` badge next to the `...` (more actions) button on lead cards.
5. **Lead Cards — Rename Empty Activity State & Fix Truncation**:
   - Change `No open activity` → **`No activities`**.
   - Fix card width and footer flex spacing so `No activities` NEVER truncates to `No open ac...` (`white-space: nowrap`).
6. **Kanban Columns — No Colored Column Backgrounds**:
   - Do **NOT** tint Kanban columns or collapsed rails with pastel rainbow colors. All columns and collapsed rails must use a clean, unified neutral surface (`#F6F8FC`) with white headers (`#FFFFFF`) and subtle neutral borders (`#DCE3EF`).
7. **Global Palette — Strictly NO Purple / Violet Anywhere**:
   - Remove all purple/violet/magenta hues (`#7C3AED`, `#8B5CF6`, `#6366F1`, `#4F46E5`, `#EC4899`) from:
     - Top-right user profile avatar (`KR` / `Kamal Radwan`)
     - Card owner avatars (`KR`)
     - Header gradients, active tabs, buttons, stage badges, and card borders/icons.
   - Replace with the **Ocean Navy + Royal/Sky Blue + Teal** brand system defined below.

## 2. Design System Tokens (Three-Layer Architecture)

```css
:root {
  /* === Typography === */
  --font-sans: 'Plus Jakarta Sans', 'Inter', 'Cairo', system-ui, -apple-system, sans-serif;
  --font-arabic: 'Cairo', 'IBM Plex Sans Arabic', sans-serif;

  /* === Layer 1 & 2: Neutral 3-Tier Surface Hierarchy === */
  --bg-canvas-top: #EDF2F8;
  --bg-canvas-bottom: #E4EBF5;
  --bg-toolbar: #FFFFFF;
  --bg-column: #F6F8FC;          /* Clean neutral column body */
  --bg-column-header: #FFFFFF;   /* Crisp white column header */
  --bg-card: #FFFFFF;            /* Elevated pure white card */
  --bg-subtle: #F8FAFC;
  --bg-muted: #F1F5F9;

  /* === Borders & Shadows === */
  --border-column: #DCE3EF;
  --border-card: #E2E8F0;
  --border-control: #CBD5E1;
  --border-divider: #E8EEF6;
  --shadow-toolbar: 0 4px 16px -3px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03);
  --shadow-column: 0 4px 16px -4px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03);
  --shadow-card: 0 4px 14px -3px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04);

  /* === Text Colors (WCAG AA+ Contrast) === */
  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-muted: #64748B;
  --text-on-dark: #F8FAFC;
  --text-nav-inactive: #E2E8F0;

  /* === Brand & Avatar Accents (Zero Purple) === */
  --header-bg-gradient: linear-gradient(90deg, #091526 0%, #0F2342 52%, #132C52 100%);
  --brand-top-strip: linear-gradient(90deg, #2563EB 0%, #0EA5E9 35%, #10B981 70%, #F59E0B 100%);
  --brand-primary: #2563EB;
  --brand-sky: #0284C7;
  --brand-teal: #0D9488;
  --btn-primary-gradient: linear-gradient(135deg, #2563EB 0%, #0284C7 100%);
  --avatar-user-gradient: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);

  /* === Activity Status Colors === */
  --activity-none: #CBD5E1;      /* Gray: None / No active tasks */
  --activity-today: #F97316;     /* Orange: Due Today (before current cutoff / today) */
  --activity-future: #16A34A;    /* Green: Planned / Future tasks */
  --activity-overdue: #EF4444;   /* Red: Overdue tasks */

  /* === Activity Pill Surfaces === */
  --pill-none-bg: #F1F5F9;       --pill-none-border: #CBD5E1;    --pill-none-text: #64748B;
  --pill-future-bg: #F0FDF4;     --pill-future-border: #86EFAC;  --pill-future-text: #15803D;
  --pill-today-bg: #FFF7ED;      --pill-today-border: #FDBA74;   --pill-today-text: #C2410C;
  --pill-overdue-bg: #FEF2F2;    --pill-overdue-border: #FCA5A5; --pill-overdue-text: #DC2626;

  /* === Rating Stars === */
  --star-filled: #F59E0B;
  --star-empty: #CBD5E1;
}
```

## 3. Component-by-Component Implementation Specs

### A. Top Navigation Header
- **Top Accent Strip**: `3px` height above header using `var(--brand-top-strip)`.
- **Header Container**: `height: 58px`, `padding: 0 22px`, `background: var(--header-bg-gradient)`, `border-bottom: 1px solid rgba(148, 163, 184, 0.2)`.
- **Logo & Module Switcher**:
  - Logo mark: `34×34px`, `border-radius: 10px`, `linear-gradient(135deg, #2563EB 0%, #0284C7 55%, #0D9488 100%)`.
  - `CRM` switcher pill: `height: 34px`, `padding: 0 12px`, `border-radius: 9px`, `background: rgba(14, 165, 233, 0.16)`, `border: 1px solid rgba(56, 189, 248, 0.35)`, text `#E0F2FE`.
- **Navigation Tabs**:
  - Labels: **`Dashboard`** (renamed from `Preset Dashboards`), **`Leads`**, **`Customers`**, **`Opportunities`**, **`Settings`**, **`Activities`**.
  - Inactive tab: `height: 36px`, `padding: 0 12px`, `font-size: 13.5px`, `color: #E2E8F0` (high contrast), `23×23px` soft-tinted icon container (`border-radius: 6px`).
  - Active tab (`Leads`): `background: var(--btn-primary-gradient)`, `color: #FFFFFF`, `font-weight: 600`, `border: 1px solid rgba(125, 211, 252, 0.45)`, `box-shadow: 0 4px 14px rgba(2, 132, 199, 0.42)`.
- **Right Actions**:
  - Separate the Language pill (`العربية`, `height: 36px`, `border-radius: 999px`) from the Notification bell (`36×36px` circle button with `#EF4444` unread dot).
  - User Profile pill (`Kamal Radwan`): `height: 38px`, `border-radius: 999px`, avatar `28×28px` circle using `var(--avatar-user-gradient)` (`#0284C7 → #0D9488`, NO purple).

### B. Secondary Bar (Action, Small KPI Badges, Search & View Controls)
- **Floating Container**: Outer wrapper `padding: 11px 20px 0 20px`; inner bar `height: 48px`, `padding: 0 14px`, `border-radius: 12px`, `background: #FFFFFF`, `border: 1px solid var(--border-column)`, `box-shadow: var(--shadow-toolbar)`.
- **Primary CTA (`+ Add Lead`)**: `height: 33px`, `padding: 0 14px`, `border-radius: 8px`, `font-size: 12.5px`, `font-weight: 700`, `background: var(--btn-primary-gradient)`.
- **Small Compact KPI Badges** (`gap: 6px` between badges):
  - Badge container: `height: 24px`, `padding: 0 5px 0 7.5px`, `border-radius: 6px`, `font-size: 11px`, `font-weight: 600`, icon `11.5px`.
  - Inner count chip: `min-width: 17px`, `height: 16px`, `padding: 0 4.5px`, `border-radius: 4px`, `font-size: 10px`, `font-weight: 700`, `#FFFFFF` text.
  - Semantic Variants:
    1. `Total`: bg `#F1F5F9`, border `#CBD5E1`, text `#1E293B`, count bg `#334155`
    2. `New`: bg `#EFF6FF`, border `#BFDBFE`, text `#1E40AF`, count bg `#2563EB`
    3. `Rated 3 Stars`: bg `#FFFBEB`, border `#FDE68A`, text `#92400E`, count bg `#D97706`
    4. `Qualified`: bg `#ECFDF5`, border `#A7F3D0`, text `#065F46`, count bg `#16A34A`
    5. `Overdue Activity`: bg `#FEF2F2`, border `#FECACA`, text `#991B1B`, count bg `#EF4444`
- **Search Input & Controls (`height: 33px`)**:
  - Search box: `height: 33px`, `max-width: 460px`, `flex: 1`, `background: #F8FAFC`, `border: 1px solid #CBD5E1`, `border-radius: 8px`, `padding: 0 10px`, `gap: 8px` (ensure magnifying glass icon never overlaps the active filter chip).
  - Active filter chip (`My Leads`): `height: 21px`, `padding: 0 7px`, `border-radius: 5px`, `background: linear-gradient(135deg, #EFF6FF, #DBEAFE)`, `border: 1px solid #93C5FD`, `color: #1D4ED8`, `font-size: 11px`.
  - `Advanced` button, segmented `View Switcher` (Kanban/Grid/List), and `Sort` square button all share `height: 33px` and `border-radius: 8px`.

### C. Kanban Pipeline Columns & Collapsed Rails
- **Board Layout (Fix Right-Side Overflow Bug)**:
  - `display: flex; align-items: stretch; gap: 12px; padding: 13px 20px 20px 20px;`
  - Expanded columns: `flex: 1 1 0; min-width: 235px;` (fits all 5 expanded + 2 collapsed columns cleanly on desktop without clipping `Disqualified`; allow smooth horizontal scroll only on narrow viewports `< 1360px`).
  - Surface: `background: var(--bg-column)` (`#F6F8FC`), `border: 1px solid var(--border-column)` (`#DCE3EF`), `border-radius: 16px`, `box-shadow: var(--shadow-column)`.
- **Column Header**:
  - `background: #FFFFFF`, `padding: 13px 14px 12px 14px`, `border-bottom: 1px solid #E8EEF6`.
  - Title: `14.5px`, `font-weight: 700`, `#0F172A`.
  - Count pill: `min-width: 23px; height: 20px; border-radius: 999px; font-size: 11.5px; font-weight: 700;` (`#EFF6FF`/`#1D4ED8` when `count > 0`; `#F1F5F9`/`#64748B` when `0`; `#FEF2F2`/`#DC2626` for `Disqualified`).
  - Header action buttons (`+` Quick Add & `«` Collapse): `26×26px` rounded `7px` buttons (`#F8FAFC` bg, `#E2E8F0` border, `14px` SVG icon — replacing tiny 10px unclickable icons).
- **Column Activity Status Bar (Segmented Health Bar — Fix Logic & Colors!)**:
  - Container: `height: 6px; width: 100%; border-radius: 999px; background: var(--activity-none); display: flex; gap: 2px; overflow: hidden;`
  - **Business Logic**:
    - If `leads.length === 0`: render `100%` Gray (`#CBD5E1`). *(Fixes the bug where empty `Nurturing 0` showed a green fill!)*
    - Otherwise, group leads in the column by their next open activity status and render proportional width segments (`(count / columnTotal) * 100%`) using ONLY these 4 colors:
      1. **Green (`#16A34A`)**: Future scheduled tasks (`due_at > now`)
      2. **Orange (`#F97316`)**: Today's tasks due up to / before this second (`startOfToday <= due_at <= now`)
      3. **Red (`#EF4444`)**: Overdue tasks (`due_at < startOfToday`)
      4. **Gray (`#CBD5E1`)**: None / No active tasks (`No activities`)
- **Collapsed Stage Rails (`Qualified`, `On Hold`)**:
  - `width: 52px; flex: 0 0 52px; border-radius: 16px; background: #F6F8FC; border: 1px solid #DCE3EF;`
  - Top `28×28px` expand button (`»`), circular count badge (`26×26px`), vertical title (`writing-mode: vertical-rl; transform: rotate(180deg); font-size: 13.5px; font-weight: 700; color: #334155`).
- **Empty Column Dropzone (`Nurturing`, `Disqualified`)**:
  - Neutral dashed container (`background: rgba(255,255,255,0.72); border: 1.5px dashed #CBD5E1; border-radius: 13px`), `48×48px` soft tinted icon badge, title `No leads in this stage`, concise helper text, and `+ Quick Add Lead` button (`height: 34px`, `#FFFFFF` bg, `#CBD5E1` border, `#2563EB` text).

### D. Lead Card Anatomy
- **Card Container**:
  - `background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 13px; padding: 13px 13px 11px 15px; display: flex; flex-direction: column; gap: 10px; position: relative; box-shadow: var(--shadow-card);`
  - Left `4px` vertical status bar (`::before`) colored according to the lead's activity state (`#CBD5E1` gray, `#16A34A` green, `#F97316` orange, `#EF4444` red).
- **Row 1 — Identity & Menu**:
  - Entity Icon Badge (`31×31px`, `border-radius: 8px`): Person `#EFF6FF`/`#2563EB`; Company `#F0F9FF`/`#0284C7` or `#ECFDF5`/`#0D9488`.
  - Lead/Company Name: `14px/700` `#0F172A` (for Arabic strings, apply `font-family: var(--font-arabic); font-size: 15px; font-weight: 800;` for optical balance).
  - Right: `26×26px` `...` menu button (`#F8FAFC` bg, `#E2E8F0` border). **No `[ - ]` box!**
- **Row 2 — Contact Subtitle (Optional — render only if contact exists)**:
  - Compact pill container: `background: #F8FAFC; border: 1px solid #EDF2F7; border-radius: 7px; padding: 4.5px 8.5px; font-size: 12px; color: #334155;` (`Contact Name • Role`).
- **Row 3 — Source / Category Pill (Optional)**:
  - `height: 23px; padding: 0 8.5px; border-radius: 6px; font-size: 11px; font-weight: 700;` (e.g., `Call Center` in `#ECFDF5` bg / `#A7F3D0` border / `#047857` text).
  - **Do NOT render `time in stage` (`10d in stage`) here or anywhere on the card.**
- **Row 4 — Divider & Card Footer**:
  - `1px` divider (`#E2E8F0`).
  - Left: 3 Rating Stars (`13.5px` SVGs, filled `#F59E0B`, unfilled `#CBD5E1`).
  - Center: **Activity Status Pill** (`height: 23px; padding: 0 8.5px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap;`):
    - No active tasks → text **`No activities`** (`--pill-none-*` Gray)
    - Future task → `--pill-future-*` Green
    - Today task (before this second) → `--pill-today-*` Orange
    - Overdue task → `--pill-overdue-*` Red
  - Right: Watch eye icon (`13.5px`, `#64748B`) + Owner Avatar (`25×25px` circle, `background: var(--avatar-user-gradient)`, `#FFFFFF` initials `10px/700`, `1.5px solid #FFFFFF` ring).
