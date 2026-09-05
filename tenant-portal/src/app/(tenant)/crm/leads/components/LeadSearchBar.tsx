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
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import {
  leadSearchAvailableFields,
  leadSearchField,
  leadSearchWithMode,
  leadSearchWithRow,
  leadSearchWithRowAdded,
  leadSearchWithRowRemoved,
  type LeadSearchFieldDef,
  type LeadSearchFieldId,
  type LeadSearchMode,
  type LeadSearchRow,
  type LeadSearchState,
} from "../lead-search-contract";
import type { LeadStage } from "../hooks/useLeads";

/**
 * "No filter", since a `Select` item cannot carry an empty value.
 *
 * Every value select needs one: once a status is chosen there is otherwise no
 * way back to an unfiltered list without reloading the screen.
 */
const ANY_VALUE = "__any__";

export interface LeadSearchBarProps {
  value: LeadSearchState;
  onChange: (next: LeadSearchState) => void;
  /** The stage catalogue the leads hook already loaded; empty when degraded. */
  stages: LeadStage[];
  disabled?: boolean;
}

/** The field labels, gathered once and handed down to every condition row. */
type LeadFieldLabels = Record<LeadSearchFieldId, string>;

/**
 * Two modes over the same vocabulary: one condition, or several AND-ed.
 *
 * Advanced is the MOST `GET /leads` supports, and deliberately no more. It has
 * six equality filters that the server ANDs, and no operators, no ranges and
 * no OR — the filter-tree engine in shared-libs is exposed through no CRM
 * route (Q131). So the rows join with a static AND rather than an AND/OR
 * control, there is no operator column, and the panel says in one line what a
 * search endpoint would have to exist for before either could appear.
 */
export function LeadSearchBar({ value, onChange, stages, disabled }: LeadSearchBarProps) {
  const { t } = useI18n();

  const fieldLabels: LeadFieldLabels = {
    text: t.crmLeads.basicSearch.fields.text,
    status: t.crmLeads.basicSearch.fields.status,
    stageFlag: t.crmLeads.basicSearch.fields.stageFlag,
    leadType: t.crmLeads.create.leadType,
    stage: t.crmLeads.stage,
    source: t.crmLeads.source,
  };

  // Basic draws the first condition and nothing else. The state keeps whatever
  // the mode switch left in `rows`, and the builder sends only the first — so
  // the row on screen is the row on the wire.
  const [firstRow] = value.rows;
  // Whether a further condition is possible at all: one row per wire key, so a
  // sixth field cannot be asked for once five are spoken for.
  const canAddRow = leadSearchAvailableFields(value, value.rows.length).length > 0;

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
            if (next) onChange(leadSearchWithMode(value, next as LeadSearchMode));
          }}
          aria-label={t.crmLeads.searchMode.label}
        >
          <ToggleGroupItem value="basic">{t.crmLeads.searchMode.basic}</ToggleGroupItem>
          <ToggleGroupItem value="advanced">{t.crmLeads.searchMode.advanced}</ToggleGroupItem>
        </ToggleGroup>

        {value.mode === "basic" && firstRow && (
          <LeadConditionRow
            state={value}
            rowIndex={0}
            row={firstRow}
            fieldLabels={fieldLabels}
            stages={stages}
            disabled={disabled}
            onChange={onChange}
          />
        )}
      </div>

      {value.mode === "advanced" && (
        <div
          role="group"
          aria-label={t.crmLeads.advancedSearch.conditions}
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
                {t.crmLeads.advancedSearch.and}
              </span>

              <LeadConditionRow
                state={value}
                rowIndex={index}
                row={row}
                fieldLabels={fieldLabels}
                stages={stages}
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
                aria-label={formatTemplate(t.crmLeads.advancedSearch.removeCondition, {
                  field: fieldLabels[row.field],
                })}
                onClick={() => onChange(leadSearchWithRowRemoved(value, index))}
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
                onClick={() => onChange(leadSearchWithRowAdded(value))}
              >
                <Plus className={iconSize({ size: "md" })} aria-hidden="true" />
                {t.crmLeads.advancedSearch.addCondition}
              </Button>
            </div>
          )}

          <p className="text-2xs text-muted-foreground">
            {t.crmLeads.advancedSearch.unsupported}
          </p>
        </div>
      )}
    </div>
  );
}

interface LeadConditionRowProps {
  state: LeadSearchState;
  rowIndex: number;
  row: LeadSearchRow;
  fieldLabels: LeadFieldLabels;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: LeadSearchState) => void;
}

/**
 * One condition: a field picker, and one value control whose TYPE follows the
 * chosen field. The same row in both modes — basic is this once.
 */
function LeadConditionRow({
  state,
  rowIndex,
  row,
  fieldLabels,
  stages,
  disabled,
  onChange,
}: LeadConditionRowProps) {
  const { t } = useI18n();
  const field = leadSearchField(row.field);
  // Only the fields no OTHER row already holds, plus this row's own. A query
  // string has one slot per key, so a second `status` row could only overwrite
  // the first — the duplicate is withheld rather than offered and then lost.
  const available = leadSearchAvailableFields(state, rowIndex);

  // Both dictionaries are exact-keyed object literals, so a lookup by a
  // runtime `string` needs the widening the narrow-union call sites elsewhere
  // get for free. An unmapped key falls back to the wire value, which is the
  // same contract StatusBadge honours.
  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const leadTypeLabels: Record<string, string | undefined> = t.crmLeads.create.types;

  function enumLabel(definition: LeadSearchFieldDef, wireValue: string): string {
    if (definition.id === "leadType") return leadTypeLabels[wireValue] ?? wireValue;
    if (definition.id === "status") {
      return statusLabels[`LeadStatus.${wireValue}`] ?? wireValue;
    }
    return statusLabels[`LeadStageFlag.${wireValue}`] ?? wireValue;
  }

  // Names the row as well as the control, so several conditions do not present
  // a screen reader with several identically labelled value boxes.
  const valueLabel = `${t.crmLeads.basicSearch.value}: ${fieldLabels[field.id]}`;

  function setValue(next: string) {
    onChange(leadSearchWithRow(state, rowIndex, { value: next }));
  }

  return (
    <>
      <Select
        value={row.field}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(leadSearchWithRow(state, rowIndex, { field: next as LeadSearchFieldId }))
        }
      >
        <SelectTrigger size="sm" className="w-52" aria-label={t.crmLeads.basicSearch.field}>
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
            placeholder={t.crmLeads.search}
            aria-label={valueLabel}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      )}

      {field.kind === "enum" && (
        <LeadSearchValueSelect
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
        </LeadSearchValueSelect>
      )}

      {field.kind === "stage" && (
        <LeadStageFilterSelect
          value={row.value}
          label={valueLabel}
          stages={stages}
          disabled={disabled}
          onChange={setValue}
        />
      )}

      {field.kind === "source" && (
        <LeadSourceFilterSelect
          value={row.value}
          label={valueLabel}
          disabled={disabled}
          onChange={setValue}
        />
      )}
    </>
  );
}

interface LeadSearchValueSelectProps {
  value: string;
  label: string;
  disabled?: boolean;
  /** `false` renders the control unusable and says so, rather than empty. */
  hasOptions: boolean;
  onChange: (next: string) => void;
  children: React.ReactNode;
}

/** The value control's shared shell: the "all" escape hatch, then the options. */
function LeadSearchValueSelect({
  value,
  label,
  disabled,
  hasOptions,
  onChange,
  children,
}: LeadSearchValueSelectProps) {
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
              ? t.crmLeads.basicSearch.selectValue
              : t.crmLeads.basicSearch.catalogueUnavailable
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY_VALUE}>{t.crmLeads.basicSearch.any}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}

interface LeadStageFilterSelectProps {
  value: string;
  label: string;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: string) => void;
}

/**
 * Stage filter over the catalogue the leads hook already holds — no second
 * request for a list this screen loaded to draw its board columns.
 *
 * A `CONVERTED` stage is offered here, unlike in the create form: filtering to
 * finished leads is a reasonable question even though creating into one is a
 * 422.
 */
function LeadStageFilterSelect({
  value,
  label,
  stages,
  disabled,
  onChange,
}: LeadStageFilterSelectProps) {
  const { lang } = useI18n();

  return (
    <LeadSearchValueSelect
      value={value}
      label={label}
      disabled={disabled}
      hasOptions={stages.length > 0}
      onChange={onChange}
    >
      {stages.map((stage) => (
        <SelectItem key={stage.id} value={stage.id}>
          {localizedName(stage, lang)}
        </SelectItem>
      ))}
    </LeadSearchValueSelect>
  );
}

interface LeadSourceFilterSelectProps {
  value: string;
  label: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}

/**
 * Source filter over the acquisition-source catalogue.
 *
 * Its own component so the catalogue request fires only once a user actually
 * picks this field — the leads list itself does not need it, and mounting the
 * hook at the bar's top level would add a request to every load of the screen.
 * One row per field means at most one of these is ever mounted, so advanced
 * mode does not multiply the request either. Rows use the same
 * `AcquisitionSourceOption` as the create modal's picker, so a source looks the
 * same wherever it is chosen.
 */
function LeadSourceFilterSelect({
  value,
  label,
  disabled,
  onChange,
}: LeadSourceFilterSelectProps) {
  const { lang } = useI18n();
  const { items } = useCrmAcquisitionSources();

  return (
    <LeadSearchValueSelect
      value={value}
      label={label}
      disabled={disabled}
      hasOptions={items.length > 0}
      onChange={onChange}
    >
      {items.map((source) => (
        <SelectItem key={source.id} value={source.id}>
          <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
        </SelectItem>
      ))}
    </LeadSearchValueSelect>
  );
}
