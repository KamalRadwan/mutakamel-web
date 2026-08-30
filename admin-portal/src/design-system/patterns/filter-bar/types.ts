export interface FilterOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

export type FilterQuerySerialization = "omit-empty" | "omit-default" | "always";

/**
 * Query keys are explicit so every filter has a stable, shareable URL shape.
 * `omit-empty` preserves the legacy behavior. `omit-default` keeps reset URLs
 * compact while readFilterParams restores the documented default.
 */
export interface FilterQueryContract {
  key?: string;
  fromKey?: string;
  toKey?: string;
  serialization?: FilterQuerySerialization;
}

export interface FilterDateRangeValue {
  from?: string;
  to?: string;
}

interface LocalizedRuleMessage {
  messageEn: string;
  messageAr: string;
}

export interface FilterValidationContext {
  fieldKey: string;
  values: Readonly<Record<string, unknown>>;
}

export type FilterValidationRule<TValue = unknown> =
  | (LocalizedRuleMessage & { kind: "required" })
  | (LocalizedRuleMessage & { kind: "min-length"; value: number })
  | (LocalizedRuleMessage & { kind: "max-length"; value: number })
  | (LocalizedRuleMessage & { kind: "pattern"; value: RegExp })
  | (LocalizedRuleMessage & { kind: "date-order" })
  | (LocalizedRuleMessage & {
      kind: "custom";
      validate: (value: TValue | undefined, context: FilterValidationContext) => boolean;
    });

type FilterDependencyValue = string | number | boolean | null;

interface FilterDependencyReason {
  fieldKey: string;
  reasonEn: string;
  reasonAr: string;
}

/** A dependency rule describes the condition under which a field is enabled. */
export type FilterDependencyRule =
  | (FilterDependencyReason & { operator: "present" | "empty" })
  | (FilterDependencyReason & {
      operator: "equals" | "not-equals";
      value: FilterDependencyValue;
    })
  | (FilterDependencyReason & {
      operator: "one-of" | "not-one-of";
      values: readonly FilterDependencyValue[];
    })
  | (FilterDependencyReason & {
      operator: "custom";
      evaluate: (value: unknown, values: Readonly<Record<string, unknown>>) => boolean;
    });

type ScalarFilterQueryContract = Pick<FilterQueryContract, "key" | "serialization">;
type DateRangeFilterQueryContract = Pick<FilterQueryContract, "fromKey" | "toKey" | "serialization">;

interface FilterFieldBase<TType extends string, TValue, TQuery> {
  key: string;
  type: TType;
  /** Optional only while legacy call sites migrate; the UI always renders a fallback label. */
  labelEn?: string;
  labelAr?: string;
  hintEn?: string;
  hintAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  defaultValue?: TValue;
  query?: TQuery;
  validation?: readonly FilterValidationRule<TValue>[];
  /** Every rule must pass unless dependencyMode is `any`. */
  dependencies?: readonly FilterDependencyRule[];
  dependencyMode?: "all" | "any";
  disabled?: boolean;
  disabledReasonEn?: string;
  disabledReasonAr?: string;
}

export interface SearchFilterField
  extends FilterFieldBase<"search", string, ScalarFilterQueryContract> {
  /** Use 0 for immediate local filtering; remote search defaults to 300ms. */
  debounceMs?: number;
}

export interface SelectFilterField
  extends FilterFieldBase<"select", string, ScalarFilterQueryContract> {
  options?: FilterOption[];
}

export type BooleanFilterField = FilterFieldBase<"boolean", boolean, ScalarFilterQueryContract>;

export interface DateRangeFilterField
  extends FilterFieldBase<"date-range", FilterDateRangeValue, DateRangeFilterQueryContract> {
  /** Explicit group and endpoint names; each falls back to the localized field label. */
  groupLabelEn?: string;
  groupLabelAr?: string;
  fromLabelEn?: string;
  fromLabelAr?: string;
  toLabelEn?: string;
  toLabelAr?: string;
}

export type FilterField =
  | SearchFilterField
  | SelectFilterField
  | DateRangeFilterField
  | BooleanFilterField;

export interface FilterBarProps {
  /** Optional only while legacy call sites migrate; a localized fallback is always rendered. */
  labelEn?: string;
  labelAr?: string;
  fields: FilterField[];
  values: Record<string, unknown>;
  onChange: (newValues: Record<string, unknown>) => void;
  onReset?: () => void;
  ariaControls?: string;
  /** Initial load may disable remote controls; background refresh never does. */
  isLoading?: boolean;
  isRefreshing?: boolean;
}
