# Additional screens and components

Status: approved by the product owner on 20 Nov 2026. All sizes are on the size scale.

## Navigation: app switcher, scope switcher, search

- Top bar, start to end: logo text, app switcher, divider, section items, then search, scope switcher, bell, avatar.
- App switcher: nav item pill (28) with a grid icon, the current app name and a chevron, in the glass style. Opens a menu of apps: rows 28 with a solid icon tile 24; the current app is `brand-soft` with a check; an unavailable app is shown disabled with the label "unavailable".
- Scope switcher: nav item pill with a building icon and "company · branch". Opens one menu with two groups, Company and Branch (and Channel in Trade); the current choice is `brand-soft` with a check. Hidden when the user has one choice. The choice is kept per browser tab: each tab reads its own saved choice (session storage); a tab that has none (first open) copies the general saved choice (local storage) once; changing the choice in a tab saves it in that tab and in the general one, and never changes other open tabs. Two tabs can work on two branches without mixing data.
- Search: nav item pill with a search icon, the word "Search" and a `Ctrl K` hint. Opens a centered modal 520 wide: search field 28 with focus ring, grouped results in rows 28 with icon tile 24 and the app name at the end, footer with key hints on `surface-muted`.

## Toast stack

- At most 3, 8 apart. Repeats merge into one toast with a 16px counter beside the title.
- Lost connection: one `danger` toast with a wifi-off icon, no close button and no countdown bar, until the connection returns.

## Conflict modal (409)

Confirmation modal 360: orange icon tile 28, title, one line, buttons "Reload" (primary) and "Keep my changes" (secondary).

## Error pages

Shown in place of the page content, under the navigation. Centered: icon tile 36, title 16/500, one line 12 `text-muted`, one primary button 28.

- 404: gray tile, file-search icon, button "Back to home".
- 403: orange tile, lock icon, button "Back to home".
- Load failure: red tile, refresh icon, button "Retry".

## Login screens

Card width 360, radius 14, padding 10, title 16/500, fields 24, one full-width primary button 28, a link in `brand` under it.

- Sign in: email, password with show/hide.
- Two-step verification: six code boxes 28 x 28 (LTR), link "Use a backup code".
- Accept invitation: first name, last name, password.
- Password recovery: email, link back to sign in.

## Line-item document page (invoice, quote)

A full page that follows the view-is-edit rule.

- Header row: entity icon tile 28, title 16/500, status badge, then Print, Delete, Save (28).
- Document fields in a card, compact density, 4 columns.
- Items table: the approved table (gradient header 36, card rows 40, 6 apart, column lines) with a 24 field inside each editable cell. Numbers are LTR; the line total is read-only and right-aligned. The table scrolls horizontally below its minimum width (860).
- Columns follow the document type and its settings, never a fixed list. Always: drag handle, #, item, description, quantity, unit, price, total, remove. Optional: discount (shown when the document uses it) and tax per line (invoices; a quote has no per-line tax, it is entered on conversion).
- Rows are reordered by dragging the grip handle in the first column (icon 14, `text-muted`); the dragged row uses `shadow-drag` and the target shows a 2px dashed `brand` line. Keyboard alternative: move up / move down in the row menu.
- Unit price keeps its stored precision; amounts and totals show 2 decimals (a plain integer when whole).
- "Add item" small button (24) under the table.
- Totals at the end of the page: label and LTR amount pairs; the grand total is 14/500.

## Kanban column totals and load more

- Under the status bar: one neutral tag (20) per currency, LTR, for example `EGP 1,650,000` and `USD 12,400`. Opportunities only.
- At the end of the column: a full-width small button (24) "Load more (24 of 86)"; when everything is shown, an 11px `text-muted` line instead.

## Dashboard widget

- Frame: card (padding 8, radius 10). Header: title 13/500, optional period tag, "..." small icon button (24).
- Edit mode: 2px dashed `brand` outline, grip handle at the start of the header, remove button, resize handle in the end-bottom corner.
- States: loading (skeleton lines 10 high in `neutral-soft`), empty (icon tile 36 + one line), timeout (one line + small "Retry" button).
- Chart series colors, tokens `chart-1` to `chart-10`, used in order. Dark theme (the vivid set as chosen): `#2f6bff`, `#00d4ff`, `#00e08a`, `#ffd000`, `#ff3d57`, `#a24bff`, `#ff4fc3`, `#00c9a7`, `#ff8a00`, `#7c8cff`. Light theme (darker so every color reaches 3:1 on white): `#2f6bff`, `#0099c2`, `#00a865`, `#b88a00`, `#ff3d57`, `#a24bff`, `#e83fb0`, `#00a388`, `#e06c00`, `#6675f0`. A chart with more than 10 series groups the rest as "Other" in `status-none`. Chart colors never carry status meaning.

## Attachments

Dashed drop zone (full width, height 56), then file rows: icon tile 24 colored by file type (PDF `icon-red`, spreadsheet `icon-green`, document `icon-blue`, image `icon-violet`, archive `icon-orange`, other `icon-gray`), name 12/500, a line with size, uploader and date (11), download and delete small icon buttons (24). While uploading, a 4px progress bar replaces the meta line.

## Change log

Rows separated by a divider: avatar 24, "who did what" line, old value on a `danger-soft` / `on-danger-soft` chip and new value on a `success-soft` / `on-success-soft` chip (height 20, radius 6, padding 0 6) with an arrow between, time (11).

## Import wizard

Four steps in a stepper (upload file, map columns, review, import). Mapping step: each row is the file column (field 24), an arrow, the system field dropdown (24) and a check when mapped; an unmapped column shows "Ignore column". Footer: Next (primary), Previous (secondary), row count at the far end.
