A bilingual (Arabic RTL, English LTR) ERP interface for desktop (minimum width 1024). Modern, bold and dense: wide screens are for data, so every control is small and every measurement is fixed. Read **Critical rules** before building anything; they override habit.

## Content

- Write Arabic UI text in plain, direct Modern Standard Arabic (فصحى), never colloquial; English in sentence case. Buttons are a verb: "حفظ", "فاتورة جديدة", "Save", "New invoice".
- Validation messages are short (3 to 4 words): "العميل مطلوب", "يجب أن يكون أكبر من صفر".
- No emoji anywhere. Country flags are images from the `flag-icons` set, never emoji.

## Color

- Page is `bg`; every card, row, modal and menu is `surface` with a 1px `border` and `shadow-card`. Text is `text`; labels and secondary lines are `text-muted`.
- Primary actions use solid `brand` with `on-brand`. Never put a gradient on a button.
- The 120deg gradient `nav-start` to `nav-end` appears in three places: the top navigation bar, the table header bar and the calendar weekday header, plus the approved exceptions in `AGENTS.md` (Approved exceptions table: web phone header, coloured section bars). Text on it is `on-nav` / `on-nav-muted`. The active nav item is a glass pill: `nav-glass` with a 1px inset `nav-glass-ring`.
- Active tab, sparkline and progress fill use `accent`. The active sub-nav item is a filled brand button (`bg-brand text-on-brand`, see 03-components).
- Status is always a FILLED badge with dark text: `success`/`on-success`, `warning`/`on-warning`, `danger`/`on-danger`. Same values in both themes.
- Due status has one meaning everywhere: overdue = `danger`, today = `warning`, upcoming = `success`, none = `status-none`.
- Dark theme: the same tokens; cards rely on the border because shadows do not read on dark.

## Type

- Use the `ui` font stack everywhere: Latin glyphs render in Readex Pro and Arabic glyphs in Tajawal in both languages. Sizes are identical in both languages. Only weights 400 and 500, and only the sizes in `fontSize`.
- Table rows are `body` (14px). Field values and labels are `field` (12px). Badges are 12px/500 everywhere. Messages and timestamps are `caption` (11px).

## Density and layout

- Top navigation is the primary navigation: two levels, `nav-h` 40px + `subnav-h` 32px. A side menu is a fallback only: `brand` fill when expanded, icons only when collapsed.
- Buttons are `btn-h` 28px at most; `btn-h-sm` 24px inside cards and rows.
- Forms: `field-h` 24px in 3 columns, or `field-h-compact` 22px in 4 columns from `bp-wide` up. On pages, columns drop to 2 then 1 as the container shrinks; in modals the column count is fixed by the modal width (520 = 2, 580 = 3). Do not reserve space for error messages.
- Card padding is `space-8` everywhere.

## Shape and elevation

- Corners: `radius-8` controls, `radius-10` rows and cards, `radius-14` modals and panels.
- Elevation is soft: `shadow-card` on cards, `shadow-popover` on floating layers, `shadow-modal` on modals.

## Iconography

- Icon set: Tabler Icons (outline). In Angular use `@ng-icons/core` with `@ng-icons/tabler-icons`.
- Entity, activity, action and status icons sit in a SOLID tile (`icon-tile`) colored by meaning (`icon-blue`, `icon-green`, `icon-orange`, `icon-red`, `icon-teal`, `icon-violet`, `icon-navy`, `icon-gray`) with an `on-icon` glyph. See the Icons section for the mapping.
- Small icons inside other controls (chevrons, search, close, an icon next to button text) stay linear in the text color with no tile.

## Direction

- Build with CSS logical properties so one stylesheet serves RTL and LTR.
- Phone numbers and money are always LTR in both languages and never mirror. Money is ISO code then number: `EGP 12,500`.
- Toasts appear at the bottom start corner: bottom-left in English, bottom-right in Arabic, opposite the web phone dock at the end corner.
