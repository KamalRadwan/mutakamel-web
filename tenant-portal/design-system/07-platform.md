# Platform and behavior

## Viewports

- Minimum width 1024. Reference design 1366 x 768.
- Breakpoints: 1024 (`bp-min`), 1280 (`bp-wide`, compact density starts).
- Page form columns follow the container: 4 (compact) or 3 (regular), 2 below 1024 container width, 1 below 640. Modal columns are fixed by the modal width (520 = 2, 580 = 3).

## Stacking

Sticky 100, navigation 200, modal 1100, dropdown 1200, toast 1300, tooltip 1400. Dropdowns, date pickers and menus sit above modals so they open correctly from a field inside a modal. A modal on top of another modal adds 10.

## Motion

- Durations: `duration-fast` 120ms (hover, press), `duration-base` 180ms (menus, tooltips, toasts in), `duration-slow` 240ms (modals).
- Easing: `ease-enter` `cubic-bezier(0.2, 0, 0, 1)` for elements coming in, `ease-exit` `cubic-bezier(0.4, 0, 1, 1)` for elements leaving.
- With `prefers-reduced-motion: reduce`, drop movement and keep fades of 120ms or less.
- Use `animate.enter` / `animate.leave` with CSS.

## Direction and script

- One stylesheet for RTL and LTR through logical properties.
- Mirror in RTL: chevrons, back and forward arrows, the kanban collapse arrows, breadcrumbs, pagination arrows. Do not mirror: check, search, clock, media icons, phone numbers, money.
- Charts keep the time axis left-to-right in both languages.
- Font stack `ui` is the same in both languages. Load Readex Pro with the Latin subset only and Tajawal with the Arabic subset, so Latin text always renders in Readex Pro and Arabic in Tajawal, whatever the page language. Self-host both (`@fontsource`); the previews in this document load them from Google Fonts only because they cannot reach your server.
- No monospace face: codes and IDs use the `ui` stack with tabular figures.

## Accessibility approach

Approved sizes and colors are not changed (see Intentional choices in Critical rules). Everything that does not alter the look is required:

- Hint text linked to its input with `aria-describedby`.
- Full keyboard operation of menus, tabs, pickers and the kanban (keyboard alternative to dragging).
- Visible focus on every interactive element (`focus-halo`, `focus-halo-strong`).
- Status always available as text next to color.
- `prefers-reduced-motion` respected.

## Tailwind mapping

Map the tokens into the Tailwind 4 theme and expose nothing else:

- Colors: every color token by name (`bg-surface`, `text-text-muted`, `border-border-field`).
- Spacing scale: 2, 3, 4, 6, 8, 10, 12, 16 only.
- Sizes: the `size` tokens by name (`h-btn`, `h-field`, `h-table-row`).
- Radius: 2, 3, 4, 6, 8, 10, 12, 14, full.
- Font sizes: 11, 12, 13, 14, 15, 16, 20. Weights 400 and 500.
- Line heights: 16, 18, 20, 22, 24, 26 (`lh-*`).
- Z-index: the `z-*` tokens only.
- Motion: `duration-fast`, `duration-base`, `duration-slow`, `ease-enter`, `ease-exit`; no other durations or easings.
- Opacity and transform: `opacity-drag-source`, `drag-tilt`.
- Border widths: `border-w` 1, `border-w-check` 1.5, `border-w-strong` 2.
- The lint script fails the build on bracket values and on numeric steps outside these lists.

## Navigation additions

App switcher, scope switcher and search: see Additional screens and components.

## Tables (approved)

Filters (select, multi-select, date range, number range, yes/no) shown as chips under the toolbar; sort indicator in the header; row selection with a bulk actions bar; pinned columns with horizontal scroll.

## Kanban additions

- Column min width 280; columns stretch equally when they fit, otherwise horizontal scroll.
- Header shows the count on every board; total amount per currency on opportunities only, as tags under the status bar.
- "Load more" button at the end of each column.

## Dashboards

- User can move and resize widgets. Grid of 48 columns, row height 8, at most 20 widgets, min and max size per chart type.
- The base dashboards are read-only; "Customize" creates a copy.
- Widget frame, edit mode, series colors and states: see Additional screens and components.

## Still open

- Rich text editor: deferred.
- Live previews in this document exist for 8 components; the rest are specified in text.
- Touch density (tablet) and mobile layouts: future phases.
