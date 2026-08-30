# Integration 1B — input primitives

Written: **2026-08-30** · Owner: **Phase 1 input-primitives agent** ·
Status: **awaiting merge**

Covers MASTER-PLAN tasks **1.1, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9, 1.10, 1.11
(primitive only), 1.12, 1.13, 1.14, 1.15, 1.16, 1.39, 1.40 (date-picker half),
1.42 (resolved, not deferred), 1.44, 1.47, 1.50**.

Sixteen primitives are built, tested and gate-clean. Three files they need in
order to be reachable are owned by another agent and were deliberately **not**
touched:

- `src/design-system/index.ts` — the barrel
- `src/i18n/dictionaries/ar.ts` and `src/i18n/dictionaries/en.ts`

This page is the exact paste list for merging both in one pass. It is the
companion to [INTEGRATION-1A.md](INTEGRATION-1A.md), which covers the state
components; the two batches do not collide on any name or any key.

---

## 1. Barrel export lines

Add to `src/design-system/index.ts`, inside the existing primitives block.
The list below keeps that block alphabetical, so each line slots in beside its
neighbours rather than appending at the end.

```ts
export * from "./primitives/Accordion";
export * from "./primitives/Calendar";
export * from "./primitives/Collapsible";
export * from "./primitives/Combobox";
export * from "./primitives/ContextMenu";
export * from "./primitives/CopyButton";
export * from "./primitives/DatePicker";
export * from "./primitives/DateRangePicker";
export * from "./primitives/DateTime";
export * from "./primitives/HoverCard";
export * from "./primitives/Money";
export * from "./primitives/MultiSelect";
export * from "./primitives/Progress";
export * from "./primitives/Slider";
export * from "./primitives/Stepper";
export * from "./primitives/ToggleGroup";
```

`Textarea` and `Input` are already exported and gained props in place — no new
line, no call-site change.

What each line brings in, so a name collision is visible before the merge:

| Line | Exports |
| --- | --- |
| `Accordion` | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| `Calendar` | `Calendar`, `CalendarProps` |
| `Collapsible` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |
| `Combobox` | `Combobox`, `ComboboxProps`, `ComboboxOption` |
| `ContextMenu` | `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioItem`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuGroup`, `ContextMenuPortal`, `ContextMenuSub`, `ContextMenuRadioGroup` |
| `CopyButton` | `CopyButton`, `CopyButtonProps` |
| `DatePicker` | `DatePicker`, `DatePickerProps` |
| `DateRangePicker` | `DateRangePicker`, `DateRangePickerProps`, `DateRangeValue`, `DateRangePresetLabels`, `DateRangePresetId`, `DATE_RANGE_PRESET_IDS`, `resolveDateRangePreset` |
| `DateTime` | `DateTime`, `DateTimeProps`, `DateTimePrecision`, `DATE_TIME_OPTIONS` |
| `HoverCard` | `HoverCard`, `HoverCardTrigger`, `HoverCardContent` |
| `Money` | `Money`, `MoneyProps` |
| `MultiSelect` | `MultiSelect`, `MultiSelectProps` |
| `Progress` | `Progress`, `ProgressProps` |
| `Slider` | `Slider`, `SliderProps` |
| `Stepper` | `Stepper`, `StepperProps`, `StepperStep`, `StepState` |
| `ToggleGroup` | `ToggleGroup`, `ToggleGroupItem`, `ToggleGroupProps` |

`export * from "./lib/variants"` already exists and now also carries
`textEntrySize` and `readOnlySurface`.

### `knip` is red until this merge lands, for the reason MASTER-PLAN predicted

Nothing imports the new primitive files yet, because the barrel is knip's
entry point and feature code has no other legal import path. `pnpm knip`
therefore reports six `ContextMenu*` re-exports and the `StepState` type as
unused. Adding the lines above clears all of them.

MASTER-PLAN's Phase 1 gate already says so: *"`knip` is not a meaningful gate
for this phase — `src/design-system/index.ts` is a knip entry point, so every
new barrel export is invisible to it by construction."*

`typecheck`, `lint`, `test`, `design:rtl`, `design:census --check`,
`design:contrast` and `build` are green on all of it.

---

## 2. Dictionary keys

Add to `ar.ts` first — it defines the `Dictionary` type that `en.ts` is checked
against. Arabic strings below are proposals: correct in meaning and register,
and the dictionary owner should still read them.

Every one of these is passed **into** a component as a prop. **No primitive in
this batch imports `useI18n`** — a generic primitive takes strings, it does not
look them up.

### `controls` — the shared input labels (1.3, 1.4, 1.5, 1.6, 1.14)

```ts
controls: {
  pickDate: "اختر تاريخًا",
  anyDate: "أي تاريخ",
  clearDate: "مسح التاريخ",
  select: "اختر",
  searchOptions: "ابحث…",
  loadingOptions: "جارٍ التحميل…",
  noOptions: "لا توجد نتائج",
  clear: "مسح",
  clearAll: "مسح الكل",
  remove: "إزالة {label}",
  more: "+{count}",
  moreSelected: "قيم أخرى محددة",
  copy: "نسخ",
  copied: "تم النسخ",
  copyFailed: "تعذّر النسخ"
},
```

```ts
controls: {
  pickDate: "Pick a date",
  anyDate: "Any date",
  clearDate: "Clear date",
  select: "Select",
  searchOptions: "Search…",
  loadingOptions: "Loading…",
  noOptions: "No results",
  clear: "Clear",
  clearAll: "Clear all",
  remove: "Remove {label}",
  more: "+{count}",
  moreSelected: "Other selected values",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Could not copy"
},
```

`remove` and `more` carry `{label}` / `{count}` placeholders and go through
`formatTemplate` from `@/lib/format/template` — `MultiSelect` does that
internally, so a caller passes the raw template.

`copy` / `copied` / `copyFailed` are the generic fallbacks. A screen copying a
correlation ID should pass a **specific** name instead — an icon-only button
labelled "Copy" three times on one screen is three identically-named controls
to a screen-reader user.

### `dateRange` — the six presets (1.4)

The keys match `DateRangePresetLabels` exactly, so a screen can pass
`t.dateRange` straight through with no adapter.

```ts
dateRange: {
  today: "اليوم",
  last7Days: "آخر 7 أيام",
  last30Days: "آخر 30 يومًا",
  last90Days: "آخر 90 يومًا",
  thisMonth: "هذا الشهر",
  thisQuarter: "هذا الربع"
},
```

```ts
dateRange: {
  today: "Today",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
  thisMonth: "This month",
  thisQuarter: "This quarter"
},
```

Latin digits in the Arabic strings are deliberate and match
[typography.md](../design/typography.md#the-digit-decision--settled).

### `progress` — task 1.9

`Progress` requires a `label`; a progressbar with no accessible name announces
a bare number.

```ts
progress: {
  loading: "جارٍ التنفيذ",
  uploading: "جارٍ الرفع",
  processed: "تمت معالجة {done} من {total}"
},
```

```ts
progress: {
  loading: "Working",
  uploading: "Uploading",
  processed: "{done} of {total} processed"
},
```

`processed` feeds `valueText`. Both numbers must be formatted through `Intl`
with an explicit locale by the caller before `formatTemplate` fills them in.

### No `stepper`, `slider`, `accordion` or `hoverCard` block

Those four take every string from the screen that mounts them — a step's label
is the step's name, and a slider thumb's label is what it measures. There is no
generic wording to add.

---

## 3. Documentation still to update

`docs/design/primitives.md` says `Combobox`, `DatePicker` and `FileUpload` are
"Not built" and that the count is 21. Sixteen of the seventeen listed here are
new files, so both statements are now wrong. The doc is not in this batch's
scope and is listed here so it is not missed:

- The "The 21" table gains sixteen rows and becomes "The 37".
- The `Select` section's *"For >20 options with search, that is a `Combobox` —
  **which does not exist yet**"* is now false.
- The "Not built" section keeps `FileUpload` only (task 1.7).
- `Textarea`'s row gains `controlSize`-matched `size`.

`docs/design/motion.md` needs the carve-out recorded in
[§4](#4-decisions-taken-inside-this-batch) below — MASTER-PLAN task 1.42 owns
that edit.

---

## 4. Decisions taken inside this batch

Recorded here rather than in `DECISIONS.md` because each is local to a
component, reversible in one file, and none contradicts an owner decision.

| # | Decision | Where |
| --- | --- | --- |
| 1 | `react-day-picker` is styled **entirely** through its `classNames` prop. Its stylesheet is never imported. | `Calendar.tsx` |
| 2 | `Accordion` and `Collapsible` do **not** animate their height, in any form. | `Accordion.tsx`, `Collapsible.tsx` |
| 3 | `Progress`'s indeterminate state animates **opacity only** and falls back to a solid bar under `prefers-reduced-motion`. | `Progress.tsx` |
| 4 | Dates format from **explicit `Intl` fields**, not `dateStyle: "medium"`. | `DateTime.tsx`, re-used by both pickers |
| 5 | A `readOnly` control keeps its `focus-visible` ring. | `lib/variants.ts` |
| 6 | `Stepper`'s **current** step takes solid ink contrast, not a hue. | `Stepper.tsx` |

Each is argued in a comment at the site, so the reasoning travels with the
code rather than only with this page.

---

## 5. Dependencies added

Nine packages, added to `tenant-portal/package.json`:

```text
react-day-picker@^10.0.1   date-fns@^4.4.0
@radix-ui/react-accordion@^1.2.20      @radix-ui/react-collapsible@^1.1.20
@radix-ui/react-toggle-group@^1.1.19   @radix-ui/react-progress@^1.1.16
@radix-ui/react-hover-card@^1.1.23     @radix-ui/react-context-menu@^2.3.7
@radix-ui/react-slider@^1.4.7
```

**`tenant-portal` has no lockfile of its own** — MASTER-PLAN task 1.50. The
install wrote `frontend/pnpm-lock.yaml`, which is shared with `admin-portal`
and `partner-portal`, so this change reaches two other products even though
neither imports any of it. Both should re-install before their next build.

Not installed here, and still open in task 1.1: `cmdk` (1.22), `recharts`
(1.23/1.38), `@tanstack/react-virtual` (1.46/1.49).
