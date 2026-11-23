# Components

Approved design of each component. Sizes are in Measurements.

## Navigation bar

- Two levels. Level 1: gradient bar with logo, app switcher, section items, then search, scope switcher, notification bell and avatar at the end. Level 2: `surface` bar with the pages of the active section.
- Active level-1 item is a glass pill. Active level-2 item is a filled blue button: `bg-brand text-on-brand`, radius 8, 24 high inside the 32 bar, its icon in `on-brand` (owner 2026-11-21); other level-2 items are muted text with a `row-hover` fill on hover.
- Choosing an app in the app switcher changes ONLY the level-1 items (the nav shows that app's sections). The page, its URL and level 2 stay as they are; the user moves by picking a section. Navigating anywhere resets the switcher to the app of the current page. An item is shown active only while the nav shows the current page's app.
- Every level-1 section item, in all apps, has a solid colored icon tile 24 (`icon-*` palette) before its name. Items that do not fit collapse into the "More" menu, which keeps the same tiles.
- In apps whose level-1 items are groups (Workspace, Trade), a group is a plain level-1 link (tile + label, no dropdown) that opens the group's first page; the group's pages are in the level-2 bar (owner 2026-11-21).
- Level-2 page icons use the `icon-*` palette with no two neighbours in the same color, and a page uses the color of its matching level-1 section when one exists (Lead stages = green like Leads, Opportunity stages = red like Opportunities).
- Level 2 is hidden (not rendered, no empty 32 bar) when the active section has no pages; the content moves up.
- Every level-2 item has its page icon before the name: a linear 16 glyph in the page's own `icon-*` color, with no tile, gap 6. The colors stay the same in light and dark; on the active item (filled blue) the icon turns `on-brand`.
- The bell shows a `danger` counter (hidden at zero, "99+" above 99). While its panel is open the bell takes the glass pill.

## Buttons

- Primary, secondary, ghost, danger, icon-only. States: hover, pressed, focus ring, disabled (`neutral-soft` fill, `text-placeholder` text), loading (12px spinner + label).
- At most one primary per view. Order in footers: primary first, then cancel; delete alone at the far end.

## Fields

- White `surface-field` in every mode. A view-mode field looks exactly like an editable one; do not gray it.
- Label above with required asterisk (`danger-text`) and the hint icon. Tooltip on the label line.
- States: default, hover, focus, required, error, warning, valid (green border + check), disabled (`neutral-soft`).
- Dropdown: same shape as a field; menu with optional search, selected row highlighted with a check.
- Composite fields (phone, name) collapse to one field in view and split on entry. See Critical rules 6 and 7.

## Stat cards

- Soft shadow, padding 8, and a small chart in every card.
- Seven chart shapes, chosen per metric: line with arrow end, smooth line with arrow end, shaded area, bars, half-circle gauge, progress bar, segmented bar.
- Use the line shapes for values over time; gauge, progress and segmented bar for a share of a target.

## Status badges

- Filled, bright, dark text. Height 20, radius 8.
- Stage or category chips are quiet: `brand-soft` or `neutral-soft`.

## Tables

- Rows are separate cards with soft shadow, 6px apart.
- Money cells are left-to-right: `EGP 12,500`, `EGP 12,500.50` (2 decimals, a plain integer when whole).
- Header is a gradient bar. Column lines in both header and rows.
- Row actions open the Actions menu from a "..." button.

## Actions menu

- Each row: solid colored icon tile 24 + title. No description line (owner 2026-11-21).
- Record menus have "Open" and "Edit"; both open the same editable record (rule 5 still holds). Delete is last, in `danger-text`, after a divider.

## Modals

- View and create share one layout (rule 5). Confirmation (360) and destructive confirmation with a `danger` button; a destructive modal does not close on outside click.
- Alert modals exist for success, warning and info only. Errors are toasts. A 409 conflict is a warning confirmation with two choices.
- Header: solid icon tile + title + optional stage chip + close. Footer: Save, Undo, unsaved label, then Delete at the far end.

## Toasts

- White card, colored round icon, title, one line of text, close, countdown bar in the status color.
- Four types: success, error, warning, info. Position, durations, the limit of 3 and merging of repeats are in Critical rules 10.

## Tabs

- Underline style with an icon and an optional counter per tab.

## Other controls

- Checkbox, radio, switch, multi-select chips, breadcrumbs, pagination, stepper, accordion (28px header), file upload (dashed drop zone + file rows with a 4px progress bar), tags, avatars (stacked group with "+N"), spinner (16), skeleton lines (10 high).

## Notifications

- Panel opens from the bell: title, "mark all as read", tabs All / Unread with counters, list grouped by day (Today, Yesterday), footer link to the full page.
- Item: solid colored icon tile by type, title, description, time. Unread items have a `brand-soft` tint and an 8px dot. Clicking marks as read and opens the record in a modal.
- Actionable notifications carry their 24px buttons inside the item.

## Date pickers

Three versions sharing one look: date, date + time, date range.

- Range layout: preset sidebar running the full height, two months (or one), and under each month its time (hour and minute dropdowns, 24-hour). Last row: day count on one side, Cancel and Apply on the other. No header, no date text boxes.
- Selected start and end are filled `brand` circles; the range between is a continuous `brand-soft` band; today has a `brand` outline.
- Presets: Maximum (from 01/01/2020 to today), Today, Yesterday, Today and yesterday, This month (to today), Last month, This year (to today), Last year, First quarter, Second quarter, Third quarter, Fourth quarter (of the current year, full quarter).
- Default times: start 00:00, end 23:59. The system treats start as second 00 and end as second 59. Choosing a preset resets the times.
- Week starts on Sunday. Use the two-month version by default and the one-month version in filters and modals.

## Colour picker

**"Every colour input in the product uses `ui-color-picker`. Never a raw hex text box, never `<input type=color>`."**

Fixed-palette pickers (such as the card colour labels in `shared/ui/actions-menu` swatches and `rating-colour-field`) stay as they are: they choose a theme label, not a free colour.

- **Trigger:** Same look and states as `ui-field` (`field-h` 24 high, `radius-8`, `surface-field` in every mode including view/read-only, `neutral-soft` when disabled, `danger-border` + `danger-halo` on error). Holds a 16 (`checkbox-size`, `radius-4`) colour swatch at the start (with a checkerboard behind it when opacity is below 100%, or a diagonal slash when empty), the LTR tabular-numeral hex value, and a 14 (`icon-sm`) chevron at the end. Every field keeps its label-line `"!"` hint (`tabindex="-1"`).
- **Popover (B1):** Floating `surface` card (`z-dropdown`, `radius-12`, `border`, `p-8`, `shadow-popover`), 248 wide (`calc(var(--toast-w) - var(--space-12))`), anchored 4 (`space-4`) from the trigger. Flips above at the viewport edge and aligns to the inline start in both LTR and RTL.
  - **Saturation/value square** (~200×140: `flex-1` by `calc(var(--time-list-max-h) + var(--space-4))`, `radius-8`) with a 12 (`switch-knob`) round `on-brand` knob.
  - **Vertical hue bar** (`icon-sm` 14 wide, 140 high, `radius-6`) with a 6 (`org-band-h`) bar knob. Sits on the **right** in LTR and on the **left** in RTL.
  - **Opacity slider** (`icon-sm` 14 high, `radius-full`) with a checkerboard track and a 12 (`switch-knob`) round knob. Hidden when `allowAlpha=false`.
  - **Format row:** `ui-segmented` (`HEX · RGB · HSL`), compact `field-h-compact` (22) LTR tabular-numeral channel input(s), and a 44 (`time-dd-w`) opacity `%` input (hidden when `allowAlpha=false`).
  - **Palette row:** 20 (`badge-h`, `radius-6`) swatch buttons from `swatches`, defaulting to the active theme's brand and neutral tokens resolved to uppercase hex. When `nullable=true`, starts with a "No colour" slash swatch that sets `null`.
  - **Footer:** None.
- **Behaviour:** Changes apply live as the user drags or types. `Escape` reverts to the value from when the popover opened and returns focus to the trigger; clicking outside closes the popover and commits. Invalid typed text shows the field error and keeps the last valid value.
- **Keyboard & accessibility:** Clicking the trigger or pressing `Enter` / `Space` / `ArrowDown` opens the popover. Arrow keys move the SV knob (`Shift` = ×10), `ArrowUp` / `ArrowDown` move the hue bar (`Shift` = ×10), and `ArrowLeft` / `ArrowRight` move the opacity slider (`Shift` = ×10). Tab order: `square → hue → opacity → format → inputs → swatches`. All sliders expose `role="slider"` with `aria-valuetext`, paired with a polite `aria-live` announcement.
- **Value format & `allowAlpha`:** Integrates with Angular Signal Forms `[formField]` (`FormValueControl`). Emits uppercase `#RRGGBB` when opaque, `#RRGGBBAA` when opacity < 100% and `allowAlpha` is `true`, or `null` when cleared via `nullable`. Accepts `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()/rgba()`, and `hsl()/hsla()` on paste and normalises them to uppercase hex. Use `allowAlpha=false` whenever the backend schema or CSS target stores opaque 6-digit `#RRGGBB` only (for example CRM tag colours).
