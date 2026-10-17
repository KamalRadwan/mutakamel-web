"use client";

import { Check, Clock, Flame, PhoneCall, SlidersHorizontal } from "lucide-react";
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

export interface LeadSearchBarProps {
  value: LeadSearchState;
  onChange: (next: LeadSearchState) => void;
  /** Promotes the Advanced draft to the request. Basic applies immediately. */
  onSubmit: () => void;
  stages: LeadStage[];
  /** Remounts Basic's local, unfinished prompt when the branch changes. */
  resetKey: string;
  disabled?: boolean;
  matchCount?: number;
}

/** Basic is the default Odoo-style bar; Advanced renders the visual Filter Tree Builder (Screen 08). */
export function LeadSearchBar({
  value,
  onChange,
  onSubmit,
  stages,
  resetKey,
  disabled,
  matchCount,
}: LeadSearchBarProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

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
          variant={value.mode === "advanced" ? "secondary" : "outline"}
          size="xs"
          disabled={disabled}
          aria-pressed={value.mode === "advanced"}
          aria-label={t.crmLeads.searchMode.advanced}
          title={`${t.crmLeads.searchMode.label}: ${t.crmLeads.searchMode.advanced}`}
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
        <div className="flex flex-col gap-2.5 rounded-xl border-2 border-blue-500/80 bg-white p-3.5 shadow-sm dark:border-blue-500/60 dark:bg-slate-900">
          {/* Screen 08: Advanced Filter Tree Builder Header & Saved Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-slate-100">
                <SlidersHorizontal className="size-3.5 text-blue-600" aria-hidden="true" />
                <span>
                  {isAr
                    ? "منشئ شجرة الفلاتر المتقدمة (POST /crm/leads/search)"
                    : "Advanced Filter Tree Builder (POST /crm/leads/search)"}
                </span>
              </span>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Depth ≤ 5 · 100 Leaves
              </span>

              <span className="ms-1 text-[11px] font-medium text-slate-400">
                {isAr ? "قوالب جاهزة:" : "Saved Presets:"}
              </span>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                <Flame className="size-3 text-amber-500" aria-hidden="true" />
                <span>{isAr ? "عملاء المؤسسات الساخنون" : "My Hot Corporate Leads"}</span>
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <Clock className="size-3 text-rose-500" aria-hidden="true" />
                <span>{isAr ? "متأخر > 3 أيام" : "Stagnant > 3 Days"}</span>
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <PhoneCall className="size-3 text-rose-500" aria-hidden="true" />
                <span>{isAr ? "مركز الاتصال غير المتابع" : "Uncontacted Call Center"}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange(leadSearchCleared(value))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {isAr ? "إعادة ضبط الكل" : "Reset All"}
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>
                  {isAr
                    ? `تطبيق شجرة الفلاتر (${matchCount ?? 0})`
                    : `Apply Filter Tree (${matchCount ?? 0} Matches)`}
                </span>
              </button>
            </div>
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
