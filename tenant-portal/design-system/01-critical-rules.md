# Critical rules

**Authority.** The decisions recorded in this design system are the single source of truth. Any earlier "red lines" document (`00-redlines-reference.md`) belongs to the old system and is void: delete it, and never compare this system against it. Where an older rule disagrees (purple hue, description lines, row density), the decision here wins.

**Fidelity.** Every value was approved by the product owner on a live example. Do not round, restyle or "improve" an approved size or color, including for accessibility; see Intentional choices at the end.

## 1. Tab skips the hint icon

Every field label has a hint icon ("!") that shows the field's details on mouse hover. The Tab key moves only between inputs and interactive items. The hint icon is never a tab stop (`tabindex="-1"`).

The tooltip opens on the label line beside the icon and must never cover the input. Link the hint text to its input with `aria-describedby` so screen readers still announce it.

## 2. Errors

- The only message allowed in a page or modal body is the validation message directly under its field.
- No other message may sit in the body or change the size of a form or modal: no banners, no summary blocks.
- Every other error (save failure, server error, permission on an action) is a toast.
- Exceptions, because there is no page to show a toast over or a choice must be made:
  - 404 and 403 have their own pages.
  - A page that fails to load shows a full state in place of the content: icon, one line, one button.
  - Lost connection: ONE persistent toast until the connection returns, not one per failed request.
  - Session expired: redirect to login, then return to the same place.
  - Conflict (409): a warning confirmation modal with two choices, "Reload" or "Keep my changes".

## 3. Measurements are fixed

Every size, padding, radius and font size comes from the tokens and the Measurements section. No free values. In Tailwind 4, lock the theme to these steps and run a lint script that rejects bracket values (`h-[27px]`) AND any numeric step outside the approved list (`h-27`).

## 4. Icons are semantic and solid

Entity, activity, action and status icons use a color chosen by meaning inside a solid tile with a white glyph, across the whole application. Small icons inside controls (chevrons, search, close, an icon beside button text) stay linear in the text color. The violet tile is approved and stays.

## 5. View, edit and delete are one place

A record opens in ONE page or modal that is editable immediately. There is no "Edit" button and no separate edit mode.

- Save is manual: the Save button enables when something changed, with an "Undo" action and an "unsaved changes" label.
- Delete is in the same footer and asks for confirmation.
- Closing with unsaved changes asks for confirmation.
- The only Edit button is for a record outside the current one (example: editing the customer's details from an opportunity). It opens that record's modal on top. The "Edit" item in a record's Actions menu is the one approved exception: it opens the same editable record (AGENTS.md, Approved exceptions).
- A user without edit permission sees the same layout with read-only fields and no Save button.
- View, create and edit use modals, never a side panel. Documents with line items (invoice, quote) are full pages and follow the same rule.

## 6. Country, phone and name fields

- Country dropdown rows are: flag, code, name. ISO code in address fields, dial code in phone fields.
- Phone: in view it is one full number (`+201005550142`). When the user enters the field, and in create, it splits into dial-code dropdown + number.
- Name: in view it is the display name. When the user enters the field, and in create, it splits into first name + last name.

## 7. Phone numbers

- Digits only. No spaces, dashes or brackets, in view or edit. Strip them on paste. Drop the leading zero of the local number when the dial code is added.
- Always left-to-right, code first then number, left-aligned, in Arabic and English. The control never mirrors.

## 8. Numbers, dates and money

- Western digits (123) in both languages.
- Dates: display "15 مارس 2026" / "Mar 15, 2026"; inside fields `20/11/2026`. Time is 24-hour.
- Money: multi-currency. ISO code, never a symbol, BEFORE the number, always left-to-right in both languages with Latin digits. Amounts round to 2 decimals and show a plain integer when the rounded fraction is zero: `EGP 12,500` and `EGP 12,500.50`.
- Unit prices in line items keep their stored precision (up to 8 decimals); the 2-decimal rule is for amounts and totals.

## 9. Gradient scope

The navy gradient is for the top navigation, the table header and the calendar weekday header. The approved exceptions in `AGENTS.md` (Approved exceptions table) add the web phone header and the coloured section bars; nowhere else. Primary buttons are solid `brand`.

## 10. Toasts

- White card with a colored icon and a countdown bar.
- Position: bottom start corner, bottom-left in English and bottom-right in Arabic, so toasts never meet the web phone dock at the end corner.
- Duration: success and info 4s, warning 8s, error stays until closed.
- At most 3 visible. Repeated identical messages merge into one toast with a counter.
- A new notification also raises an info toast.

## 11. Due status colors

Overdue = red, today = orange, upcoming = green, none = gray. A kanban column bar shows the share of the stage's leads in each due status, including leads with no activity: one segment per status, sized by its count, in the order red (overdue), orange (today), green (upcoming), gray (no activity). The counts are also given as text (tooltip and accessible label).

## 12. Three views

Most list pages offer Board (kanban), Cards and Table through the same view switcher. Products included, with stages Draft, Active, Inactive.

## 13. Devices

- Phase 1 (now): desktop with a mouse. Minimum viewport 1024px, reference design 1366 x 768. A tablet in landscape can open the system but is not a design target.
- Phase 2 (future): a touch density for tablets. Same layouts; a second set of size values switches in. This is why every size must be a token.
- Phase 3 (future): mobile, for a limited set of screens only (notifications and approvals, lead and opportunity lists, activities, quick create), with its own layouts.

## 14. Brand color

The colors in this system are fixed. Per-tenant branding is a future feature; when it arrives, only `brand` and its derivatives will change. The gradient, status colors and icon tiles stay fixed.

When the brand color is used as text or a link (not a fill), use `brand-text`, never `brand`. It equals `brand` in light (#1d56c9) and is lighter in dark (#608ee7) so text keeps 4.5:1 on bg and surface. `brand` stays for fills (primary button, selected segment, selected day). `brand-text` is a derivative of `brand` and changes with it.

The same rule holds for the status colors. When success, warning or danger is used as text or an icon (not a fill), use `success-text`, `warning-text` or `danger-text`, never `success`, `warning` or `danger`. In light the fills are too bright for text (success 2.40:1, warning 2.05:1, danger 3.05:1 on surface). The text tokens keep at least 4.5:1 on surface, bg, row-hover, surface-muted, neutral-soft and their own soft fill in both themes: `success-text` light #067c4c / dark #45d6a0, `warning-text` light #8a5200 / dark #ffb84d, `danger-text` light #c2281c / dark #ff8a8d. `success`, `warning` and `danger` stay for fills (status bars, dots, solid badges with their `on-*` text), and the soft fills are unchanged. There is no `warning-soft`: a soft warning chip is `bg-neutral-soft text-warning-text`.

## Intentional choices (do not "fix")

These were chosen on purpose for density. Reviews must not report them as defects:

- Compact field height 22px and checkbox 16px (below a 24px target).
- No longer an exception: `text-placeholder` was raised on 2026-11-21 to meet WCAG 4.5:1 in both themes (light #6b7086, dark #7a86a5). Coordinator decision: accessibility over the earlier low-contrast choice. Reviews must now report any placeholder or disabled text below 4.5:1. `border-field` meets 3:1.
- Kanban status bar and timeline dot carry due status by color; the card badge beside them carries the same status in words.
- Table row 40px with 6px between rows.
- A helper line in an empty kanban stage.
- Global search input is 28 high (`search-field-h`); every other field is 24 or 22.
