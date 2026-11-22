# Measurements

All values in px. One value per property. Do not round or substitute.

## Size scale

Every control height comes from one scale, so no view looks larger or smaller than another:

| Step | Used for |
|---|---|
| 40 | Top navigation bar, table row, tree card row |
| 36 | Table header, bulk actions bar, empty-state icon tile |
| 32 | Sub navigation bar, tabs (everywhere, including the notification panel) |
| 28 | Button, nav item, menu row, icon button, icon tile in cards, calendar day cell, nav avatar |
| 24 | Field, small button, small icon button, icon tile in rows and menus, avatar, filter chip, preset row, time list row, pagination button |
| 22 | Compact field only |
| 20 | Badge, tag, count pill, stepper circle |
| 16 | Checkbox, radio, switch height, counters |

## Navigation

| Element | Height | Font | Notes |
|---|---|---|---|
| Top bar | 40 | 13 | Padding 0 12. Logo text 15/500. |
| Nav item pill | 28 | 13 | Padding 0 10, radius 8. Active: glass pill. |
| Sub bar | 32 | 13 | Item padding 0 10. Icon 16 in the page's `icon-*` color, no tile, gap 6. Active: filled brand button, radius 8, 24 high, text and icon `on-brand` (03-components). |
| Nav avatar | 28 | 11 | |
| Nav icons (search, bell) | 17 | | |
| Notification counter | 16 | 11/500 | Min width 16, radius 8, `danger` fill. |

## Buttons

| Size | Height | Padding | Font | Radius | Icon | Use |
|---|---|---|---|---|---|---|
| Default (largest) | 28 | 0 12 | 12/500 | 8 | 15 | Page and modal actions |
| Small | 24 | 0 8 | 11/500 | 6 | 14 | Cards, rows, pickers, notifications |
| Icon button, default | 28 x 28 | 0 | | 8 | 15 | |
| Icon button, small | 24 x 24 | 0 | | 6 | 14 | |

Gap icon to text 4. Focus: 3px `focus-halo-strong`.

| Button | Default | Hover | Pressed |
|---|---|---|---|
| Primary | `brand` | `brand-hover` | `brand-pressed` |
| Secondary | `surface` + border `border-field` | `surface-muted` + border `border-field-hover` | `neutral-soft` + border `border-field-hover` |
| Ghost | transparent | `neutral-soft` | `border` |
| Danger | `danger` | `danger-hover` | `danger-pressed` |

## Fields

| Density | Field height | Label row | Label font | Columns | Row gap | Column gap |
|---|---|---|---|---|---|---|
| Regular | 24 | 18 | 12 | 3 | 8 | 10 |
| Compact | 22 | 16 | 11 | 4 | 6 | 10 |

- Field: font 12, padding 0 8, radius 8, border 1. Label margin-bottom 2.
- Focus: border `focus-ring` + 3px `focus-halo`. Error: border `danger-border` + 2px `danger-halo`.
- Validation message: font 11, line height 16, margin-top 2, icon 11. Appears only when present.
- Hint icon 14. Hint tooltip: `tooltip-bg` with `on-tooltip` text, height 20, font 12, padding 0 8, radius 6, 6px from the icon, on the label line.
- Textarea: height 56, line height 18.
- Dropdown menu: radius 10, padding 4, row 28, row radius 6; selected row `brand-soft` with a 14 check.
- Use Regular in modals and below 1280 wide; Compact from 1280. On pages, columns drop to 2 below 1024 container width and to 1 below 640. In modals the column count is fixed by the modal width and never drops: 520 = 2 columns, 580 = 3 columns.

- Valid: border `success` with a 14 check in `success-text`. Warning: border `warning`, message in `warning-text`.

## Selection controls

| Control | Size |
|---|---|
| Checkbox | 16, radius 4, border 1.5, check 12 |
| Radio | 16, inner dot 6 |
| Switch | 28 x 16, knob 12, inset 2 |
| Multi-select chip | height 20, font 11/500, radius 6, padding 0 6, inside a 24 field |
| View switcher | container padding 3, radius 10; segment height 24, padding 0 10, radius 8, font 12 |

## Tabs, breadcrumbs, pagination, stepper

- Tabs: height 32, padding 0 10, font 12, icon 14, counter 16 high with font 11; active = `accent` + 2px bottom line.
- Breadcrumbs: font 12, chevron 12, gap 4.
- Pagination: buttons 24 x 24, radius 6, font 12, gap 4.
- Stepper: circle 20, font 11, connector 2 high.

## Table (rows as cards)

- Header bar: height 36, radius 10, gradient, font 13/500, cell padding 0 10, column lines `on-nav-line`.
- Row: height 40, radius 10, margin-top 6, font 14, cell padding 0 10, column lines `border`.
- Badge: height 20, padding 0 8, font 12/500, radius 8 (same in tables, cards, kanban and notifications).
- Icon tile in a cell: 24, radius 8, icon 14.
- Selection column 36 wide. Sort icon 13.
- Row hover: `row-hover` fill. Selected row: `brand-soft` fill with a 1px `brand` border.
- Bulk bar: height 36, radius 10, padding 0 10, `brand-soft`, buttons 24.
- Filter chip: height 24, padding 0 8, radius 8, font 12/500, `brand-soft`.

## Cards

- All cards: padding 8, radius 10.
- Stat card: label 12, value 20/500 (line 26), delta 12, chart box 84 x 38, gap 8.
- Detailed record card: icon tile 28, name 13/500, small buttons 24, divider margin 8 0, detail rows 12.
- Compact product card: one row, gap 8, icon tile 28, name 13/500, sub line 12, price 13/500.

## Kanban

- Column: min width 280, radius 14, header padding 8 8 6, name 14/500, count pill 20 high with font 12.
- Header buttons: 28 x 28, radius 8, icon 15. Status bar: height 4, radius 2, margin 0 8 8.
- Card: radius 10, padding 8 8 8 12, start edge 4 wide, gap between cards 6.
- Card internals: icon tile 28, small buttons 24, stars 14, avatar 24, divider margin 8 0.
- Empty zone: 1px dashed border, radius 10, icon tile 36 with icon 18, title 13/500, helper 12, button 28.
- Collapsed stage: width 44, padding 8 0, gap 8.
- Dragging: card rotates -3deg with `shadow-drag`; source fades to 35%; target shows a 2px dashed `brand` placeholder filled `brand-soft`.

## Modals

| Type | Width |
|---|---|
| Alert | 280 |
| Confirmation | 360 |
| View / create, 2 columns | 520 |
| View / create, 3 columns | 580 |

Radius 14. Header padding 8 10, title 15/500, icon tile 28. Body padding 10. Footer padding 8 10, `surface-muted`. Primary button first, then cancel; delete at the far end.

## Toast

Width 260, radius 10, padding 8 10, icon circle 24 with icon 14, title 13/500, text 12, countdown bar 3 high. Gap between stacked toasts 8. Distance from viewport edges 12.

## Date pickers

| Property | Two months | One month |
|---|---|---|
| Picker width | 528 | 348 |
| Day cell width | 28 | 32 |

- Selected circle 26, range band 26 high, weekday row 20 with font 11, month header 28 with font 13/500, nav buttons 24, gap between months 12.
- Preset sidebar: width 108, padding 6, row height 24, font 12, row radius 6, gap 2.
- Time dropdowns: 44 x 24, radius 6; list row 24, list max height 136, opens upward. A time is always two dropdowns side by side: hour (00 to 23) and minutes (00 to 59), on every page.
- Footer buttons 24. Picker padding 8. Radius 12.

## Notifications

Panel width 330, radius 12, list max height 330. Item padding 8 10, gap 8, icon tile 28, title 12/500, text 12, time 11, unread dot 8. Day header 11/500, padding 6 10 2. Tabs height 32.

## Tree and org chart

- Card rows: height 40, indent 24 per level, gap 6.
- Columns view: row 28.
- Org chart card: 136 x 52, radius 12, top band 6, name 12/500, type line 11; connectors 1.5.

## Activities

- Timeline: line 2 wide, dot 12, card padding 8, icon tile 28.
- Card grid: top band 4, padding 8.
- Monthly agenda: weekday header 28, day cell min height 74, padding 3, day number 20 circle with font 11, event row font 11 with radius 6.

## Icons and avatars

Icon 11 (in messages), 14 (in 24 buttons), 15 (in 28 buttons and tiles), 16 (default), 17 (nav), 20 (headings). Solid tile 28 (cards, modal header, notifications, activities), 24 (menus, table cells, toasts) or 36 (empty states), radius 8. Avatar 24, nav avatar 28, overlap in a group 6.

## States and tokens

- Skeleton: `neutral-soft`, lines 10 high.
- Menu row and tree row hover: `row-hover`.
- Every measurement in this file has a token in `tokens.json` (families `size`, `spacing`, `radius`, `fontSize`, `lineHeight`, `motion`, `opacity`, `zIndex`). Inner marks that are not control heights (selected day circle 26, switch knob 12, radio dot 6, checkbox check 12, timeline dot 12, unread dot 8) have their own tokens and are not steps of the size scale.
- Border widths: 1 (default), 1.5 (checkbox, hint ring, org connectors), 2 (active line, drag placeholder, timeline line).
- Login card width 360. File drop zone: full width, height 56.
- Global search input: 28 (`search-field-h`). This is the only field that is not 24 or 22; it is intentional.
- Dragged kanban card tilt: -3deg (`drag-tilt`).
