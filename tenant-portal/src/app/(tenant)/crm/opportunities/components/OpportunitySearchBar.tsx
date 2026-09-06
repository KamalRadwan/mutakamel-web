"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import {
  Input,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  CrmAdvancedSearchCard,
  type CrmSearchCatalogueOption,
} from "../../shared/components/CrmAdvancedSearchCard";
import {
  OPPORTUNITY_ADVANCED_FIELDS,
  opportunitySearchCleared,
  opportunitySearchWithBasicText,
  opportunitySearchWithGroups,
  opportunitySearchWithMode,
  opportunitySearchWithText,
  type OpportunityAdvancedFieldId,
  type OpportunitySearchMode,
  type OpportunitySearchState,
} from "../opportunity-search-contract";
import type { OpportunityPipeline } from "../hooks/pipeline-types";

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
            if (next) onChange(opportunitySearchWithMode(value, next as OpportunitySearchMode));
          }}
          aria-label={copy.searchMode.label}
        >
          <ToggleGroupItem value="basic">{copy.searchMode.basic}</ToggleGroupItem>
          <ToggleGroupItem value="advanced">{copy.searchMode.advanced}</ToggleGroupItem>
        </ToggleGroup>

        {value.mode === "basic" && (
          <div className="relative w-72">
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
              value={value.basic.text}
              disabled={disabled}
              // The wire's `@MaxLength(200)`, so a paste is clamped where it
              // happens rather than rejected as a whole request.
              maxLength={200}
              placeholder={t.common.search}
              aria-label={t.crmAdvancedSearch.textLabel}
              onChange={(event) =>
                onChange(opportunitySearchWithBasicText(value, event.target.value))
              }
            />
          </div>
        )}
      </div>

      {value.mode === "advanced" && (
        <CrmAdvancedSearchCard
          fields={OPPORTUNITY_ADVANCED_FIELDS}
          fieldLabels={fieldLabels}
          enumLabel={enumLabel}
          catalogueOptions={catalogueOptions}
          // This screen's free text is `title ILIKE` and nothing else — the
          // repository's searchableFields holds only 'title' — so the shared
          // hint about names, phones and emails would be wrong here.
          textHint={t.crmAdvancedSearch.textHintTitleOnly}
          text={value.text}
          onTextChange={(next) => onChange(opportunitySearchWithText(value, next))}
          groups={value.groups}
          onGroupsChange={(next) => onChange(opportunitySearchWithGroups(value, next))}
          onSubmit={onSubmit}
          onReset={() => onChange(opportunitySearchCleared(value))}
          disabled={disabled}
        />
      )}
    </div>
  );
}
