# Data Experiences

Status: **[Shared source migration complete; runtime matrix pending]**

Design approval: **2026-08-29**

Current-source audit: **2026-08-29**

Owner: **Admin Portal**

## Purpose

This contract covers filters, tables, selection, pagination, charts, and other
high-density data surfaces. It supplements [Operational UX](operational-ux.md)
and the component specifications under `docs/components/`.

The shared FilterBar, DataTable, pagination, status, and chart patterns are in
source, and feature routes no longer contain hand-built tables. This status is
source evidence; it does not certify every table strategy at real viewports or
every interactive path with keyboard and assistive technology.

## FilterBar contract

Every filter field provides a persistent localized label. A placeholder may
offer an example, but it is never the only accessible or visible name.

Required field metadata:

- stable key;
- control type;
- English and Arabic label;
- optional English and Arabic hint or example;
- default value;
- URL serialization behavior;
- options or remote-option source;
- validation and dependency rules.

Implemented metadata supports typed defaults, explicit serialization modes,
localized validation and dependency reasons, and named date-range labels. The
runtime compatibility layer preserves existing feature call sites while those
features adopt richer metadata incrementally.

Behavior:

- Search may debounce remote requests by 250–400ms; local filtering is immediate.
- Enter submits or applies a search when the interaction has an explicit apply
  model.
- Date ranges expose separately named From and To controls within a named group.
- Active filters render removable chips with keyboard-focusable remove actions.
- Reset returns documented defaults, updates the URL, and announces the result.
- Query parameters are shareable and survive refresh/back navigation.
- Loading does not disable unrelated local filter editing.

## DataTable contract

### Structure and hierarchy

- Use one table surface, not a Card containing another card-based DataTable.
- Table headers use the muted cold-blue surface and 13px or larger text when
  Arabic content is possible.
- Body text is regular weight by default. One primary identifier may use medium
  or semibold emphasis.
- Numeric values use logical end alignment and tabular numerals where suitable.
- Status is rendered through the shared `StatusBadge` mapping.

Tenant status now uses the shared `StatusBadge`; the former local status-color
mapping has been removed.

### Sorting

- A sortable header contains a real button.
- The button is keyboard focusable and exposes current sort through `aria-sort`
  on the header.
- Activation cycles only through documented states.
- Sort changes preserve focus and announce the new order.

### Loading and refresh

- Initial loading may use skeleton rows with reserved dimensions.
- Background refresh keeps existing rows and pagination mounted. It reconciles
  selected identities and action eligibility, preserving valid selections and
  announcing any records that were dropped.
- The table region exposes `aria-busy` and one concise live status.
- Refresh completion announces the new result count only when it materially
  changes.
- Pagination controls never disappear while they hold keyboard focus.

### Selection and actions

- Row selection uses a labelled checkbox and a visually distinct selected state.
- The header selection control communicates checked, unchecked, and mixed state.
- Selected state is not color-only.
- Bulk selection follows [Operational UX](operational-ux.md#bulk-selection-and-actions)
  and is exposed only where an authoritative domain contract supports it.
- A row shows at most one frequent direct action. Secondary and destructive
  actions use a labelled overflow menu.

### Responsive behavior

Choose one documented strategy per table:

1. **Priority columns:** hide noncritical columns with details available from
   row expansion or a detail route.
2. **Named horizontal scroll:** retain the table, make the region focusable,
   label it, and provide a visible overflow affordance.
3. **Record cards:** use only when row-to-column comparison is not essential.

Do not silently transform financial, audit, or operational comparison tables
into cards when the column relationship carries meaning.

## Empty and error states

- First-use empty explains what belongs in the collection and offers one valid
  next action.
- Filtered empty preserves the controls and offers clear/reset.
- Forbidden is a permission state, not empty.
- Load failure keeps filters and safe prior data where possible and offers retry.
- Partial/degraded data stays visible with a persistent qualifier.

## Charts

### Encoding

- Status charts use semantic success/warn/danger/neutral roles.
- Unrelated categories use a separately validated qualitative palette; do not
  cycle status colors or generate arbitrary hues.
- Adjacent series must be distinguishable under common color-vision deficiencies.
- Color is paired with direct labels, legend symbols, patterns, or exact values.

### Access

Every chart provides:

- a localized title and concise summary;
- a visible legend or direct labels;
- exact values available without hover;
- a keyboard/touch-capable interaction when the chart is interactive;
- a text or table alternative using the same filtered data;
- explicit locale, currency, unit, and timezone formatting.

Decorative SVG nodes are hidden from assistive technology. The accessible
summary or data table is the primary nonvisual representation.

### Readability and motion

- Axis ticks are at least 13px in both languages.
- RTL-aware layouts mirror logical axis/legend placement without reversing
  chronological data meaning.
- Mobile charts reduce series or labels before shrinking text.
- Recharts animation follows `prefers-reduced-motion` and renders its final state
  immediately when motion is reduced.
- Below-fold charts load lazily with reserved height to prevent layout shift.

Dashboard chart groups now use viewport-triggered loading with reserved
responsive dimensions, localized busy states, a safe observer fallback, and a
reduced-motion final state. A source guard checks light/dark palette contrast
and OKLab separation. That guard is not a substitute for browser-composited or
color-vision-deficiency runtime validation.

The dashboard's explicit Print/PDF action preloads the two chart modules, then
waits for every chart card to have a nonzero layout across two animation frames
before opening print. Native Ctrl+P/browser-menu printing cannot defer the
browser's print lifecycle for asynchronous chart measurement, so it
synchronously exposes an always-mounted, complete exact-value representation
and hides any lazy placeholders. This deterministic table fallback preserves
all source rows but intentionally favors printable evidence over chart graphics
when native printing starts before the charts are ready.
If an explicit export cannot preload the chart modules or they do not become
layout-ready within five seconds, it uses the same exact-value representation,
re-enables export immediately, and announces that chart graphics were omitted
with an option to retry.

## Performance expectations

- Paginated server data remains the default for large directories.
- Virtualization is introduced only when row volume and measurement show a need;
  it must preserve table semantics and keyboard behavior.
- Remote search, sorting, and filtering cancel obsolete requests.
- The newest response may not overwrite newer filter or route state.
- Charts and large optional detail panels remain route- or viewport-split.

## Acceptance criteria

Source and unit gates for the shared patterns are complete. Full real-viewport
responsive-table evidence, keyboard completion, CVD runtime review, and
authenticated refresh behavior remain conformance gates.

- Filters retain visible names after values are entered.
- Sort, selection, pagination, and row actions are keyboard complete.
- Background refresh preserves focus and data.
- Every responsive table strategy is documented and tested.
- Every chart has a legend/direct labels and a localized nonvisual alternative.
- No chart relies on raw component-level hex values.
