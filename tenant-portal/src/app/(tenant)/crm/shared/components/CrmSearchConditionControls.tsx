"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  crmOperatorsForField,
  type CrmFilterOperator,
  type CrmSearchCondition,
  type CrmSearchFieldDef,
} from "../search/filter-tree";
import type { CrmSearchCatalogueOption } from "./CrmAdvancedSearchCard";
import { CrmSearchValueControl } from "./CrmSearchValueControl";

const UNSELECTED_FIELD_VALUE = "__crm_unselected_field__";

interface CrmSearchConditionControlsProps<Id extends string> {
  /** `group:condition` — where the card sends focus after a structural edit. */
  focusKey: string;
  condition: CrmSearchCondition<Id>;
  definition?: CrmSearchFieldDef<Id>;
  fields: readonly CrmSearchFieldDef<Id>[];
  fieldLabels: Record<Id, string>;
  enumLabel: (field: Id, wireValue: string) => string;
  catalogueOptions: (field: Id) => readonly CrmSearchCatalogueOption[];
  disabled?: boolean;
  onPatch: (patch: Partial<CrmSearchCondition<Id>>) => void;
}

/**
 * Field, operator, value — where both the operator LIST and the value CONTROL
 * follow the field's kind.
 *
 * The operator list is the whole point of deriving it: `ilike` on a date and
 * `between` on an enum are both `400 INVALID_OPERATOR_VALUE`, which arrives at
 * the screen as a failed load rather than as an unavailable option.
 */
export function CrmSearchConditionControls<Id extends string>({
  focusKey,
  condition,
  definition,
  fields,
  fieldLabels,
  enumLabel,
  catalogueOptions,
  disabled,
  onPatch,
}: CrmSearchConditionControlsProps<Id>) {
  const { t } = useI18n();
  const copy = t.crmAdvancedSearch;
  const operators = definition ? crmOperatorsForField(definition) : [];
  const operatorLabels: Record<CrmFilterOperator, string> = copy.operators;
  const effectiveOperator =
    definition && operators.includes(condition.operator) ? condition.operator : operators[0];

  return (
    <>
      <Select
        value={condition.fieldSelected === false ? UNSELECTED_FIELD_VALUE : condition.field}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== UNSELECTED_FIELD_VALUE) {
            onPatch({ field: next as Id, fieldSelected: true });
          }
        }}
      >
        {/* Sized to its label within bounds: Arabic field names run long
            ("نوع العميل المحتمل"), and a fixed box either truncates them or
            wastes the line on short ones. */}
        <SelectTrigger
          size="sm"
          className="w-auto min-w-32 max-w-56"
          aria-label={copy.field}
          data-crm-search-field={focusKey}
        >
          <SelectValue placeholder={copy.selectField} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSELECTED_FIELD_VALUE} disabled>
            {copy.selectField}
          </SelectItem>
          {/* Every field, every time: repeating one is legal on this wire. */}
          {fields.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {fieldLabels[candidate.id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {definition && effectiveOperator && (
        <>
          {operators.length > 1 && (
            // Sized to its label: "is" and "greater than or equal" share a
            // line with the field and value, so a fixed width wastes it.
            <Select
              value={effectiveOperator}
              disabled={disabled}
              onValueChange={(next) => onPatch({ operator: next as CrmFilterOperator })}
            >
              <SelectTrigger size="sm" className="w-auto min-w-20 max-w-40" aria-label={copy.operator}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operatorLabels[operator]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <CrmSearchValueControl
            condition={{ ...condition, operator: effectiveOperator }}
            definition={definition}
            label={`${copy.value}: ${fieldLabels[definition.id]}`}
            enumLabel={enumLabel}
            catalogueOptions={catalogueOptions}
            disabled={disabled}
            onPatch={onPatch}
          />
        </>
      )}
    </>
  );
}
