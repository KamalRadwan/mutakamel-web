"use client";

import { useState } from "react";
import type { FilterSearchOption, FilterSearchToken } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import {
  EMPTY_OPPORTUNITY_BASIC_SEARCH,
  MAX_OPPORTUNITY_SEARCH_TAGS,
  OPPORTUNITY_SEARCH_FIELDS,
  addOpportunityBasicFilter,
  opportunityBasicFilterId,
  opportunitySearchField,
  removeOpportunityBasicFilter,
  type OpportunityBasicSearch,
  type OpportunitySearchFieldId,
} from "../opportunity-basic-search-contract";
import {
  opportunitySearchWithBasic,
  type OpportunitySearchState,
} from "../opportunity-search-contract";
import type { OpportunityPipeline } from "./pipeline-types";
import { useOpportunityTags } from "./useOpportunityTags";

export interface OpportunityBasicSearchProps {
  state: OpportunitySearchState;
  pipelines: OpportunityPipeline[];
  disabled?: boolean;
  onChange: (next: OpportunitySearchState) => void;
}

export function useOpportunityBasicSearch({
  state,
  pipelines,
  onChange,
}: OpportunityBasicSearchProps) {
  const { t, lang } = useI18n();
  const labels = t.crmOpportunities.basicSearch;
  const tags = useOpportunityTags(true);
  const [query, setQuery] = useState("");
  const [field, setField] = useState<OpportunitySearchFieldId | null>(null);
  const fieldLabels: Record<OpportunitySearchFieldId, string> = {
    ...labels.fields,
    pipeline: t.crmOpportunities.pipeline,
    stage: t.crmOpportunities.stage,
  };
  const term = query.trim();
  const matches = (value: string) =>
    value.toLocaleLowerCase(lang).includes(term.toLocaleLowerCase(lang));

  function valuesFor(id: OpportunitySearchFieldId): FilterSearchOption[] {
    if (id === "tag") {
      return tags.items.map((tag) => ({ id: tag.id, label: tag.name }));
    }
    if (id === "pipeline") {
      return pipelines.map((pipeline) => ({
        id: pipeline.id,
        label: localizedName(pipeline, lang),
      }));
    }
    if (id === "stage") {
      const prefixPipeline = pipelines.length > 1;
      return pipelines.flatMap((pipeline) =>
        pipeline.stages.map((stage) => ({
          id: stage.id,
          label: prefixPipeline
            ? `${localizedName(pipeline, lang)} — ${localizedName(stage, lang)}`
            : localizedName(stage, lang),
        })),
      );
    }
    const statuses: Record<string, string | undefined> = t.statusValues;
    return (opportunitySearchField(id).values ?? []).map((value) => ({
      id: value,
      label:
        statuses[
          `${id === "status" ? "OpportunityStatus" : "OpportunityStageFlag"}.${value}`
        ] ?? labels.valueUnavailable,
    }));
  }

  const tokens: FilterSearchToken[] = [
    ...(state.basic.myOpportunities
      ? [{ id: "my-opportunities", label: labels.myOpportunities, kind: "filter" as const }]
      : []),
    ...state.basic.filters.map((filter) => ({
      id: opportunityBasicFilterId(filter),
      label: fieldLabels[filter.field],
      kind: "field" as const,
      value:
        opportunitySearchField(filter.field).kind === "text"
          ? filter.value
          : valuesFor(filter.field).find((entry) => entry.id === filter.value)?.label ??
            labels.valueUnavailable,
    })),
  ];

  function suggestion(id: OpportunitySearchFieldId, expandable: boolean): FilterSearchOption {
    const currentText = state.basic.filters.find(
      (filter) => opportunitySearchField(filter.field).kind === "text",
    )?.value;
    return {
      id,
      label: term ? labels.searchFor(fieldLabels[id], term) : fieldLabels[id],
      expandable,
      ...(term
        ? {
            search: {
              prefix: labels.searchPrefix,
              field: fieldLabels[id],
              connector: labels.searchConnector,
              value: term,
            },
          }
        : {}),
      description:
        opportunitySearchField(id).kind === "text" && currentText && currentText !== term
          ? labels.replaceTextHint
          : undefined,
    };
  }

  const selectedTagCount = state.basic.filters.filter(({ field: id }) => id === "tag").length;
  const availableFields = OPPORTUNITY_SEARCH_FIELDS.filter(
    (entry) => entry.id !== "tag" || (tags.canRead && selectedTagCount < MAX_OPPORTUNITY_SEARCH_TAGS),
  );
  let options: FilterSearchOption[];
  if (field && opportunitySearchField(field).kind === "text") {
    options = term ? [{ ...suggestion(field, false), id: `${field}-value` }] : [];
  } else if (field) {
    options = valuesFor(field).filter(
      (entry) =>
        matches(entry.label) &&
        !state.basic.filters.some(
          (filter) => filter.field === field && filter.value === entry.id,
        ),
    );
  } else {
    options = [
      ...(!state.basic.myOpportunities && (!term || matches(labels.myOpportunities))
        ? [
            {
              id: "my-opportunities",
              label: labels.myOpportunities,
              description: labels.myOpportunitiesHint,
            },
          ]
        : []),
      ...availableFields.map((entry) => suggestion(entry.id, entry.kind !== "text")),
    ];
  }

  function change(basic: OpportunityBasicSearch) {
    onChange(opportunitySearchWithBasic(state, basic));
  }

  function resetDraft() {
    setQuery("");
    setField(null);
  }

  function select(id: string) {
    if (!field && id === "my-opportunities") {
      change({ ...state.basic, myOpportunities: true });
      resetDraft();
      return;
    }
    if (field) {
      const definition = opportunitySearchField(field);
      const value = definition.kind === "text" ? term : id;
      let next = state.basic;
      if (field === "pipeline") {
        const validStageIds = new Set(
          pipelines.find((pipeline) => pipeline.id === value)?.stages.map((stage) => stage.id) ?? [],
        );
        next = {
          ...next,
          filters: next.filters.filter(
            (filter) => filter.field !== "stage" || validStageIds.has(filter.value),
          ),
        };
      }
      if (field === "stage") {
        const owner = pipelines.find((pipeline) =>
          pipeline.stages.some((stage) => stage.id === value),
        );
        if (owner) {
          next = addOpportunityBasicFilter(next, {
            field: "pipeline",
            value: owner.id,
          });
        }
      }
      change(addOpportunityBasicFilter(next, { field, value }));
      resetDraft();
      return;
    }
    const selected = OPPORTUNITY_SEARCH_FIELDS.find((entry) => entry.id === id);
    if (!selected) return;
    if (selected.kind === "text" && term) {
      change(addOpportunityBasicFilter(state.basic, { field: selected.id, value: term }));
      resetDraft();
      return;
    }
    setField(selected.id);
    if (
      selected.kind !== "text" &&
      !valuesFor(selected.id).some((entry) => matches(entry.label))
    ) {
      setQuery("");
    }
  }

  return {
    labels,
    query,
    tokens,
    options,
    prompt: field ? fieldLabels[field] : undefined,
    placeholder: field ? labels.chooseValue : t.common.search,
    emptyLabel:
      field === "tag" && tags.degraded
        ? labels.catalogueUnavailable
        : field && opportunitySearchField(field).kind === "text"
          ? labels.typeValue
          : labels.noMatches,
    setQuery,
    select,
    resetDraft,
    remove(id: string) {
      change(removeOpportunityBasicFilter(state.basic, id));
    },
    clear() {
      change(EMPTY_OPPORTUNITY_BASIC_SEARCH);
      resetDraft();
    },
  };
}
