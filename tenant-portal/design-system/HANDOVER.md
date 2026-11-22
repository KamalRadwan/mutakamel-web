# Design system handover: tenant-portal (mutakamel ERP)

You are the AI working on the mutakamel codebase. This message gives you the final, approved design system for the tenant-portal and tells you how to use it. The package `erp-design-system.zip` is attached with this message; unzip it to `Z:\mutakamel-memory\design-system\tenant-portal`.

Reply to the product owner in Arabic. Keep code, token names and documentation in English.

## 1. Authority (read first)

1. The decisions in this package are the only source of truth for UI. The product owner chose every item himself from visual examples.
2. `00-redlines-reference.md` and any earlier "red lines" come from the old system and are void. Do not cite them against anything here.
3. Do not change a color, size, radius, font or behavior on your own judgment. If you believe something is wrong or missing, list it as a question at the end of your reply and keep implementing the documented value in the meantime.
4. Values are fixed numbers, not ranges. Use tokens only. No raw hex values, no arbitrary pixel values, no Tailwind bracket values.
5. The items listed under "Intentional choices" in section 9 are decisions, not defects. Do not report them again.

## 2. What is in the package

| File | Content |
|---|---|
| `tokens.json` | All tokens (version 6): colors for light and dark, type, spacing, radius, shadow, sizes, font sizes, z-index |
| `tokens.css` | The same tokens as CSS variables, ready to import |
| `README.md` | Overview: content, color, type, density, shape, icons, direction |
| `01-critical-rules.md` | The 14 binding rules and the intentional choices |
| `02-measurements.md` | The size scale and every measurement, one value each |
| `03-components.md` | Component specifications |
| `04-views.md` | Board, Cards, Table, trees, activities views |
| `05-icons.md` | Icon set and the full meaning-to-icon-and-color mapping |
| `06-libraries.md` | Approved Angular libraries |
| `07-platform.md` | Viewports, stacking, motion, direction, accessibility, Tailwind mapping, tables, kanban, dashboards |
| `08-additional-screens.md` | Navigation switchers, search, toast stack, 409, error pages, login, line-item documents, kanban totals, dashboard widget, attachments, change log, import wizard |
| `09-record-module.md` | The record module pattern (list page, search, quick modal, full page, build checklist); CRM Leads is the reference implementation |
| `components/` | `bundle.css` and 8 live previews (Button, Field, Badge, StatCard, DataTable, Toast, NavBar, Modal) |

Read the files in that order before writing any UI code.

## 3. Foundations

**Brand color.** `#1d56c9` (dark theme `#2f6be0`). Tenant branding is a future feature; colors are fixed for now, so do not build theming hooks beyond the token layer.

**Navy gradient.** 120deg `#070f2b` to `#0f2f78` (dark `#0b1a45` to `#1846b0`). Used in three places: top navigation, table header, calendar weekday header, plus the approved exceptions in `AGENTS.md` (web phone header, coloured section bars), nowhere else. Primary buttons are solid.

**Themes.** Light ("Gray 1") is the default; Dark is "Navy 5".

| Token | Light | Dark |
|---|---|---|
| bg | `#f7f8fa` | `#070c1a` |
| surface | `#ffffff` | `#0f172d` |
| field | `#ffffff` | `#0a1122` |
| border | `#e4e7ec` | `#212b48` |
| field border | `#c8ccd4` | `#303c60` |
| text | `#12141c` | `#eef1fa` |
| muted text | `#5b6072` | `#96a3c5` |
| accent | `#0f2f78` | `#8fb0ff` |

Cards have a 1px border and a light shadow.

**Status colors.** Filled, bright, with dark text: success `#1fbf75` / `#04170d`, warning `#ff9f1a` / `#231300`, danger `#ff5a5f` / `#240304`. Due status: overdue red, today orange, upcoming green, none gray. A kanban column's status bar is split by the share of the stage's leads in each due status, with a gray segment for leads with no activity.

**Chart series colors (new).** Ten tokens, `chart-1` to `chart-10`, used in order.

- Dark theme: `#2f6bff`, `#00d4ff`, `#00e08a`, `#ffd000`, `#ff3d57`, `#a24bff`, `#ff4fc3`, `#00c9a7`, `#ff8a00`, `#7c8cff`
- Light theme (one step darker so thin lines read on white): `#2f6bff`, `#0099c2`, `#00a865`, `#b88a00`, `#ff3d57`, `#a24bff`, `#e83fb0`, `#00a388`, `#e06c00`, `#6675f0`

More than 10 series: group the rest as "Other" in `status-none`. These colors are for charts only and never carry status meaning.

**Fonts.** Arabic: Tajawal. English: Readex Pro. Weights 400 and 500 only. One stack, `"Readex Pro", Tajawal`, so Latin characters render in Readex Pro and Arabic characters in Tajawal in both languages. Load Readex Pro with the Latin subset only.

**Direction.** Arabic is RTL, English is LTR. Use logical properties everywhere. Phone numbers, money and numeric fields are always LTR.

## 4. The size scale

Every control height comes from this scale. Nothing may fall between steps.

| Size | Used for |
|---|---|
| 40 | Navigation bar, table row, tree row |
| 36 | Table header, bulk-action bar, empty-state icon tile |
| 32 | Sub navigation, all tabs |
| 28 | Button (default and maximum), nav item, menu row, icon button, card icon tile, calendar cell, nav avatar |
| 24 | Field, small button, row icon tile, avatar, filter chip, preset row, time row, pagination |
| 22 | Compact field |
| 20 | Badge, tag, count pill |
| 16 | Checkbox, radio, switch height, counters |

Badge text is 12/500 everywhere. Fields: 24 high in 3 columns (regular), or 22 high in 4 columns (compact, from 1280 wide). No space is reserved for error text. Modal widths: 280 alert, 360 confirm, 520 form with 2 columns, 580 form with 3 columns. Modal columns are fixed by the modal width; the page rule (2 columns below 1024, 1 below 640) applies to pages only.

## 5. Binding behavior rules

1. **Modals, never side panels**, for view, create and edit. Line-item documents (invoice, quote) are full pages.
2. **View is edit.** A record opens editable. Save is enabled when something changes, with Undo and an "unsaved changes" indicator. Delete sits in the same footer, with a confirmation. Closing with unsaved changes asks for confirmation. There is no Edit button, except when the record being edited lives outside the current page (for example the customer's details from inside an opportunity). Users without permission see the same fields read-only, with no Save. View fields are white and look exactly like edit fields, never gray or disabled-looking.
3. **Hint icon.** Every label has a "!" icon beside it. Hovering shows a tooltip on the label line that never covers the input. Tab never stops on the icon; connect it with `aria-describedby`.
4. **Errors.** Only field validation appears in the page or modal body: a validation message under its field is allowed and may add its own line. No other message may appear in the body or change the size of a form or modal. Everything else is a toast. Exceptions: 404 and 403 have their own pages; a page that fails to load shows a full-page state with Retry; lost connection is one persistent toast; session expiry redirects to login and returns the user afterwards; a 409 conflict opens a confirmation modal with "Reload" and "Keep my changes".
5. **Toasts.** White card with a countdown bar. Bottom start corner: bottom-left in English, bottom-right in Arabic (opposite the web phone dock at the end corner). Success and info 4s, warning 8s, error stays until closed. At most 3 on screen; repeats merge into one toast with a counter. A new notification raises an info toast.
6. **Country, phone, name.** Country dropdown rows: flag | code | name (ISO code in addresses, dial code in phones). Phone in view: the full number, for example `+201005550142`. Phone in create and edit: code dropdown plus number. Digits only, no spaces and no dashes anywhere, always LTR with the code first, leading zero dropped. Name in view: display name. Name in create and edit: first and last.
7. **Numbers, dates, money.** Western digits. Dates read "15 مارس 2026" / "Mar 15, 2026"; date fields are `20/11/2026`; time is 24-hour. Money is the ISO code before the number, 2 decimals (a plain integer when the rounded fraction is zero), LTR: `EGP 12,500` and `EGP 12,500.50`. Unit prices in line items keep their stored precision.
8. **Three views.** List pages offer Board (kanban), Cards and Table. This includes products, whose stages are Draft, Active, Inactive.
9. **Icons.** Tabler outline. Across the whole app, an icon that carries meaning sits in a solid tile in its semantic color with a white glyph. Small inline icons are linear in the text color. Use the mapping in `05-icons.md`; do not pick icons or colors yourself.
10. **Devices.** Phase 1 is desktop with a mouse only: minimum width 1024, designed at 1366x768. Tablet (touch density) and mobile (a limited set of screens) are later phases. Do not enlarge controls for touch now.

## 6. Components and views (summary; details in the package)

- **Navigation.** Top navigation is primary: two levels, 40 and 32, with a glass pill on the active item. A sidebar is the fallback only (brand fill when expanded, icons when collapsed).
- **Table.** Rows are separate cards, 40 high and 6 apart; header 36 with the gradient; column lines in the header and rows. Filters are chips of 5 types; sort indicator; selection with a bulk-action bar; pinned columns.
- **Stat cards.** Soft shadow, padding 8, a chart in every card. Seven chart shapes: line with arrow, smooth line with arrow, area, bars, half gauge, progress, segmented.
- **Kanban.** Light gray columns (`neutral-soft`); header with name, count, add and collapse; 4px status bar; dashed empty zone with quick add; collapsed column 44 wide with a vertical name. Column minimum width 280, stretching equally, then horizontal scroll. Count on every board.
- **Cards view.** Detailed card for data-heavy lists (leads, opportunities); compact horizontal card for products.
- **Trees.** Three views of the same data: card rows, columns, and an org chart whose card has a colored top band.
- **Activities.** Three views: timeline, card grid, monthly agenda (there is no weekly view).
- **Tabs.** Underline with icons and a counter.
- **Actions menu.** Solid colored icon tiles and the title only, no description line. "Open" and "Edit" both open the same editable record. Delete is last, in red.
- **Date pickers.** Date, date-time and range. Range: no header; full-height preset list (Maximum from 01/01/2020, Today, Yesterday, Today and yesterday, This month, Last month, This year, Last year, First to Fourth quarter written in full); two months or one; time under the calendar as custom hour and minute dropdowns (24-hour, 44x24); default 00:00 to 23:59; day count with Cancel and Apply. The week starts on Sunday.
- **Notifications.** Bell with a red counter. Panel grouped by days, All and Unread tabs, mark all read, action buttons inside items.
- **Other approved controls.** Dropdown, checkbox 16, radio, switch 28x16, multi-select chips, breadcrumbs, pagination, stepper, accordion, upload, tags, avatars, loading and skeleton.

## 7. New in this update (all approved on 20 Nov 2026)

Full specifications are in `08-additional-screens.md`.

- **App switcher** in the navigation bar: a glass pill with the current app name, opening a menu of Workspace, CRM, Trade and Accounting; an app the tenant does not have is shown disabled.
- **Scope switcher**: "company · branch" pill opening one menu with Company and Branch groups. Hidden when the user has only one choice.
- **Global search**: a navigation button with a `Ctrl K` hint, opening a centered 520 modal with grouped results and keyboard hints.
- **Toast stack**: maximum 3, merged repeats with a counter, persistent lost-connection toast without a close button or countdown.
- **409 conflict modal**: 360 wide, "Reload" primary, "Keep my changes" secondary.
- **Error pages**: 404, 403 and load failure, shown under the navigation with an icon tile 36, a title, one line and one button.
- **Login screens**: sign in, two-step verification (six 28x28 code boxes), accept invitation (first name, last name, password), password recovery. No gradient on these screens.
- **Line-item document page**: header with title, status badge, Print, Delete and Save; document fields in compact density; the approved table with a 24 field inside each editable cell; columns follow the document type (discount optional, per-line tax on invoices only, none on quotes); rows reorder by a drag handle; "Add item" small button; totals at the end.
- **Kanban totals**: one neutral tag per currency under the status bar, on opportunities only; a "Load more (24 of 86)" button at the end of each column.
- **Dashboard widget**: frame, edit mode (dashed brand outline, grip, remove, resize), and loading, empty and timeout states. The grid is 48 columns with 8px rows, at most 20 widgets. Base dashboards are read-only with a "Customize" action that creates the user's copy.
- **Attachments**: drop zone and file rows with a type-colored icon tile, meta line, download and delete; a progress bar while uploading.
- **Change log**: who changed what, old value on a soft red chip and new value on a soft green chip.
- **Import wizard**: four steps (upload, map columns, review, import).
- **Chart series palette**: the ten vivid colors in section 3.

## 8. Libraries

The app moves to Angular 22 (latest 22.3.0). Approved stack:

- `@angular/cdk`, `@angular/aria`, Signal Forms
- Tailwind CSS 4, locked to the tokens, with a lint script that rejects bracket values and off-scale numeric steps
- `@jsverse/transloco`
- `@ng-icons/core` with `@ng-icons/tabler-icons`
- `flag-icons`, `date-fns`
- `@fontsource/tajawal`, `@fontsource-variable/readex-pro` (Latin subset)
- `echarts` with `ngx-echarts`
- `gridstack` v12 or later (`column: 48`, `cellHeight: 8`)
- `@atlaskit/pragmatic-drag-and-drop` for kanban, with a custom or disabled native drag preview; prototype it with 2,000 cards before committing. `@angular/cdk/drag-drop` for simple reordering.
- `@tanstack/angular-table`, `@tanstack/angular-virtual`
- `@tanstack/angular-query` as the single tool for server state
- `zod`
- Animations with `animate.enter` and `animate.leave`

Not allowed: `@angular/animations`, PrimeNG, or any pre-styled component kit.

## 9. Intentional choices (do not flag)

- Compact field at 22 and checkbox at 16
- Field border and placeholder contrast as specified
- The kanban status bar conveying status by color alone
- Table rows at 40 with a 6 gap
- Violet in the icon palette

## 10. Corrections already made from your audit

- Ranges replaced with single values throughout `02-measurements.md`.
- Off-scale values moved onto the scale in section 4.
- One focus definition: fields get a `focus-ring` border and a 3px `focus-halo`; buttons get a 3px `focus-halo-strong`.
- Added tokens for z-index, font sizes, sizes and breakpoints.
- Dark `brand-hover` changed to `#2459c4` to fix contrast.
- Icon package corrected to `@ng-icons/tabler-icons`.
- From your second report: badge font is 12 everywhere, tabs font is 12, off-scale values moved onto the scale, a token added for every documented value (sizes, motion, line heights, opacity, glass colors), state colors defined (soft chips, tooltip, row hover, button hover and pressed, valid and warning fields), stale texts updated.

## 11. Values the product owner has not reviewed visually

These are defaults set by the designer to close gaps you reported. Use them, and tell the product owner if any causes a problem:

- Motion durations: 120, 180 and 240ms (tokens `duration-fast`, `duration-base`, `duration-slow`)
- Z-index layers: sticky 100, nav 200, modal 1100, dropdown 1200, toast 1300, tooltip 1400
- The "Other" grouping rule for charts with more than 10 series

## 12. Still open

- Rich text editor: deferred.
- Live previews exist for 8 components only; the rest are specified in text and numbers.
- Tablet and mobile layouts: later phases.

## 13. What to do now

1. Unzip the package to `Z:\mutakamel-memory\design-system\tenant-portal`, replacing any older copy.
2. Read every file, then confirm in one short list that you have no conflict with sections 1 to 9. A conflict with the old red lines is not a conflict.
3. Wire `tokens.css` and the Tailwind 4 theme to the tokens, and add the lint script.
4. Propose the build order for the shared components (start with Button, Field, Badge, Modal, Toast, NavBar, DataTable, StatCard, which have live previews) and wait for the product owner's approval before building.
5. For anything this package does not specify, ask. Do not invent a value.
