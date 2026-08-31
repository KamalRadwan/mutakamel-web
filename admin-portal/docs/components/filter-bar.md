# Component Specification: `FilterBar`

Status: **[Implemented]**

Last source verification: **2026-08-29**

## Purpose

`FilterBar` provides shared search, enum/status, date-range, boolean, and reset
controls above data surfaces. It owns filter interaction and stable URL
serialization; it does not own domain permission or API semantics.

## Metadata contract

Every field declares a stable `key`, a discriminated control `type`, localized
labels, an optional localized hint/example, a typed default, a query contract,
and any validation or dependency rules that apply.

The exported field union is:

```typescript
type FilterField =
  | SearchFilterField
  | SelectFilterField
  | DateRangeFilterField
  | BooleanFilterField;
```

All field variants share this metadata:

```typescript
interface SharedFilterMetadata<TValue> {
  key: string;
  labelEn?: string;
  labelAr?: string;
  hintEn?: string;
  hintAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  defaultValue?: TValue;
  validation?: readonly FilterValidationRule<TValue>[];
  dependencies?: readonly FilterDependencyRule[];
  dependencyMode?: "all" | "any";
  disabled?: boolean;
  disabledReasonEn?: string;
  disabledReasonAr?: string;
}
```

`labelEn` and `labelAr` remain optional only for source compatibility with
legacy call sites. New and migrated consumers provide both. The component
always renders a visible fallback label; a placeholder never becomes the only
programmatic name.

### URL serialization

Scalar fields document `query.key`; date ranges document `query.fromKey` and
`query.toKey`. Missing keys fall back to the stable field key (`key`,
`keyFrom`, and `keyTo`). `query.serialization` is one of:

| Mode | Behavior |
| --- | --- |
| `omit-empty` | Default and backward-compatible. Empty values are omitted; non-empty defaults remain explicit. |
| `omit-default` | Values equal to `defaultValue` are omitted. URL reads restore that documented default. |
| `always` | The scalar key, or both range endpoint keys, are always present. |

Serialization preserves unrelated query parameters. Refresh, browser Back, and
shared URLs remain authoritative for filter state. Date ranges never serialize
as a generic object string.

### Validation

Validation rules are localized discriminated unions: `required`, `min-length`,
`max-length`, `pattern`, `date-order`, or `custom`. The first failing rule is
shown inline. The affected control receives `aria-invalid="true"` and references
the error through `aria-describedby`. A date-range failure is associated with
the named group and both endpoint controls.

`custom` validation receives the field value plus a read-only context containing
the stable field key and current filter values. Domain/server validation remains
authoritative; the shared rule is for immediate deterministic filter feedback.

### Dependencies and disabled state

Dependency rules describe when a field is enabled. Supported operators are
`present`, `empty`, `equals`, `not-equals`, `one-of`, `not-one-of`, and `custom`.
All rules must pass by default; `dependencyMode: "any"` enables the field when
one rule passes.

An unmet dependency disables the control and renders its localized reason next
to the field. The reason is referenced through `aria-describedby`; it is not a
hover-only tooltip or a color-only state. A directly disabled field uses its
localized `disabledReasonEn`/`disabledReasonAr`, with a safe fallback while
legacy metadata migrates.

### Date ranges

`DateRangeFilterField` accepts explicit `groupLabelEn`/`groupLabelAr`,
`fromLabelEn`/`fromLabelAr`, and `toLabelEn`/`toLabelAr`. The group is a real
`fieldset`/`legend`; both native date controls retain separate persistent
labels. Group and endpoint labels fall back to the localized field and shared
From/To copy for backward compatibility.

## Component props

```typescript
interface FilterBarProps {
  labelEn?: string;
  labelAr?: string;
  fields: FilterField[];
  values: Record<string, unknown>;
  onChange: (newValues: Record<string, unknown>) => void;
  onReset?: () => void;
  ariaControls?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
}
```

## Interaction rules

- Every control keeps a persistent visible English/Arabic label after entry.
- Search debounces remote requests by 300ms by default; `debounceMs: 0` keeps
  local filtering immediate.
- Active filters render removable chips with localized removal names and shared
  focus/hit-area behavior.
- Reset restores each documented default, clears pending search timers, updates
  the URL using the selected serialization mode, calls `onReset` so the consumer
  can reset pagination, and announces “Filters reset to defaults.”
- Chip removal and reset share one polite live status. Repeated actions replace
  the status child so the same result can be announced again.
- Initial loading may disable controls with a visible reason. Background refresh
  keeps them usable and exposes `aria-busy` on the named filter region.
- At narrow widths, controls and date endpoints stack in reading order without
  hiding labels, reasons, errors, chips, or the reset action.

## Result relationship

The FilterBar labels the data it affects or references the result region with
`aria-controls`. Refresh and result-count announcements belong to the data
surface, not to every individual filter.

## Focused verification

`src/design-system/patterns/filter-bar/FilterBar.test.tsx` covers persistent
labels, explicit date-group and endpoint names, background-refresh editing,
debounced search, removable-chip names and announcements, validation
associations, dependency reasons, reset/default behavior, and shareable URL
round trips.
