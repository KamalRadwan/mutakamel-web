"use client";

import { Search } from "lucide-react";
import {
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
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import {
  LEAD_ADVANCED_FIELDS,
  LEAD_SEARCH_FIELDS,
  leadSearchCleared,
  leadSearchField,
  leadSearchWithGroups,
  leadSearchWithMode,
  leadSearchWithRow,
  leadSearchWithText,
  type LeadAdvancedFieldId,
  type LeadSearchFieldDef,
  type LeadSearchFieldId,
  type LeadSearchMode,
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
  /** Runs the advanced query. Basic never calls this — it is debounced. */
  onSubmit: () => void;
  /** The stage catalogue the leads hook already loaded; empty when degraded. */
  stages: LeadStage[];
  disabled?: boolean;
}

/**
 * Two modes over two ENDPOINTS.
 *
 * Basic is one condition against `GET /leads`, answered as you type: a single
 * text box has no half-built state worth skipping, so the debounce stays.
 * Advanced is a filter tree against `POST /leads/search`, and nothing about it
 * reaches the network until its Search button is pressed — the intermediate
 * states of a tree are all different questions, and most of them are the
 * expensive ones.
 */
export function LeadSearchBar({
  value,
  onChange,
  onSubmit,
  stages,
  disabled,
}: LeadSearchBarProps) {
  const { t } = useI18n();

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

        {value.mode === "basic" && (
          <LeadBasicCondition
            state={value}
            stages={stages}
            disabled={disabled}
            onChange={onChange}
          />
        )}
      </div>

      {value.mode === "advanced" && (
        <LeadAdvancedSearch
          state={value}
          stages={stages}
          disabled={disabled}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

interface LeadAdvancedSearchProps {
  state: LeadSearchState;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: LeadSearchState) => void;
  onSubmit: () => void;
}

/**
 * The advanced card, and the one place the acquisition-source catalogue is
 * fetched for this screen.
 *
 * Its own component so the request fires when a user enters advanced mode
 * rather than on every load of the leads list — the list itself does not need
 * the catalogue, and hooking it at the bar's top level would add a request to
 * every visit. The card can hold several source conditions at once, so the
 * hook has to live above them all rather than inside one row.
 */
function LeadAdvancedSearch({
  state,
  stages,
  disabled,
  onChange,
  onSubmit,
}: LeadAdvancedSearchProps) {
  const { t, lang } = useI18n();
  const { items: sources } = useCrmAcquisitionSources();

  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const leadTypeLabels: Record<string, string | undefined> = t.crmLeads.create.types;
  const labels = t.crmLeads.advancedSearch.fields;

  const fieldLabels: Record<LeadAdvancedFieldId, string> = {
    id: labels.id,
    source: labels.source,
    leadType: labels.leadType,
    stage: labels.stage,
    stageFlag: labels.stageFlag,
    status: labels.status,
    owner: labels.owner,
    createdBy: labels.createdBy,
    description: labels.description,
    interestSummary: labels.interestSummary,
    expectedNeed: labels.expectedNeed,
    convertedCustomerProfile: labels.convertedCustomerProfile,
    convertedOpportunity: labels.convertedOpportunity,
    convertedAt: labels.convertedAt,
    createdAt: labels.createdAt,
    updatedAt: labels.updatedAt,
  };

  // Both dictionaries are exact-keyed object literals, so a lookup by a
  // runtime `string` needs the widening the narrow-union call sites elsewhere
  // get for free. An unmapped key falls back to the wire value, which is the
  // same contract StatusBadge honours.
  function enumLabel(field: LeadAdvancedFieldId, wireValue: string): string {
    if (field === "leadType") return leadTypeLabels[wireValue] ?? wireValue;
    if (field === "status") return statusLabels[`LeadStatus.${wireValue}`] ?? wireValue;
    return statusLabels[`LeadStageFlag.${wireValue}`] ?? wireValue;
  }

  function catalogueOptions(field: LeadAdvancedFieldId): readonly CrmSearchCatalogueOption[] {
    if (field === "stage") {
      // A CONVERTED stage is offered here, unlike in the create form:
      // filtering to finished leads is a reasonable question even though
      // creating into one is a 422.
      return stages.map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
    }
    return sources.map((source) => {
      const label = localizedName(source, lang);
      return {
        id: source.id,
        label,
        // The same row the create modal's picker draws, so a source looks the
        // same wherever it is chosen.
        content: <AcquisitionSourceOption source={source} label={label} />,
      };
    });
  }

  return (
    <CrmAdvancedSearchCard
      fields={LEAD_ADVANCED_FIELDS}
      fieldLabels={fieldLabels}
      enumLabel={enumLabel}
      catalogueOptions={catalogueOptions}
      text={state.text}
      onTextChange={(next) => onChange(leadSearchWithText(state, next))}
      groups={state.groups}
      onGroupsChange={(next) => onChange(leadSearchWithGroups(state, next))}
      onSubmit={onSubmit}
      onReset={() => onChange(leadSearchCleared(state))}
      disabled={disabled}
    />
  );
}

interface LeadBasicConditionProps {
  state: LeadSearchState;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: LeadSearchState) => void;
}

/**
 * Basic mode's one condition: a field picker, and one value control whose TYPE
 * follows the chosen field.
 *
 * There is no operator column and no way to add a second row, because
 * `GET /leads` has neither: its six filters are equality and it ANDs them.
 * Everything wider is what advanced mode's endpoint exists for.
 */
function LeadBasicCondition({ state, stages, disabled, onChange }: LeadBasicConditionProps) {
  const { t } = useI18n();
  const row = state.basic;
  const field = leadSearchField(row.field);

  const fieldLabels: Record<LeadSearchFieldId, string> = {
    text: t.crmLeads.basicSearch.fields.text,
    status: t.crmLeads.basicSearch.fields.status,
    stageFlag: t.crmLeads.basicSearch.fields.stageFlag,
    leadType: t.crmLeads.create.leadType,
    stage: t.crmLeads.stage,
    source: t.crmLeads.source,
  };

  const statusLabels: Record<string, string | undefined> = t.statusValues;
  const leadTypeLabels: Record<string, string | undefined> = t.crmLeads.create.types;

  function enumLabel(definition: LeadSearchFieldDef, wireValue: string): string {
    if (definition.id === "leadType") return leadTypeLabels[wireValue] ?? wireValue;
    if (definition.id === "status") {
      return statusLabels[`LeadStatus.${wireValue}`] ?? wireValue;
    }
    return statusLabels[`LeadStageFlag.${wireValue}`] ?? wireValue;
  }

  // Names the row as well as the control, so the field picker and the value
  // box do not present a screen reader with two unrelated "search" labels.
  const valueLabel = `${t.crmLeads.basicSearch.value}: ${fieldLabels[field.id]}`;

  function setValue(next: string) {
    onChange(leadSearchWithRow(state, { value: next }));
  }

  return (
    <>
      <Select
        value={row.field}
        disabled={disabled}
        onValueChange={(next) =>
          onChange(leadSearchWithRow(state, { field: next as LeadSearchFieldId }))
        }
      >
        <SelectTrigger size="sm" className="w-52" aria-label={t.crmLeads.basicSearch.field}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_SEARCH_FIELDS.map((definition) => (
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
 * Basic mode holds one condition, so at most one of these is ever mounted.
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
