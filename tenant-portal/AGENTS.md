# tenant-portal: instructions for AI agents

This file exists three times with identical content: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex) and `GEMINI.md` (Antigravity). They are one document.

## Rule 1: the three instruction files change together

- Any change to `CLAUDE.md`, `AGENTS.md` or `GEMINI.md` must be made to all three in the same change, so the files stay byte-identical.
- Never edit only one of them. Before finishing, confirm the three files are identical (for example `git diff --no-index CLAUDE.md AGENTS.md` and `git diff --no-index CLAUDE.md GEMINI.md` print nothing).

## Project files

- This folder holds code and the files the app ships or needs to build only. Images the app shows live in `public/assets/` (logos in `public/assets/brand/`).
- Everything else (studies, plans, reports, previews, source images, scripts that are not part of the build, scratch files) goes to `Z:\mutakamel-memory\`, never into this folder.

## Rule 2: follow the design system exactly

The design system in [`design-system/`](design-system/) is the only source of truth for every visual and interaction decision in this app. Follow it completely. Never depart from it.

- This in-app copy is the approved version. The copy under `Z:\mutakamel-memory\design-system\` is only a draft: never read it as a source, and never build from it.
- Check the design system before EVERY creation or update, however small: one class, one color, one spacing, one icon, one label position. There is no change too small to skip this check.

Before creating or updating anything that is visible or interactive (a component, page, style, token, Tailwind setting, icon, text layout, or UI library choice), read the design system first, in this order:

1. [`design-system/HANDOVER.md`](design-system/HANDOVER.md)
2. [`design-system/README.md`](design-system/README.md)
3. [`design-system/01-critical-rules.md`](design-system/01-critical-rules.md)
4. [`design-system/02-measurements.md`](design-system/02-measurements.md)
5. [`design-system/03-components.md`](design-system/03-components.md)
6. [`design-system/04-views.md`](design-system/04-views.md)
7. [`design-system/05-icons.md`](design-system/05-icons.md)
8. [`design-system/06-libraries.md`](design-system/06-libraries.md)
9. [`design-system/07-platform.md`](design-system/07-platform.md)
10. [`design-system/08-additional-screens.md`](design-system/08-additional-screens.md)
11. [`design-system/09-record-module.md`](design-system/09-record-module.md) (the record module pattern: list, search, quick modal, full page; CRM Leads is the reference)
12. [`design-system/tokens.json`](design-system/tokens.json) and [`design-system/tokens.css`](design-system/tokens.css)
13. The matching folder in [`design-system/components/`](design-system/components/) (its `README.md` and `preview.html`).

What that means in practice:

- Use tokens only. No raw hex colors, no free pixel values, no Tailwind bracket values (`h-[27px]`), no numeric steps outside the approved lists.
- Do not change a color, size, radius, font, spacing, icon, motion value or behavior on your own judgment, not even for accessibility. The "Intentional choices" in `01-critical-rules.md` are decisions, not defects.
- Use only the libraries in `06-libraries.md`. Do not add any other UI kit or styling library.
- If something is not specified in the design system, stop and ask the product owner. Do not invent a value.
- If you think the design system is wrong, report it as a question and keep implementing the documented value.
- The design system is maintained by the product owner. Do not edit files in `design-system/` unless the product owner asks you to.
- Rules 2, 3 and 4 override any general guidance below when they disagree.

### Approved exceptions

The product owner approved these departures. They live in `src/styles/exceptions.css` and are used only where listed. Do not reuse them elsewhere and do not "fix" them back.

| Where | What | Value |
|---|---|---|
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Field height (`Field size="large"`, text 14) | 36 (`h-login-field`) |
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Primary button height (`uiButton size="large"`, text 14) | 40 (`h-login-btn`) |
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Logo height, inside the card and centered | 64 (`h-login-logo`) |
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Card padding and vertical gap between all its parts | 16 (`p-16`, `gap-16`) |
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Title centered | `text-center` |
| Login and auth pages (`/login`, `/verify`, `/reset-password`, `/tenant/reset-password`, `/tenant/accept-invite`) | Language dropdown and light/dark toggle at the top end of the page (`ui-preferences`) | 16 from the edges |
| Whole app | Default language and theme when the user has not chosen | English, light |
| Top nav | Logo: full horizontal logo `logo-horizontal-light.png` (always, the bar is dark), 28 high, inside a fixed area | area 150 wide (`w-nav-logo`) |
| Top nav, CRM | Each main option shows a solid icon tile 24 before its name: dashboard `tablerLayoutDashboard` navy, leads `tablerUserPlus` green, customers `tablerUsers` blue, opportunities `tablerTarget` red, reports `tablerChartBar` teal, settings `tablerSettings` gray | tile 24, start padding 2 |
| Top nav, CRM | Activities is not a main option; it is in the user menu (Preferences, Activities, Log out) | |
| Top nav, every width | Main options that do not fit move into a "More" menu (dots icon, glass when the open section is inside it); measured live by `shared/ui/overflow/overflow-fit.ts` | |
| Top nav, below 1024 (`desktop` breakpoint) | Icons only for More, language and user (avatar only). The logo (full, area 150) and the app switcher name never change with width | |
| Sub nav | Scrolls sideways (no scrollbar) when its pages do not fit | |
| Sub nav, CRM settings | Pages: lead-stages, pipelines, opportunity-stages, lead-sources, tags, custom-fields, reasons, outbound-emails, general (CRM settings), duplicates, static-data, targets, sla, calendars, data-readiness; icons and colors in `layout/navigation.ts` (colored 16 icon without a tile, now in the design system); URL `/crm/settings/<page>`, first page active by default | |
| Every phone number (cards, tables, details) | Three link icons after the number, glyph only, no tile, in small 24 icon buttons (glyph 14): call `tablerPhone` `icon-green` (`tel:`), WhatsApp real logo `simpleWhatsapp` in `brand-whatsapp`, Telegram real logo `simpleTelegram` in `brand-telegram`. `@ng-icons/simple-icons` is allowed for these two logos only | `--brand-whatsapp: #25d366`, `--brand-telegram: #26a5e4` in `styles/exceptions.css` |
| Actions menu of a record (lead card, row "...") | Has both "Open" and "Edit"; both open the same editable record page (rule 5 still holds: one place, no separate edit mode). Reason: users look for an Edit item. Rows show the icon tile and the title only, with NO description line (owner 2026-11-21). The lead menu has no "Activities" item (the due badge opens the activities window) | |
| Top nav, scope switcher | Icon only: a nav pill 28 high (padding 0 2 at the start, 0 6 at the end, gap 4) holding a solid tile 24 `bg-icon-teal` (radius 8) with a white `tablerBuilding` 15, then a `tablerChevronDown` 14 in `text-on-nav-muted` (no "company · branch" text), 8 apart from the language control (`me-8`); the names are in its tooltip (`title`) and `aria-label`, and in the menu | `h-nav-item`, `size-icon-tile-sm` |
| Activities modal (record activities) | Width 660 instead of 580, so Priority and Direction fit side by side on one line; one fixed height for every tab and every activity type (720, or the screen height minus 32 when smaller) so switching type never changes the height; only the body scrolls | `--modal-activity-w: 660px` (`w-modal-activity`), `--modal-activity-h: 720px` in `styles/exceptions.css` |
| User menu, "View" | Page scale chosen by the user: Automatic (default: window narrower than 1280 → 80%, 1280 to 2199 → 100%, 2200 and wider → 120%, re-checked on resize), Small = 80%, Balanced = 100%, Large = 120%; applied as CSS `zoom` on `<html>`; remembered in `localStorage` key `view`. Popovers that compute positions divide by the zoom (`shared/ui/overlay/zoom.ts`). Study: briefs/13-view-scale-study.md in the project memory | `zoom: 0.8 / 1 / 1.2` |
| Leads, Cards and Table views | A stage filter bar under the toolbar shaped like a breadcrumb but made of filled arrow buttons: "All" then every stage in order, each with its count; the chosen step is `bg-brand text-on-brand`, the others `bg-brand-soft text-on-brand-soft`; the Disqualified step uses the danger family (`bg-danger` / `bg-danger-soft`) and the Converted step the success family (`bg-success` / `bg-success-soft`), set through the step `tone`; height 28, font 12/500, steps overlap by their arrow (`shared/ui/step-filter`) | |
| Lead card (board and Cards view) | The title block always reserves two lines (name + contact) so every card has the same height; in the Cards grid every card in every row has the same height (`auto-rows-fr`), the footer row is pinned to the bottom, cards use `shadow-popover` and the gap is 12 (owner 2026-11-21) | `--card-title-h: 36px` (`min-h-card-title`) |
| Leads board | Columns never scroll on their own; each column is at least as tall as the page (measured at runtime, `[style.min-height.px]`) and only a fuller column grows; the page scrolls; the board's sideways scrollbar is always shown so the measure is exact; each stage ends with Load more (owner 2026-11-21) | |
| Leads Cards and Table | Pagination (`ui-pagination`) instead of Load more, always at the end of the page; page and size in the URL (owner 2026-11-21) | |
| Lead quick modal and full page | E1-E4: two-column quick modal 980 x 760 (side column 320; owner 2026-11-21 made it 100 wider); full page: no side columns; header card with tabs Overview / Activities / Calls / Attachments / History; Overview in the design-width canvas (1366) with the 2 / 3 / 4 column page grid. E6: a live duplicate-suggestion strip inside the form body (a suggestion list with actions, not an error banner). E7: footer adds "Save and add another" and "Continue in full page". The header holds no data or inputs (owner 2026-11-21), so the old E5 header band is withdrawn. Sizes: owner approval pending. The tokens are named for the shared record modal (also used by Trade items) | `--modal-record-w: 980px` (`w-modal-record`), `--modal-record-h: 760px`, `--record-side-w: 320px` (`w-record-side`) in `styles/exceptions.css` |
| Advanced search builder | Expanded panel max height 360 with its own scroll; collapsed it is a one-line summary (owner 2026-11-21) | `--query-builder-max-h: 360px` (`max-h-query-builder`); field and operator columns `--qb-field-w: 136px`, `--qb-op-w: 108px` |
| Workspace Home | App cards 250 wide in an auto-fill grid (`grid-app-cards`), centered content, floating shadow; section headers are 36 bars like a table header, one colour per section (gradient, blue, violet; the teal bar was replaced for dark-mode contrast) (owner 2026-11-21) | `--app-card-w: 250px`, `--shadow-app-card*` |
| Workspace Home, "Add to your workspace" bar (`home-page.html`) | The bar uses `bg-icon-blue` instead of `bg-icon-teal`: white `text-on-nav` on teal failed contrast (t-home contrast fix, 2026-11-21) | `bg-icon-blue` |
| Workspace Home, loading skeletons | App card skeleton line widths: title 136, text 180, badge 84 (owner 2026-11-21) | `--app-skeleton-title-w: 136px`, `--app-skeleton-text-w: 180px`, `--app-skeleton-badge-w: 84px` (`w-app-skeleton-title/-text/-badge`) in `exceptions.css` |
| Lead quick modal and full page, section headers | Each section header is a 36 colourful bar like a table header (Lead classification gradient, Company/Contact details navy, Contacts blue, Custom fields violet, More details blue), the same pattern as the Workspace Home bars; Company name moves into the Company group; required custom fields sit under Expected value; other custom fields get their own section, not More details (owner 2026-11-21) | |
| Web phone dock (R1) | The phone is docked to the bottom edge at the END corner (bottom-right in English, bottom-left in Arabic; owner 2026-11-21 moved it from the start corner): open panel with `rounded-t-12` and no bottom border; folded = a 32 bar 275 wide. **Replaces E7** (round launcher + round pill) (owner 2026-11-21). After the last call ends the open panel folds to the bar after 3 s (ended summary stays in the bar); on `lg` the open panel reserves inline-end room in `<main>` so it never covers content (coordinator 2026-11-21) | `--phone-bar-h: 32px` (`h-phone-bar`), `--phone-bar-w: 275px` (`w-phone-bar-w`), `--phone-panel-reserve` (`pe-phone-panel-reserve`) |
| Web phone dial input and toasts | The dial input has no visible label or "!" hint (aria-label "Phone number" and the placeholder only) and is never replaced in any call state; toasts moved to the bottom START corner so they never meet the phone at the end corner (owner 2026-11-21) | |
| CRM dashboards (own or EDIT-shared) | An "Edit layout" button enters layout editing (Q1); base dashboards use "Customize" (copy) (owner 2026-11-21) | |
| Dashboard and report charts | Money axes show full integers without decimals and without compacting; the currency is in the widget tag; tooltip and table show ISO + the money display rule (2 decimals, a plain integer when whole) (Q8, owner 2026-11-21) | |
| Charts (area fills, sankey links) | Fill opacity variables (Q9, owner 2026-11-21) | `--chart-fill-opacity: 0.25`, `--chart-link-opacity: 0.35` |
| Stat cards (KPI widgets) | Long money values truncate with a tooltip holding the full value; widget sizes stay from the catalogue (Q16, owner 2026-11-21) | |
| Widget builder page | Sticky page footer with the modal-footer look (Q20); choice tiles for templates and the chart gallery (Q21) (owner 2026-11-21) | |
| Report catalogue, dashboard and widget libraries | Toolbar toggles (Favourites, Available to me); no Board view (Q22, owner 2026-11-21) | |
| CRM dashboard routes | Pages deeper than `/<app>/<feature>/:id` (`/crm/dashboard/dashboards/:id/records`, `/crm/dashboard/widgets/:id/:tab`, `/crm/reports/catalogue/:key/:tab`) (Q27, owner 2026-11-21) | |
| Trade documents, SO/PO line table | Per-line tax and charge columns (the backend requires them) (E-D1, owner 2026-11-21) | |
| Trade quotation (sent) | A "price locked" chip on a sent quotation (E-D2, owner 2026-11-21) | |
| Trade purchase order | A soft approval line under the header (E-D3, owner 2026-11-21) | |
| Trade SO/PO line table | Minimum width 1100 with its own horizontal scroll (E-D4, owner 2026-11-21) | 1100 (`--doc-table-wide-min-w: 1100px`) |
| Web phone page room (R2) | `<main>` bottom padding shrinks to the folded bar height plus a gap. **Replaces T4 64** (owner 2026-11-21) | `--phone-reserve: 40px` |
| Web phone header, folded bar, incoming card header (R3) | The navy gradient (`nav-start → nav-end`) as a 4th place (today: nav bar, table header, calendar header only) (owner 2026-11-21) | — |
| Web phone body (R4) | Body height 448 instead of 360. **Replaces T2** (owner 2026-11-21) | `--phone-body-h: 448px` |
| Web phone dial display (R5) | A 36-high filled display box with a 16/500 number instead of a 24 field (precedent: login field 36); 40 high in a call (name over number) (owner 2026-11-21) | `h-table-head` (36), `h-table-row` (40) |
| Web phone keypad (R6) | Filled tile keys 40 high (min), radius 10, pressed scale 0.96 (owner 2026-11-21) | `--phone-key-press: 0.96` |
| Web phone action buttons (R7) | Call, Hang up, Hold, Transfer, Add, Answer, Decline: 36 high, radius 10 (other buttons max 28); Transfer uses `bg-icon-violet text-on-icon` as a button fill, hover `bg-icon-violet-hover`, pressed `bg-icon-violet-pressed` (owner 2026-11-21) | 36 (`h-table-head`); `--icon-violet-hover` `#5a32aa` (pressed `#4c2a90`) in light, `#875edc` (pressed `#794dd3`, darker than the base so white text keeps 4.5:1; contrast fix 2026-11-21) in dark |
| Web phone audio rows (R8) | A volume slider with a live level meter (the design system has no slider): track 4, knob 12, fill `success` (owner 2026-11-21) | `h-status-bar` (4), `size-switch-knob` (12) |
| Web phone mode toggles (R9) | AA / DND as 28 toggle buttons (pressed = `brand`) instead of switches on the Phone tab; their help text is the `title` tooltip (switches with "!" hints stay in the Devices view for notifications) (owner 2026-11-21) | — |
| Web phone lists (R10) | Thin scrollbar utility: 6 wide, no arrow buttons, thumb `border-field`, track transparent (owner 2026-11-21) | `--scrollbar-w: 6px` (`scrollbar-thin`) |
| Web phone call-back button (R11) | Round (radius full) 24 solid `success` icon button in call log rows (owner 2026-11-21) | — |
| Web phone status dot (R12) | A 14 round status dot with a white 9 phone glyph, colour by state/quality, opening the quality tooltip (owner 2026-11-21) | `--phone-dot: 14px`, glyph 9 (`--icon-dot: 9px`) |
| Web phone, panel | A non-modal floating panel above the folded bar (one fixed column at `bottom-0 end-12`, gap 8); it does NOT close on an outside click (only the launcher, its collapse button or Escape); fixed body height so tabs and call states never resize it (owner 2026-11-21) | 330 wide (`w-phone-panel`), radius 12 |
| Web phone, layering | Folded bar and panel at `z-dropdown` (above record modals, so a call can be muted or ended while a modal is open); the incoming-call card at `z-toast`, 330 wide like the panel, with the gradient strip on its header (R3) and its buttons as R7 (owner 2026-11-21) | `--phone-popup-w: 330px` (`w-phone-popup`) |
| Web phone, Call and Answer buttons | A `success` button variant (`bg-success text-on-success`, hover `success-hover`, pressed `success-pressed`) used ONLY for Call and Answer in the web phone (owner 2026-11-21) | `--success-hover: #1aab69`, `--success-pressed: #179a5e` in light; `#3ccb88` (pressed `#58d49a`) in dark (`[data-theme="dark"]` block in `exceptions.css`) |
| Web phone, call quality | Quality shown in three levels as filled status badges: Good `success` (loss < 1 %), Fair `warning` (1–4 %), Poor `danger` (≥ 4 %); no continuous colour (owner 2026-11-21) | 1 % and 4 % packet loss |
| Web phone, errors | When the phone cannot work (not set up, server unreachable, offline, microphone blocked or missing, HTTPS required, browser unsupported, paused over the seat limit), a full state replaces the Phone tab body (tile 36, title, one line, one button); one-off failures are toasts (owner 2026-11-21) | |
| Staff user modal, Phone tab | Section headers "SIP account" (navy) and "Servers" (blue) are the 36 colourful bars approved for the lead modal (owner 2026-11-21) | 36 (`h-table-head`) |
| Staff user modal, height (`features/workspace/staff/users/user-modal`) | One fixed height for every tab (the screen height minus 2 x 32, divided by the view zoom) so switching tabs never resizes the modal; only the tab body scrolls. No existing modal height token fits a `wide` (580) modal (coordinator decision 2026-11-21) | `--modal-user-h` (`h-modal-user`) in `styles/exceptions.css` |
| Top nav, Workspace and Trade | Level-1 items are groups shown as plain links (no dropdown) that open the group's first page; the group's pages are in the level-2 bar; the active level-2 item is a filled blue button app-wide (owner 2026-11-21) | |
| App shell height under the View scale | The shell uses `h-app-screen` (`100dvh / --view-zoom`) so it fills the window at every zoom | `--view-zoom` set by the view-scale service |
| CRM tags | Tag chips use the user-chosen colours from the API, bound inline (data, not theme) | |
| Template designer (`features/workspace/templates/designer`) | No side panels: ribbon card, selection bar (36, `brand-soft`), canvas, status bar (28); every editor is a centred modal. Canvas in mm with rulers 16 thick (11 numerals); paper white in both themes; canvas DOM always LTR; node geometry, colours and font sizes bound inline from the document model (data, not theme); selection handles 8; snap guides `chart-7`; email column 600 / 320 (owner 2026-11-21, plan N1–N10) | `--ruler-size`, `--canvas-handle`, `--email-col-w`, `--email-col-w-sm`, `--template-paper` |
| Trade money, every Trade screen (owner principle 5, the same rule as critical rule 8 on every screen) | Money is stored at numeric(24,8) and shown rounded to 2 decimals, as a plain integer when the rounded fraction is zero: `EGP 12,500`, `EGP 12,500.50`. The ISO code stays before the number, LTR, Latin digits. Unit prices in line items keep their stored precision (unchanged). One formatter: `features/trade/shared/trade-format.ts` `formatMoney` / `formatUnitPrice` (owner 2026-11-21) | 2 decimals, integer when no fraction |
| Trade items, table rows and the compact product card (X1) | An item with an image shows a 32 thumbnail (radius 8, 1px `border`, `object-cover`) in place of the kind tile; the card shows it at 56. The image is the backend `thumb` rendition (owner 2026-11-21) | 32 table / 56 card (`size-item-thumb`, `size-item-thumb-lg`); `--size-item-thumb: 32px`, `--size-item-thumb-lg: 56px` in `exceptions.css` |
| Trade item full page (X2) | The header-card tabs are Overview / Company profile / Branch / Channels instead of the record-module Overview / Activities / Calls / Attachments / History; Company and Branch follow the top-bar scope (owner 2026-11-21) | |
| Trade items board | Four status columns Draft / Active / Inactive / Discontinued; Discontinued is collapsed by default and a drop into it asks for confirmation and a reason; columns the dragged card cannot enter are dimmed with the reason in their title (owner 2026-11-21) | |
| Trade categories, Chart view and tree rows (X3) | Category nodes use the org-chart card; the 6 band and the 24 tile take their colour by **depth**: level 1 `icon-navy`, 2 `icon-blue`, 3 `icon-teal`, 4 and deeper `icon-gray` (owner 2026-11-21) | |
| Trade dashboard grid (X4) | The backend layout is 12 columns with height units; it is drawn on the shared 48-column dashboard grid as x·4, w·4 and h·5 (one Trade height unit = 40 = five 8 rows) and converted back on save. The level-2 bar is hidden on the Trade dashboard (no pages) (owner 2026-11-21) | ×4 columns, ×5 rows |
| Trade configuration, version value editor (X5) | A value whose schema nests deeper than one object level is edited in a JSON textarea (monospace not used; normal field font), validated on the client against the schema subset before Test (owner 2026-11-21) | |
| Trade reasons (owner principle 2) | Every reason in Trade (categories, accounts, items, documents, inventory) is picked from the user-managed Trade reasons list (settings page in a new `trade/settings` group, next to Terms (Documents part)) through `app-trade-reason-picker`: Reason dropdown + Note (required when the reason says so, max 500 with counter) (owner 2026-11-21) | note 500 |
| Data tables (lead and CRM settings tables: lead-stages, opportunity-stages, pipelines, tags, general, static-data, lead-table, lead-attachments-tab) | Per-table proportional column tracks `grid-cols-[minmax(0,Nfr)...]`, mixed with `var(--table-head-h)`, `var(--select-col-w)` and `var(--time-dd-w)` (about 24 uses). No scale token expresses the proportions, so they differ per table | `--table-head-h: 36px`, `--select-col-w`, `--time-dd-w` |
| Trade foundation tables (definitions-table, definition-modal versions, channel-table, account-table) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-definition-row[-actions]`, `grid-cols-version-row[-actions]`, `grid-cols-channel-row-actions`, `grid-cols-account-row[-select][-actions]`; the actions column is `--table-head-h`, the selection column `--select-col-w`. No raw `grid-cols-[...]` in these files | `--definition-row-cols`, `--version-row-cols`, `--version-row-actions-cols`, `--channel-row-cols`, `--account-row-cols` in `exceptions.css` |
| Trade automation tables (`features/trade/automation/**`: webhooks deliveries-table, subscriptions-table; control-tower-page, exception-modal attempts, evidence-editor; extension-fields-table, extension-profile-page versions, extension-profiles-page; import-mapping-page versions, import-mappings-page, import-runs-page, import-wizard invalid rows, mapping-rows, run-results-table) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-delivery-row`, `grid-cols-subscription-row-actions`, `grid-cols-auto-tower-row[-select]`, `grid-cols-auto-tower-attempt-row`, `grid-cols-auto-evidence-row`, `grid-cols-auto-ext-field-row[-actions]`, `grid-cols-auto-ext-version-row-actions`, `grid-cols-auto-ext-profile-row-actions`, `grid-cols-auto-import-mapping-row-actions`, `grid-cols-auto-import-mapping-version-row`, `grid-cols-auto-import-mapping-field-row`, `grid-cols-auto-import-run-row-actions`, `grid-cols-auto-import-invalid-row`, `grid-cols-auto-import-result-row`; the actions column is `--table-head-h`, the selection column `--select-col-w`. Variants chosen by permission or read-only mode are class names returned by the component (`[class]`). No raw `grid-cols-[...]` and no inline `[style.grid-template-columns]` in these files (coordinator decision 2026-11-22) | `--delivery-row-cols`, `--subscription-row-cols`, `--auto-tower-row-cols`, `--auto-tower-attempt-row-cols`, `--auto-evidence-row-cols`, `--auto-ext-{field,profile,version}-row-cols`, `--auto-import-{mapping,mapping-version,mapping-field,run,invalid,result}-row-cols` in `exceptions.css` |
| Workspace branding (`features/workspace/settings/branding`) | Tenant primary and secondary colours bound inline (`[style.background-color]`, `[style.color]`), about 10 bindings in branding-colours-card and branding-preview-modal. Text on them uses `contrastInkFor()`. This is user data, the same idea as CRM tags, not theme | Inline, user data |
| Workspace Updates, admin-managed notice (`features/workspace/settings/updates`) | When `meta.adminManagedPending > 0` the page shows the existing `app-settings-notice` tone `info` above the table, saying how many updates the administrator will apply (plural forms in en and ar); the empty state never says "up to date" while such updates are pending. Reuse of the component Branding and Currencies use; no new style (WS-C-1, controller under owner authority 2026-11-22) | `app-settings-notice` `tone="info"` |
| CRM tags, preset palette (`tags/tag-colors.ts`, `tag-modal` defaults) | 30 fixed background and text pairs. A chosen preset is saved as the tag's own colour. Ink for a tag with only a background is `contrastInkFor()`. Dark-mode pastel chips are still open for the owner | 30 preset pairs |
| Card grids (`lead-cards.html`, `account-cards.html`) | Responsive card grid, not a data table: the named utility `grid-cols-kanban-cards` (`src/styles/utilities.css`), auto-fill with min `--kanban-col-min`. No raw `grid-cols-[...]` in these files | `--kanban-cards-cols` in `exceptions.css`, `--kanban-col-min: 280px` |
| Actions menu colour swatches (`actions-menu.html`) | Fixed 6-column colour swatch grid as the named utility `grid-cols-swatches` (`src/styles/utilities.css`) | `--swatch-grid-cols` in `exceptions.css`: 6 x `--badge-h` (20) |
| Older pattern utilities (`src/styles/utilities.css`, top of file) | `subnav-active`: accent underline (inset shadow) on the active subnav tab; `no-scrollbar`: hides the scrollbar, scrolling still works; `bg-nav-gradient`: top-nav gradient `--nav-start` to `--nav-end`; `drag-preview-frame` / `drag-preview`: padded, tilted, shadowed Kanban drag snapshot (with `opacity-drag-source` on the source card); `step-first` / `step-next`: chevron clip-paths for the first and following stepper steps; `auto-rows-phone-key`: web phone keypad rows, min `--table-row-h`; `writing-vertical-rl`: vertical text (collapsed column titles) | `--accent`, `--nav-start`, `--nav-end`, `--drag-tilt`, `--shadow-drag`, `--opacity-drag-source`, `--table-row-h` |
| Text on user colours (`--ink-on-light`, `--ink-on-dark` in `exceptions.css`) | Ink for text on a user-chosen colour (tags, branding). The contrast is against the user colour, so the ink must not flip with the theme: theme-fixed, no dark override | `--ink-on-light: #12141c`, `--ink-on-dark: #ffffff` |
| MFA code input (`features/workspace/account/security/mfa-modal`, one-time-code field only) | One-time-code digits use the named utility `tracking-otp` (`src/styles/utilities.css`) so each digit reads on its own; no `tracking-widest` or raw letter-spacing on these inputs (coordinator decision 2026-11-21) | `tracking-otp` (0.3em) |
| MFA modal (`features/workspace/account/security/mfa-modal`) | Security messages (sign-out warning, unavailable, throttle) render inline in the body as `app-settings-notice` or alert blocks, never as toasts, so the user sees them while entering the password or code (coordinator decision 2026-11-21) | Inline block |
| MFA modal, throttle notice | One persistent `role="status"` region: the static message is announced once, the countdown span is `aria-hidden` (no announcement per tick), and a screen-reader-only "you can try again" text sits at the end (coordinator decision 2026-11-21) | `role="status"`, countdown `aria-hidden` |
| Activities page, app list (`features/workspace/operations/activities/activities-page`, `availableApps`) | The app list is built from permission prefixes until a module-access source exists; marked `// TODO(Phase 5): use module-access source` in code (coordinator decision 2026-11-21) | Permission prefixes (temporary) |
| Trade reason picker (`features/trade/shared/pickers/reason-picker`, `app-trade-reason-picker`) in the Inventory reason dialog and reverse modal | The shared `showNote` input (default on) is set to `false` on the Inventory screens, so they show no Note field and run no note check (coordinator decision 2026-11-21) | `[showNote]="false"` |
| CRM outbound email HTML preview (`crm/settings/outbound-emails` compose-modal, email-detail-modal) | The HTML body preview iframe is a fixed 360 high via the named utility `h-email-body`; no inline `[style.height.px]` (2026-11-21) | `--size-email-body-h: 360px` (`h-email-body`) in `exceptions.css` |
| Template Design UI sizes (`features/workspace/templates/**`, except the range picker `library/date-range-field`) | The templates code uses its own `--tpl-*` size tokens instead of borrowing tokens named for other features (stat card, agenda, org chart, notifications, date presets, time list, line-items table, alert modal, kanban). Same values, so visuals are unchanged: selection-bar X/Y/W/H `w-tpl-frame-field` 84, rotation `w-tpl-rot-field` 74, node name `max-w-tpl-node-name` 108; labels `w-tpl-label` 108; search `min-w-tpl-search` 108; thumbnails and page diagram `h-tpl-preview` / `max-h-tpl-preview` 136; short lists `max-h-tpl-list-short` 136; modal scroll lists `max-h-tpl-list` 330; Overview aside `desktop:w-tpl-aside` 330 and its preview `h-tpl-aside-preview` 330; image tiles `h-tpl-image-tile` 84; usage filter `w-tpl-filter-field` 280; tooltips `max-w-tpl-tooltip` 280; skeletons `w-tpl-skeleton` 280, `w-tpl-skeleton-sm` 136, `w-tpl-skeleton-chip` 44; tables `min-w-tpl-table` 860; card grids `grid-cols-tpl-cards` (auto-fill, min `--tpl-card-min-w` 280); table and grid tracks as named utilities, never inline `grid-template-columns`: assets `grid-cols-tpl-asset-row` / `-actions`, assignments `grid-cols-tpl-assignment-row-actions`, functions `grid-cols-tpl-function-row-actions`, function modal versions `grid-cols-tpl-function-version-row` and usage `grid-cols-tpl-function-usage-row`, impact modal `grid-cols-tpl-function-impact-row`, library `grid-cols-tpl-library-row-actions`, publish summary `grid-cols-tpl-publish-summary`, recovery `grid-cols-tpl-recovery-row`, validation `grid-cols-tpl-validation-row` / `-validate`, versions `grid-cols-tpl-version-row-actions` (coordinator decision 2026-11-21) | `--tpl-frame-field-w`, `--tpl-rot-field-w`, `--tpl-node-name-max-w`, `--tpl-label-w`, `--tpl-search-min-w`, `--tpl-preview-h`, `--tpl-list-short-max-h`, `--tpl-list-max-h`, `--tpl-aside-w`, `--tpl-aside-preview-h`, `--tpl-image-tile-h`, `--tpl-filter-field-w`, `--tpl-tooltip-max-w`, `--tpl-skeleton-w`, `--tpl-skeleton-w-sm`, `--tpl-skeleton-chip-w`, `--tpl-table-min-w`, `--tpl-card-min-w`, `--tpl-card-grid-cols`, `--tpl-asset-row-cols`, `--tpl-assignment-row-cols`, `--tpl-function-row-cols`, `--tpl-function-version-row-cols`, `--tpl-function-usage-row-cols`, `--tpl-function-impact-row-cols`, `--tpl-library-row-cols`, `--tpl-publish-summary-cols`, `--tpl-recovery-row-cols`, `--tpl-validation-row-cols`, `--tpl-validation-row-validate-cols`, `--tpl-version-row-cols` in `exceptions.css`; `grid-cols-tpl-*` in `utilities.css` |
| Workspace billing and operations tables (`workspace/billing` invoices-page, invoice-lines, ledger-table, payments-table; `workspace/operations/activities` activities-list) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-billing-invoice-row-actions`, `grid-cols-billing-invoice-line`, `grid-cols-billing-ledger-row`, `grid-cols-billing-payment-row`, `grid-cols-ops-activity-row-actions`; the actions column is `--table-head-h`. No inline `[style.grid-template-columns]` in these files (coordinator decision 2026-11-21) | `--billing-invoice-row-cols`, `--billing-invoice-line-cols`, `--billing-ledger-row-cols`, `--billing-payment-row-cols`, `--ops-activity-row-cols` in `exceptions.css` |
| Workspace remaining tables (`workspace/billing/subscription` items-table, quote-view; `workspace/operations` application-activation, audit-log page and event-modal diff, party-directory page and party-people-tab; `workspace/settings/geography` countries, states, cities, districts, zones tabs; `workspace/settings/phone` phone-settings-page) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-billing-item-row`, `grid-cols-billing-quote-row`, `grid-cols-ops-activation-row`, `grid-cols-ops-audit-row`, `grid-cols-ops-audit-diff`, `grid-cols-ops-party-row-actions`, `grid-cols-ops-party-person-row[-actions]`, `grid-cols-geo-{country,state}-row-actions`, `grid-cols-geo-{city,district,zone}-row[-actions]`, `grid-cols-phone-server-row[-manage]`; the actions/drag column is `--table-head-h`. Variants chosen by permission are bound with `[class]` from the component. No inline `[style.grid-template-columns]` in these files (coordinator decision 2026-11-21) | `--billing-item-row-cols`, `--billing-quote-row-cols`, `--ops-activation-row-cols`, `--ops-audit-row-cols`, `--ops-audit-diff-cols`, `--ops-party-row-cols`, `--ops-party-person-row-cols`, `--geo-{country,state,city,district,zone}-row-cols`, `--phone-server-row-cols` in `exceptions.css` |
| Workspace staff/settings tables (`workspace/billing/seats` holders-modal, seat-migration-page; `workspace/operations/addon-seats` page; `workspace/settings` currencies, numbering, taxes pages and updates-table; `workspace/staff` branches, companies, departments, roles, teams, users pages and the user apps, roles, teams tabs) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-ws-holder-row`, `grid-cols-ws-migration-row[-owner]`, `grid-cols-ws-addon-{option,assignment}-row[-manage]`, `grid-cols-ws-currency-row[-actions]`, `grid-cols-ws-numbering-row-actions`, `grid-cols-ws-tax-row[-actions]`, `grid-cols-ws-update-row[-select]-actions`, `grid-cols-staff-{branch,company,department,role,team}-row-actions`, `grid-cols-staff-user-row-select-actions`, `grid-cols-staff-user-app-row[-actions]`, `grid-cols-staff-user-app-derived-row`, `grid-cols-staff-user-{branch,scope,team}-row[-actions]`; the actions column is `--table-head-h`, the select column `--select-col-w`. Variants chosen by permission or mode are bound with `[class]` from the component. No inline `[style.grid-template-columns]` in these files (coordinator decision 2026-11-21) | `--ws-holder-row-cols`, `--ws-migration-row-cols`, `--ws-addon-{option,assignment}-row[-manage]-cols`, `--ws-{currency,numbering,tax,update}-row-cols`, `--staff-{branch,company,department,role,team,user}-row-cols`, `--staff-user-app[-derived]-row-cols`, `--staff-user-{branch,scope,team}-row-cols` in `exceptions.css` |
| Trade tables, remaining (`features/trade/{documents,foundation,governance,inventory,settings}/**`: document-table, item-table, units-table, item channels-tab, company-defaults-modal, document-profiles-page, policy-studio-page, policy-test-modal, policy-tests, price-book-page, price-books-page, price-diff, price-lines-table, price-version-page, profile-cases, profile-content-editor, rule-condition, workflow-editor, workflow-tests, workflows-page; inventory availability, decisions, movements, nodes, periods, serials, uom-conversions pages; settings reasons, terms pages) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-trade-<name>` (e.g. `grid-cols-trade-doc-quotation-row`, `grid-cols-trade-item[-company]-row[-select]`, `grid-cols-trade-price-line-row[-edit][-cost]`, `grid-cols-trade-inv-node-row-actions`); a column that depends on permission, mode or results is a class name returned by the component (`[class]`). Still inline (truly dynamic, columns come from runtime config): `documents/document-lines` (visible line columns) and `governance-shared/governed-versions-table` (`columns` input). No other inline `grid-template-columns` in these folders (coordinator decision 2026-11-21) | `--trade-<name>-cols` (plus `--trade-price-line-cost-col`, `--trade-price-line-actions-col`) in `exceptions.css` |
| CRM settings and leads tables (`crm/settings` custom-fields, duplicates, lead-sources, outbound-emails, reasons, static-data) | Proportional column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-crm-custom-field-row-actions`, `grid-cols-crm-duplicate-row`, `grid-cols-crm-lead-source-row[-manage]`, `grid-cols-crm-outbound-email-row[-actions]`, `grid-cols-crm-reason-row[-actions]`, `grid-cols-crm-reason-outcome-row[-actions]`, `grid-cols-crm-static-data-row-actions`; permission-dependent columns bind the class name from the component (`gridColumnsClass`). No inline `[style.grid-template-columns]` in `crm/settings/**` or `crm/leads/**` (2026-11-21) | `--crm-*-row-cols` in `exceptions.css` |
| CRM customers, dashboard and reports; shared call-log, query-condition, record-attachments, actions-menu (`crm/customers/**` except customer-bulk, `crm/dashboard/**`, `crm/reports/**`, `shared/**`) | Column tracks as named utilities in `src/styles/utilities.css`: `grid-cols-kanban-cards` (customer cards, dashboards and widgets galleries), `grid-cols-qb-condition-row`, `grid-cols-call-log-{party,owner}-row[-actions]` (class from `callLogGridClass`, bound with `[class]`; layouts: type, party or owner, date, duration, optional actions), `grid-cols-record-attachment-row`, `grid-cols-swatches`. Still inline (columns from runtime config): `customers/customer-table` (user-chosen visible columns), `reports/report/records-tab` (report manifest widths), `shared/ui/data-table` (`columns` input). `customer-more` keeps its responsive `::ng-deep` override of the address grid in component styles (2026-11-21) | `--kanban-cards-cols`, `--qb-condition-row-cols`, `--call-log-{party,owner}-row-cols`, `--record-attachment-row-cols`, `--swatch-grid-cols` in `exceptions.css` |

### Language of UI text

- Every Arabic text in the UI (labels, hints, descriptions, buttons, messages, toasts) is Modern Standard Arabic (فصحى), never Egyptian or any other colloquial Arabic. Example: "هذا الحقل مطلوب", not "الحقل ده مطلوب".
- English text is plain sentence case.

### Every feature supports both languages and both themes

- Every feature ships with Arabic (RTL) and English (LTR) text for every string, and works in light and dark themes.
- No hard-coded UI text: every string comes from `public/i18n/<app>/ar.json` and `en.json`, and both files have the same keys.
- A feature is not done until it has been checked in all four combinations: Arabic light, Arabic dark, English light, English dark (Rule 4, Phase 4).
- A component-level `provideTranslocoScope` re-lists every scope of its route (same aliases) in the same call. Why: it replaces the route's scopes instead of adding to them, so keys silently show raw.
- A component that takes inputs or `<ng-content>` from a parent declares its scope in `viewProviders`, not `providers`; if it has `<ng-content>`, use `provideTranslocoScopeInherited(...)` from `core/i18n/transloco-scope.ts` there (embedded `@if`/`@for` views in projected content can still see `viewProviders`, so the scope must include the parent's). Why: `providers` also reach its host element and projected content, so the parent's `| transloco` pipes resolve against the wrong scope and stay raw keys. Check with `node Z:\mutakamel-memory\tenant-portal\scripts\transloco-scope-leak-scan.js src/app` (background: `Z:\mutakamel-memory\tenant-portal\memory\transloco-scope-shadowing.md`).
- To react to Transloco events in a component, use `translationEvents()` from `core/i18n/translation-events.ts`, never `toSignal(this.transloco.events$)` or a hand-written tick signal. Why: a scope that loads during render fires an event inside that render, and a direct signal write there throws NG0600; the helper defers the write. Check with `grep -rn "toSignal(this.transloco.events" src/app` (must be empty).

## Rule 3: file structure is fixed

Every agent must structure code exactly like this. Do not change this approach.

- Angular has no separate controller: the component class in its `.ts` file is the controller.
- File names have no type suffix: `lead-card.ts`, not `lead-card.component.ts`.
- Files that belong to one thing sit together in one folder with the same base name.
- Organize by feature (`features/crm/leads/`, `features/trade/documents/`), never by file type (no global `components/` or `services/` folder for feature code).
- One concept per file. Keep every component small with a single responsibility.

Per component:

| Part | File | Rule |
|---|---|---|
| Logic (inputs, signals, events) | `lead-card.ts` | Always its own file. |
| Template | `lead-card.html` | Always a separate file. Inline `template` only for a very small component of about 10 template lines or fewer (for example a badge or an icon wrapper). |
| Styles | `lead-card.css` | Normally none: styling is Tailwind classes built on the design-system tokens. Add a `.css` file only for what Tailwind cannot express, and use tokens only there too. |
| Server data | `leads.api.ts` | Always separate, and the only file in the feature that talks to the server. Components never call the API or `HttpClient` directly; data goes through `@tanstack/angular-query` in this file. |
| Types | `leads.model.ts` | The feature's types. |
| Shared logic | `leads.service.ts` | Only when logic is shared inside the feature. Always separate from components. |

### Top-level folders

```
src/
  styles/            tokens.css (from design-system/tokens.css), theme.css (Tailwind lock), fonts
  app/
    core/            app-wide singletons, no screens
    shared/
      ui/            design-system components
      widgets/       business blocks used by more than one app
      bulk-jobs/     bulk job logic used by more than one app
      query-builder/ advanced search builder logic
    layout/          the frame around every page
    features/        the business: one folder per app
    app.ts  app.html  app.config.ts  app.routes.ts
```

| Folder | Holds | May import |
|---|---|---|
| `core/` | auth (session, permissions, guards), geo, i18n, notify (toast and confirm state), phone, scope, tabs, theme, view | nothing in the app |
| `shared/ui/` | Design-system components (button, field, modal, table, kanban, charts, settings-frame...), one folder per component. Never calls the API. | `core/` |
| `shared/widgets/` | Business blocks used by more than one app: attachments, history, comments, import, dashboard | `core/`, `shared/ui/` |
| `shared/bulk-jobs/`, `shared/query-builder/` | Logic blocks used by more than one app | `core/`, `shared/ui/` |
| `layout/` | Top bar, app switcher, scope switcher, notifications, user menu, error pages | `core/`, `shared/` |
| `features/` | The apps: `auth`, `workspace`, `crm`, `trade`, `accounting` | `core/`, `shared/` |

Three structure rules:

1. Imports go down the table above, never up.
2. A feature never imports another feature. Anything two features or apps need goes to `shared/widgets/`.
3. One concept, one folder, one name.

### The apps and their features

```
features/
  auth/          login, verify, invitation, reset-password
  workspace/     home, organization, users, roles, contacts, templates, notifications, audit-log, billing, profile, settings
  crm/           dashboard, leads, customers, opportunities, activities, reports, settings
  trade/         shared, foundation, dashboard, documents, inventory, governance, automation, settings
  accounting/    dashboard, journal, accounts, receivables, payables, banking, assets, tax, closing, reports, settings
```

- Each app's setup screens live as sub-folders of its `settings/` (for example `crm/settings/pipelines`, `crm/settings/tags`). The app's first level holds only the screens people use every day.
- Do not add a new app or a new first-level feature without the product owner's approval.

### One feature

```
features/crm/leads/
  leads.routes.ts      /crm/leads and /crm/leads/:id
  leads.api.ts         TanStack Query: list, get, create, update, delete
  leads.model.ts       types
  leads-page/          leads-page.ts  leads-page.html     list with board, cards, table
  lead-card/           lead-card.ts   lead-card.html
  lead-dialog/         lead-dialog.ts lead-dialog.html   view-is-edit modal
```

### Routing

- `app.routes.ts` lists `auth` and one `layout` route. Under the layout route it has flat per-feature lines (for example `crm/leads`, `crm/settings`, `workspace/staff`), not one line per app. It changes only when a feature or an app is added.
- Each app owns `<app>.routes.ts` and `<app>.menu.ts`. Each feature owns `<feature>.routes.ts` and is lazy-loaded.
- Guards: `authGuard` on the layout route, `accessGuard` (permission or subscription) on each route.
- URLs are `/<app>/<feature>`: `/crm/leads`, `/trade/documents/quotations/42`, `/crm/settings/pipelines`.
- `/<app>/<feature>/:id` opens the record dialog over the list, so every record has a link.
- Documents with line items (quotations, orders, invoices) are full pages: `/trade/documents/quotations/:id`.

### Naming

- Folders and files are kebab-case. Plural for lists (`leads`), singular for one thing (`lead-dialog`).
- Components have no suffix. The only suffixes are `.routes.ts`, `.api.ts`, `.model.ts`, `.menu.ts` and `.service.ts`.
- Use the simplest clear business name (`customers`, `items`, `quotations`, `price-books`, `contacts`).
- Translations: `public/i18n/<app>/ar.json` and `en.json`.

## Rule 4: every feature is built in six phases, in order

Build every feature through these six phases, one after another. Do not skip a phase, merge phases, or start a phase before the previous one is finished. Rules 2 and 3 apply in every phase.

### Phase 1: study the feature, the API and the DTOs

- Read the feature's backend contract: endpoints, request and response DTOs, enums, validation rules, permissions, errors and realtime events.
- Write down every screen, field, action and state the feature needs, with the API field each one comes from.
- Done when every field and action on the screen is traced to an API field or endpoint, and every gap is listed as a question for the product owner.

### Phase 2: UI/UX design and the simplest code shape

- Design the screens from the design system only (Rule 2): which shared components, which views (board, cards, table), which modal or page, which states (loading, empty, error, read-only).
- Decide the simplest code shape before writing code: the fewest files, components and lines that do the job. Reuse `shared/ui` and `shared/widgets` before writing anything new.
- Code must be simple and readable by a person without comments: clear names, small functions, no clever tricks, no dead code, no duplicate code, no unused options "for later". Less code, more power. Comment only the "why" that the code cannot say.
- Done when the screen list, the component list and the file list are fixed.

### Phase 3: build the feature with fake data

- Implement the screens and interactions with fake data that has the exact shape of the API DTOs from Phase 1.
- Keep the fake data in one place inside the feature (for example `leads.fake.ts`), behind the same functions `leads.api.ts` will expose, so Phase 5 replaces the data source without touching the components.
- Fakes follow the backend code, not the docs: routes, DTO names, error codes and status, list shapes (cursor pages are `{items, nextCursor}`). Why: Phase 5 then swaps the source without touching components.
- Fake error `details` hold string arrays only (lowercase snake_case values), for example `{max: ['10000']}`, `{moduleKey: ['crm'], needed: ['3']}`. Why: the backend's shared error filter drops every other value, so nothing else ever reaches the client.
- When the backend has no endpoint for a call, keep the fake, mark it `FAKE-ONLY, no backend route`, and report it. Why: it must stay visible as a backend gap, not pass as linked.
- Done when every screen, view and state from Phase 2 works with fake data.

### Phase 4: check the design system with a browser

- Run the app and inspect every screen with Playwright or another browser MCP in all four combinations: Arabic light, Arabic dark, English light, English dark.
- Measure computed values against the design system: sizes, spacing, radius, font family, font size and weight, colors, borders, shadows, z-index (stacking), icons, focus ring, and the keyboard tab order.
- Fix every difference. The design system wins; never change a design-system value to match the code.
- Done when every checked value equals its design-system token, in both directions and both themes.

### Phase 5: study every API case, then plan and link the API

- List every API case for each endpoint: success, validation error (400), not found (404), permission (403), conflict (409), session expired (401), server error (5xx), lost connection, empty result, large result, and the realtime updates.
- For each case, decide what the user sees, following the design system's error rules (field message, toast, error page or 409 modal).
- Write the plan first, then replace the fake data source in `<feature>.api.ts` with the real API through `@tanstack/angular-query`. Delete the fake data file when the real API is linked.
- Every write call sends `x-idempotency-key` from `newIdempotencyKey()` (`core/api/idempotency.ts`, UUID v7): a new key per user action, the same key on retry (hold `{key, bodyJson}`). Never remove it because the app service ignores it. Why: the API gateway enforces it on WRITE_SENSITIVE routes (`api-gateway-app` `gateway-idempotency.service.ts`, route rows in `routing-proxy/route-contracts`).
- Gateway errors carry `code` and `errors` with codes `GW.IDEM.MISSING`, `GW.IDEM.BAD_VALUE`, `GW.IDEM.IN_FLIGHT`, `GW.IDEM.MISMATCH`; service errors carry `errorCode` and `details`; `correlationId` is always top-level; 5xx carry no details. Why: these are the codes actually sent (`IDEM_MISSING` etc. are only catalogue keys).
- Validation errors are 400 `CORE_VALIDATION_FAILED`, `CRM_VALIDATION_FAILED`, `TRADE.VALIDATION_FAILED` or `COMMON.GENERIC.VALIDATION_FAILED`, with `details` keyed by field path (lists of messages, `_` for non-field messages). Read them only through `core/api/api-errors.ts` (`ApiError.fromResponse`, `isValidationError`, `fieldErrorsOf`, `correlationIdOf`). Why: one parser keeps every app's errors on the same field messages.
- Done when every listed case behaves as planned against the real API.

### Phase 6: build and unit test

- Run the production build (`ng build`) and the unit tests (`ng test`) when everything else is done.
- Write unit tests for the feature's logic and for every API case from Phase 5.
- Run specs with `npx ng test --watch=false --include='<glob>'`, never plain `npx vitest run`. Why: only the Angular unit-test builder sets up the DOM and JIT that component specs need.
- Also run `npx tsc -p tsconfig.spec.json --noEmit`, and `npx ng build --configuration development` before reporting UI work done. Why: specs are excluded from `tsconfig.app.json`, and `tsc` does not check templates.
- Done when the build has no errors or warnings and every test passes. Report the build and test output as evidence.

## TypeScript

- Use strict type checking.
- Prefer type inference when the type is obvious.
- Avoid the `any` type; use `unknown` when the type is uncertain.

## Angular

- Always use standalone components over NgModules.
- Do NOT set `standalone: true` inside Angular decorators. It is the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- The app is zoneless. Do not add `zone.js`.
- Use signals for state management.
- Implement lazy loading for feature routes.
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead.
- Use `NgOptimizedImage` for all static images. It does not work for inline base64 images.

## Accessibility

- Follow `07-platform.md` "Accessibility approach": hint text linked with `aria-describedby`, full keyboard operation, visible focus with the focus tokens, status as text next to color, `prefers-reduced-motion` respected.
- Pass AXE checks and WCAG AA wherever this does not change an approved size or color. Where it would, the design system wins (Rule 2).

## Components

- Keep components small and focused on a single responsibility.
- Use `input()` and `output()` functions instead of decorators.
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`.
- Use `computed()` for derived state.
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized.
- Templates go in a separate `.html` file; inline only for very small components (see Rule 3).
- Use Signal Forms (`@angular/forms/signals`) for forms. When not using Signal Forms, use Reactive forms, never template-driven ones.
- Do NOT use `ngClass`; use `class` bindings instead.
- Do NOT use `ngStyle`; use `style` bindings instead.
- Do NOT import `CommonModule`; import only the directives and pipes the template uses.
- When using external templates or styles, use paths relative to the component TS file.

## State management

- Use signals for local component state.
- Use `computed()` for derived state.
- Keep state transformations pure and predictable.
- Do NOT use `mutate` on signals; use `update` or `set` instead.
- Server state goes through `@tanstack/angular-query` only (see `06-libraries.md`).

## Templates

- Keep templates simple and avoid complex logic.
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
- Use the async pipe to handle observables.
- Do not assume globals like `new Date()` are available.

## Services

- Design services around a single responsibility.
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+).
- Use the `inject()` function instead of constructor injection.
