"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button, PageActions, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceOption } from "../../shared/components/AcquisitionSourceIcon";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import type { LeadStage } from "../hooks/useLeads";
import {
  LEAD_ADVANCED_FIELDS,
  leadSearchCleared,
  leadSearchWithGroups,
  leadSearchWithMode,
  type LeadAdvancedFieldId,
  type LeadSearchState,
} from "../lead-search-contract";
import { LeadBasicSearch } from "./LeadBasicSearch";

interface LeadSearchBarProps {
  value: LeadSearchState;
  onChange: (next: LeadSearchState) => void;
  /** Promotes the Advanced draft to the request. Basic applies immediately. */
  onSubmit: () => void;
  stages: LeadStage[];
  /** Remounts Basic's local, unfinished prompt when the branch changes. */
  resetKey: string;
  disabled?: boolean;
}

/** Basic is the default Odoo-style bar; Advanced renders the visual Filter Tree Builder (Screen 08). */
export function LeadSearchBar({
  value,
  onChange,
  onSubmit,
  stages,
  resetKey,
  disabled,
}: LeadSearchBarProps) {
  const { t } = useI18n();

  return (
    <>
      <PageActions slot="search">
        {value.mode === "basic" && (
          <LeadBasicSearch
            key={resetKey}
            state={value}
            stages={stages}
            disabled={disabled}
            onChange={onChange}
          />
        )}

        <Button
          variant="outline"
          size="toolbar"
          disabled={disabled}
          aria-pressed={value.mode === "advanced"}
          aria-label={t.crmLeads.searchMode.advanced}
          title={`${t.crmLeads.searchMode.label}: ${t.crmLeads.searchMode.advanced}`}
          className="h-(--size-toolbar-control) rounded-lg border-line-control px-3 text-label font-semibold aria-pressed:border-ring aria-pressed:bg-selected"
          onClick={() =>
            onChange(
              leadSearchWithMode(value, value.mode === "advanced" ? "basic" : "advanced"),
            )
          }
        >
          <SlidersHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
          {t.crmLeads.searchMode.advanced}
        </Button>
      </PageActions>

      {value.mode === "advanced" && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5">
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => onChange(leadSearchCleared(value))}
            >
              {t.crmLeads.basicSearch.clear}
            </Button>
            <Button variant="secondary" size="xs" onClick={onSubmit}>
              {t.crmLeads.advancedSearch.apply}
            </Button>
          </div>

          <LeadAdvancedSearch
            state={value}
            stages={stages}
            disabled={disabled}
            onChange={onChange}
            onSubmit={onSubmit}
          />
        </div>
      )}
    </>
  );
}

interface LeadAdvancedSearchProps {
  state: LeadSearchState;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: LeadSearchState) => void;
  onSubmit: () => void;
}

/** Loads catalogue values only while the Advanced builder is mounted. */
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
  const cardColorLabels: Record<string, string | undefined> = t.crmLeads.card.colors;
  const labels = t.crmLeads.advancedSearch.fields;

  const fieldLabels: Record<LeadAdvancedFieldId, string> = {
    id: labels.id,
    source: labels.source,
    leadType: labels.leadType,
    stage: labels.stage,
    stageFlag: labels.stageFlag,
    status: labels.status,
    rating: t.crmLeads.card.rating,
    cardColor: t.crmLeads.card.cardColor,
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

  function enumLabel(field: LeadAdvancedFieldId, wireValue: string): string {
    if (field === "leadType") return leadTypeLabels[wireValue] ?? wireValue;
    if (field === "status") return statusLabels[`LeadStatus.${wireValue}`] ?? wireValue;
    if (field === "stageFlag") return statusLabels[`LeadStageFlag.${wireValue}`] ?? wireValue;
    if (field === "cardColor") return cardColorLabels[wireValue] ?? wireValue;
    return wireValue;
  }

  function catalogueOptions(field: LeadAdvancedFieldId): readonly CrmSearchCatalogueOption[] {
    if (field === "stage") {
      return stages.map((stage) => ({ id: stage.id, label: localizedName(stage, lang) }));
    }
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
    <CrmAdvancedSearchCard
      fields={LEAD_ADVANCED_FIELDS}
      fieldLabels={fieldLabels}
      enumLabel={enumLabel}
      catalogueOptions={catalogueOptions}
      groups={state.groups}
      onGroupsChange={(next) => onChange(leadSearchWithGroups(state, next))}
      onSubmit={onSubmit}
      onReset={() => onChange(leadSearchCleared(state))}
      disabled={disabled}
      requireFieldSelection
    />
  );
}
