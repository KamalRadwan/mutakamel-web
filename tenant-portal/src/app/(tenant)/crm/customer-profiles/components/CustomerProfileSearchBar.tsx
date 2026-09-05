"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import {
  Button,
  Input,
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
import { formatTemplate } from "@/lib/format/template";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import type { AcquisitionSource } from "../../acquisition-sources/acquisition-source-contract";
import {
  customerProfileSearchAvailableFields,
  customerProfileSearchField,
  customerProfileSearchWithMode,
  customerProfileSearchWithRow,
  customerProfileSearchWithRowAdded,
  customerProfileSearchWithRowRemoved,
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
  /**
   * The acquisition-source catalogue the screen already loaded; empty when
   * degraded.
   *
   * A prop rather than a `useCrmAcquisitionSources()` of its own — the page
   * mounts that hook unconditionally for the create modal's picker, and a
   * second instance would fetch the same tenant-wide catalogue a second time
   * on every load of the screen. (`LeadSearchBar` fetches its own for the
   * opposite reason: that screen does not already hold one.)
   */
  sources: AcquisitionSource[];
  disabled?: boolean;
}

/** The field labels, gathered once and handed down to every condition row. */
type CustomerProfileFieldLabels = Record<CustomerProfileSearchFieldId, string>;

/**
 * Two modes over the same vocabulary: one condition, or several AND-ed.
 *
 * Advanced is the MOST `GET /customer-profiles` supports, and deliberately no
 * more. It has four equality filters that the server ANDs, and no operators,
 * no ranges and no OR — the filter-tree engine in shared-libs is exposed
 * through no CRM route (Q131). So the rows join with a static AND rather than
 * an AND/OR control, there is no operator column, and the panel says in one
 * line what a search endpoint would have to exist for before either could
 * appear.
 */
export function CustomerProfileSearchBar({
  value,
  onChange,
  sources,
  disabled,
}: CustomerProfileSearchBarProps) {
  const { t } = useI18n();

  const fieldLabels: CustomerProfileFieldLabels = {
    text: t.crmCustomerProfiles.basicSearch.fields.text,
    status: t.common.status,
    profileType: t.crmCustomerProfiles.type,
    source: t.crmCustomerProfiles.source,
  };

  // Basic draws the first condition and nothing else. The state keeps whatever
  // the mode switch left in `rows`, and the builder sends only the first — so
  // the row on screen is the row on the wire.
  const [firstRow] = value.rows;
  // Whether a further condition is possible at all: one row per wire key, so a
  // fifth field cannot be asked for once four are spoken for.
  const canAddRow =
    customerProfileSearchAvailableFields(value, value.rows.length).length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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

        {value.mode === "basic" && firstRow && (
          <CustomerProfileConditionRow
            state={value}
            rowIndex={0}
            row={firstRow}
            fieldLabels={fieldLabels}
            sources={sources}
            disabled={disabled}
            onChange={onChange}
          />
        )}
      </div>

      {value.mode === "advanced" && (
        <div
          role="group"
          aria-label={t.crmCustomerProfiles.advancedSearch.conditions}
          className="flex flex-col gap-2 rounded-sm border border-border bg-card p-3"
        >
          {value.rows.map((row, index) => (
            // Keyed by POSITION, not by field. A field is unique per row and
            // would key just as well, but then changing a row's field would
            // unmount the picker that is changing it — Radix hands focus back
            // to the trigger as the menu closes, and a trigger destroyed in
            // the same commit drops focus to the body. Every row is fully
            // controlled by props, so an index that shifts after a removal
            // still renders the right condition.
            <div key={index} className="flex flex-wrap items-center gap-2">
              {/* Static text, not a control. The endpoint ANDs its filters and
                  cannot be asked for OR, and an AND/OR toggle that only ever
                  means AND would be a lie the user cannot see through. The
                  first row keeps the chip's width so the pickers line up. */}
              <span
                aria-hidden={index === 0 || undefined}
                className={cn(
                  "shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-2xs uppercase text-muted-foreground",
                  index === 0 && "invisible",
                )}
              >
                {t.crmCustomerProfiles.advancedSearch.and}
              </span>

              <CustomerProfileConditionRow
                state={value}
                rowIndex={index}
                row={row}
                fieldLabels={fieldLabels}
                sources={sources}
                disabled={disabled}
                onChange={onChange}
              />

              {/* Shown on every row, the last one included: removing the only
                  condition clears it rather than leaving the panel empty. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-label={formatTemplate(
                  t.crmCustomerProfiles.advancedSearch.removeCondition,
                  { field: fieldLabels[row.field] },
                )}
                onClick={() =>
                  onChange(customerProfileSearchWithRowRemoved(value, index))
                }
                className="size-6 shrink-0 rounded-full p-0"
              >
                <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
              </Button>
            </div>
          ))}

          {canAddRow && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(customerProfileSearchWithRowAdded(value))}
              >
                <Plus className={iconSize({ size: "md" })} aria-hidden="true" />
                {t.crmCustomerProfiles.advancedSearch.addCondition}
              </Button>
            </div>
          )}

          <p className="text-2xs text-muted-foreground">
            {t.crmCustomerProfiles.advancedSearch.unsupported}
          </p>
        </div>
      )}
    </div>
  );
}

interface CustomerProfileConditionRowProps {
  state: CustomerProfileSearchState;
  rowIndex: number;
  row: CustomerProfileSearchRow;
  fieldLabels: CustomerProfileFieldLabels;
  sources: AcquisitionSource[];
  disabled?: boolean;
  onChange: (next: CustomerProfileSearchState) => void;
}

/**
 * One condition: a field picker, and one value control whose TYPE follows the
 * chosen field. The same row in both modes — basic is this once.
 */
function CustomerProfileConditionRow({
  state,
  rowIndex,
  row,
  fieldLabels,
  sources,
  disabled,
  onChange,
}: CustomerProfileConditionRowProps) {
  const { t, lang } = useI18n();
  const field = customerProfileSearchField(row.field);
  // Only the fields no OTHER row already holds, plus this row's own. A query
  // string has one slot per key, so a second `status` row could only overwrite
  // the first — the duplicate is withheld rather than offered and then lost.
  const available = customerProfileSearchAvailableFields(state, rowIndex);

  // Both dictionaries are exact-keyed object literals, so a lookup by a
  // runtime `string` needs the widening the narrow-union call sites elsewhere
  // get for free. An unmapped key falls back to the wire value, which is the
  // same contract StatusBadge honours.
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

  // Names the row as well as the control, so several conditions do not present
  // a screen reader with several identically labelled value boxes.
  const valueLabel = `${t.crmCustomerProfiles.basicSearch.value}: ${fieldLabels[field.id]}`;

  function setValue(next: string) {
    onChange(customerProfileSearchWithRow(state, rowIndex, { value: next }));
  }

  return (
    <>
      <Select
        value={row.field}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(
            customerProfileSearchWithRow(state, rowIndex, {
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
          {available.map((definition) => (
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

      {/* Rows use the same `AcquisitionSourceOption` as the create modal's
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
