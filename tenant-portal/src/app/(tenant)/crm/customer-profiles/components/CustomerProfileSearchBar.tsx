"use client";

import { Search } from "lucide-react";
import {
  Input,
  PageActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import {
  CUSTOMER_PROFILE_ADVANCED_FIELDS,
  CUSTOMER_PROFILE_SEARCH_FIELDS,
  customerProfileSearchCleared,
  customerProfileSearchField,
  customerProfileSearchWithGroups,
  customerProfileSearchWithMode,
  customerProfileSearchWithRow,
  customerProfileSearchWithText,
  type CustomerProfileAdvancedFieldId,
  type CustomerProfileSearchFieldDef,
  type CustomerProfileSearchFieldId,
  type CustomerProfileSearchMode,
  type CustomerProfileSearchRow,
  type CustomerProfileSearchState,
} from "../customer-profile-search-contract";

/**
 * "No filter", since a `Select` item cannot carry an empty value.
 *
 * Every value select needs one: once a status is chosen there is otherwise no
 * way back to an unfiltered list without reloading the screen.
 */
const ANY_VALUE = "__any__";

export interface CustomerProfileSearchBarProps {
  value: CustomerProfileSearchState;
  onChange: (next: CustomerProfileSearchState) => void;
  /** Applies the advanced question. Basic answers as you type and never calls it. */
  onSubmit: () => void;
  /**
   * The acquisition-source catalogue the screen already loaded; empty when
   * degraded.
   *
   * A prop rather than a `useCrmAcquisitionSources()` of its own — the page
   * mounts that hook unconditionally for the create modal's picker, and a
   * second instance would fetch the same tenant-wide catalogue a second time
   * on every load of the screen.
   */
  sources: AcquisitionSource[];
  disabled?: boolean;
}

/** The basic bar's field labels, gathered once and handed to its one row. */
type CustomerProfileFieldLabels = Record<CustomerProfileSearchFieldId, string>;

/** The advanced card's field labels, gathered once per render. */
type CustomerProfileAdvancedLabels = Record<
  CustomerProfileAdvancedFieldId,
  string
>;

/**
 * Two modes over two DIFFERENT endpoints, which is why they share no controls.
 *
 * Basic is one equality condition against `GET /customer-profiles`, answered as
 * the user types. Advanced is a filter tree against
 * `POST /customer-profiles/search`: operators, ranges, OR between sections, and
 * the same column asked twice — none of which fits a query string, and none of
 * which may fire mid-edit, so the card runs only when its Search is pressed.
 */
export function CustomerProfileSearchBar({
  value,
  onChange,
  onSubmit,
  sources,
  disabled,
}: CustomerProfileSearchBarProps) {
  const { t, lang } = useI18n();

  // Only `text` has a label of its own; the other three name concepts the
  // screen already labels elsewhere, and a second copy in `basicSearch.fields`
  // would give one column two names that could drift apart.
  const fieldLabels: CustomerProfileFieldLabels = {
    text: t.crmCustomerProfiles.basicSearch.fields.text,
    status: t.common.status,
    profileType: t.crmCustomerProfiles.type,
    source: t.crmCustomerProfiles.source,
  };

  const advancedLabels: CustomerProfileAdvancedLabels =
    t.crmCustomerProfiles.advancedSearch.fields;

  // Both dictionaries are exact-keyed object literals, so a lookup by a runtime
  // `string` needs the widening the narrow-union call sites elsewhere get for
  // free. An unmapped key falls back to the wire value, which is the same
  // contract StatusBadge honours.
  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const profileTypeLabels: Record<string, string | undefined> =
    t.crmCustomerProfiles.profileTypes;

  function advancedEnumLabel(
    field: CustomerProfileAdvancedFieldId,
    wireValue: string,
  ): string {
    if (field === "profileType") return profileTypeLabels[wireValue] ?? wireValue;
    return statusLabels[`CustomerStatus.${wireValue}`] ?? wireValue;
  }

  // `source` is the only catalogue-backed column on this screen; every other
  // field is an enum, a raw uuid, a date or free text and asks nothing of the
  // catalogue. Rows carry the same `AcquisitionSourceOption` the create modal's
  // picker draws, so a source looks the same wherever it is chosen.
  function advancedCatalogueOptions(
    field: CustomerProfileAdvancedFieldId,
  ): readonly CrmSearchCatalogueOption[] {
    if (field !== "source") return [];
    return sources.map((source) => {
      const label = localizedName(source, lang);
      return {
        id: source.id,
        label,
        content: <AcquisitionSourceOption source={source} label={label} />,
      };
    });
  }

  return (
    <>
      <PageActions slot="search">
      <ToggleGroup
        type="single"
        size="sm"
        value={value.mode}
        disabled={disabled}
        // Radix emits "" when the pressed segment is deselected, and a search
        // bar with no mode has nothing to draw — so a press on the active
        // segment is ignored rather than blanking the panel.
        onValueChange={(next) => {
          if (next) {
            onChange(
              customerProfileSearchWithMode(value, next as CustomerProfileSearchMode),
            );
          }
        }}
        aria-label={t.crmCustomerProfiles.searchMode.label}
      >
        <ToggleGroupItem value="basic">
          {t.crmCustomerProfiles.searchMode.basic}
        </ToggleGroupItem>
        <ToggleGroupItem value="advanced">
          {t.crmCustomerProfiles.searchMode.advanced}
        </ToggleGroupItem>
      </ToggleGroup>

      {value.mode === "basic" && (
        <CustomerProfileConditionRow
          state={value}
          row={value.basic}
          fieldLabels={fieldLabels}
          sources={sources}
          disabled={disabled}
          onChange={onChange}
        />
      )}
      </PageActions>

      {value.mode === "advanced" && (
        <CrmAdvancedSearchCard
          fields={CUSTOMER_PROFILE_ADVANCED_FIELDS}
          fieldLabels={advancedLabels}
          enumLabel={advancedEnumLabel}
          catalogueOptions={advancedCatalogueOptions}
          text={value.text}
          onTextChange={(next) => onChange(customerProfileSearchWithText(value, next))}
          groups={value.groups}
          onGroupsChange={(next) =>
            onChange(customerProfileSearchWithGroups(value, next))
          }
          onSubmit={onSubmit}
          // Clears the question WITHOUT running it: an emptied card is a draft,
          // and the list under it keeps answering the last applied query until
          // the user presses Search again.
          onReset={() => onChange(customerProfileSearchCleared(value))}
          disabled={disabled}
        />
      )}
    </>
  );
}

interface CustomerProfileConditionRowProps {
  state: CustomerProfileSearchState;
  row: CustomerProfileSearchRow;
  fieldLabels: CustomerProfileFieldLabels;
  sources: AcquisitionSource[];
  disabled?: boolean;
  onChange: (next: CustomerProfileSearchState) => void;
}

/**
 * Basic mode's single condition: a field picker, and one value control whose
 * TYPE follows the chosen field.
 *
 * Every field is offered, every time. The old picker withheld a field another
 * row already held, which was a fact about the query string's one slot per key
 * — basic has one row, so there is nothing left to withhold it from.
 */
function CustomerProfileConditionRow({
  state,
  row,
  fieldLabels,
  sources,
  disabled,
  onChange,
}: CustomerProfileConditionRowProps) {
  const { t, lang } = useI18n();
  const field = customerProfileSearchField(row.field);

  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const profileTypeLabels: Record<string, string | undefined> =
    t.crmCustomerProfiles.profileTypes;

  function enumLabel(
    definition: CustomerProfileSearchFieldDef,
    wireValue: string,
  ): string {
    if (definition.id === "profileType") {
      return profileTypeLabels[wireValue] ?? wireValue;
    }
    return statusLabels[`CustomerStatus.${wireValue}`] ?? wireValue;
  }

  // Names the field as well as the control, so the value box is not announced
  // as an unqualified "search value".
  const valueLabel = `${t.crmCustomerProfiles.basicSearch.value}: ${fieldLabels[field.id]}`;

  function setValue(next: string) {
    onChange(customerProfileSearchWithRow(state, { value: next }));
  }

  // The mode toggle and the basic row render in the page action bar; the
  // advanced card renders where this component sits, in the page body. A card
  // that grows to several rows of conditions has nowhere to go in a 45px bar,
  // and the basic row is exactly one row of 28px controls, which is what the
  // bar is sized for.
  return (
    <>
      <Select
        value={row.field}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(
            customerProfileSearchWithRow(state, {
              field: next as CustomerProfileSearchFieldId,
            }),
          )
        }
      >
        <SelectTrigger
          size="sm"
          className="w-52"
          aria-label={t.crmCustomerProfiles.basicSearch.field}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CUSTOMER_PROFILE_SEARCH_FIELDS.map((definition) => (
            <SelectItem key={definition.id} value={definition.id}>
              {fieldLabels[definition.id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {field.kind === "text" && (
        <div className="relative w-60">
          <Search
            className={cn(
              iconSize({ size: "md" }),
              "pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <Input
            size="sm"
            className="ps-8"
            value={row.value}
            disabled={disabled}
            maxLength={field.maxLength}
            placeholder={t.crmCustomerProfiles.search}
            aria-label={valueLabel}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      )}

      {field.kind === "enum" && (
        <CustomerProfileSearchValueSelect
          value={row.value}
          label={valueLabel}
          disabled={disabled}
          hasOptions
          onChange={setValue}
        >
          {(field.values ?? []).map((wireValue) => (
            <SelectItem key={wireValue} value={wireValue}>
              {enumLabel(field, wireValue)}
            </SelectItem>
          ))}
        </CustomerProfileSearchValueSelect>
      )}

      {/* The row uses the same `AcquisitionSourceOption` as the create modal's
          picker, so a source looks the same wherever it is chosen. */}
      {field.kind === "source" && (
        <CustomerProfileSearchValueSelect
          value={row.value}
          label={valueLabel}
          disabled={disabled}
          hasOptions={sources.length > 0}
          onChange={setValue}
        >
          {sources.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              <AcquisitionSourceOption
                source={source}
                label={localizedName(source, lang)}
              />
            </SelectItem>
          ))}
        </CustomerProfileSearchValueSelect>
      )}
    </>
  );
}

interface CustomerProfileSearchValueSelectProps {
  value: string;
  label: string;
  disabled?: boolean;
  /** `false` renders the control unusable and says so, rather than empty. */
  hasOptions: boolean;
  onChange: (next: string) => void;
  children: React.ReactNode;
}

/** The value control's shared shell: the "all" escape hatch, then the options. */
function CustomerProfileSearchValueSelect({
  value,
  label,
  disabled,
  hasOptions,
  onChange,
  children,
}: CustomerProfileSearchValueSelectProps) {
  const { t } = useI18n();

  return (
    <Select
      value={value || ANY_VALUE}
      disabled={disabled || !hasOptions}
      onValueChange={(next) => onChange(next === ANY_VALUE ? "" : next)}
    >
      <SelectTrigger size="sm" className="w-60" aria-label={label}>
        <SelectValue
          placeholder={
            hasOptions
              ? t.crmCustomerProfiles.basicSearch.selectValue
              : t.crmCustomerProfiles.basicSearch.catalogueUnavailable
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_VALUE}>
          {t.crmCustomerProfiles.basicSearch.any}
        </SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}
