"use client";

import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, PageActions, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import {
  OPPORTUNITY_ADVANCED_FIELDS,
  opportunitySearchCleared,
  opportunitySearchWithGroups,
  opportunitySearchWithMode,
  type OpportunityAdvancedFieldId,
  type OpportunitySearchState,
} from "../opportunity-search-contract";
import type { OpportunityPipeline } from "../hooks/pipeline-types";
import { OpportunityBasicSearch } from "./OpportunityBasicSearch";

export interface OpportunitySearchBarProps {
  value: OpportunitySearchState;
  onChange: (next: OpportunitySearchState) => void;
  /** Advanced mode's Search button: promote the draft and run it. */
  onSubmit: () => void;
  /**
   * Every pipeline the workspace already loaded, each with its own stages.
   *
   * A prop rather than a fetch of its own: `usePipelineWorkspace` reads this
   * catalogue to draw the board columns, and a second copy would cost a
   * request on every load of a screen that already has one.
   */
  pipelines: OpportunityPipeline[];
  resetKey: string;
  advancedEnabled?: boolean;
  disabled?: boolean;
}

/**
 * Two modes over two endpoints: one term, or a filter tree.
 *
 * Basic answers as you type over `GET /opportunities`; advanced builds a tree
 * for `POST /opportunities/search` and runs nothing until Search is pressed.
 * The card itself is the shared `CrmAdvancedSearchCard`, so leads, customer
 * profiles and opportunities all draw the same builder — only the field
 * catalogue and the option lists differ, and both come from this module.
 */
export function OpportunitySearchBar({
  value,
  onChange,
  onSubmit,
  pipelines,
  resetKey,
  advancedEnabled = true,
  disabled,
}: OpportunitySearchBarProps) {
  const { t, lang } = useI18n();
  const copy = t.crmOpportunities;

  const fieldLabels: Record<OpportunityAdvancedFieldId, string> = {
    id: copy.advancedSearch.fields.id,
    customerProfile: copy.advancedSearch.fields.customerProfile,
    customerParty: copy.advancedSearch.fields.customerParty,
    contactParty: copy.advancedSearch.fields.contactParty,
    lead: copy.advancedSearch.fields.lead,
    pipeline: copy.advancedSearch.fields.pipeline,
    stage: copy.advancedSearch.fields.stage,
    stageFlag: copy.advancedSearch.fields.stageFlag,
    status: copy.advancedSearch.fields.status,
    owner: copy.advancedSearch.fields.owner,
    title: copy.advancedSearch.fields.title,
    description: copy.advancedSearch.fields.description,
    importance: copy.advancedSearch.fields.importance,
    amount: copy.advancedSearch.fields.amount,
    currencyCode: copy.advancedSearch.fields.currencyCode,
    probabilityPercent: copy.advancedSearch.fields.probabilityPercent,
    expectedCloseDate: copy.advancedSearch.fields.expectedCloseDate,
    wonAt: copy.advancedSearch.fields.wonAt,
    lostAt: copy.advancedSearch.fields.lostAt,
    lostReason: copy.advancedSearch.fields.lostReason,
    createdAt: copy.advancedSearch.fields.createdAt,
    updatedAt: copy.advancedSearch.fields.updatedAt,
  };

  // The same dictionary the table's StatusBadge and the board's chips read, so
  // a status reads identically wherever it appears. Keyed by a runtime string,
  // which needs the widening the narrow-union call sites get for free; an
  // unmapped key falls back to the wire value, as StatusBadge does.
  const statusLabels: Record<string, string | undefined> = t.statusValues;

  function enumLabel(field: OpportunityAdvancedFieldId, wireValue: string): string {
    if (field === "status") {
      return statusLabels[`OpportunityStatus.${wireValue}`] ?? wireValue;
    }
    return statusLabels[`OpportunityStageFlag.${wireValue}`] ?? wireValue;
  }

  const pipelineOptions: CrmSearchCatalogueOption[] = useMemo(
    () =>
      pipelines.map((pipeline) => ({
        id: pipeline.id,
        label: localizedName(pipeline, lang),
      })),
    [lang, pipelines],
  );

  // EVERY pipeline's stages, not just the selected one's. The search route
  // carries no pipeline key, so its result set spans every pipeline the actor
  // may read — withholding another pipeline's stages would hide a condition
  // the wire accepts. The pipeline name is prefixed only when there is more
  // than one, because two pipelines may well name a stage the same thing and
  // an ambiguous option is worse than a long one.
  const stageOptions: CrmSearchCatalogueOption[] = useMemo(() => {
    const prefixed = pipelines.length > 1;
    return pipelines.flatMap((pipeline) => {
      const pipelineName = localizedName(pipeline, lang);
      return pipeline.stages.map((stage) => {
        const stageName = localizedName(stage, lang);
        return {
          id: stage.id,
          label: prefixed ? `${pipelineName} — ${stageName}` : stageName,
        };
      });
    });
  }, [lang, pipelines]);

  function catalogueOptions(
    field: OpportunityAdvancedFieldId,
  ): readonly CrmSearchCatalogueOption[] {
    if (field === "pipeline") return pipelineOptions;
    if (field === "stage") return stageOptions;
    return [];
  }

  // The mode toggle and the basic row render in the page action bar; the
  // advanced card renders where this component sits, in the page body. A card
  // that grows to several rows of conditions has nowhere to go in a 45px bar,
  // and the basic row is exactly one row of 28px controls, which is what the
  // bar is sized for.
  return (
    <>
      <PageActions slot="search">
        {advancedEnabled && (
          <Button
            variant={value.mode === "advanced" ? "secondary" : "outline"}
            size="xs"
            disabled={disabled}
            aria-pressed={value.mode === "advanced"}
            aria-label={copy.searchMode.advanced}
            title={`${copy.searchMode.label}: ${copy.searchMode.advanced}`}
            onClick={() =>
              onChange(
                opportunitySearchWithMode(
                  value,
                  value.mode === "advanced" ? "basic" : "advanced",
                ),
              )
            }
          >
            <SlidersHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
            {copy.searchMode.advanced}
          </Button>
        )}

        {value.mode === "basic" && (
          <OpportunityBasicSearch
            key={resetKey}
            state={value}
            pipelines={pipelines}
            disabled={disabled}
            onChange={onChange}
          />
        )}
      </PageActions>

      {value.mode === "advanced" && (
        <CrmAdvancedSearchCard
          fields={OPPORTUNITY_ADVANCED_FIELDS}
          fieldLabels={fieldLabels}
          enumLabel={enumLabel}
          catalogueOptions={catalogueOptions}
          groups={value.groups}
          onGroupsChange={(next) => onChange(opportunitySearchWithGroups(value, next))}
          onSubmit={onSubmit}
          onReset={() => onChange(opportunitySearchCleared(value))}
          disabled={disabled}
          requireFieldSelection
        />
      )}
    </>
  );
}
