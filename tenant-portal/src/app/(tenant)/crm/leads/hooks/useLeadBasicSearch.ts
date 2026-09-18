"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import type { FilterSearchOption, FilterSearchToken } from "@/design-system";
import { useCrmAcquisitionSources } from "../../shared/hooks/useCrmAcquisitionSources";
import {
  LEAD_BASIC_SEARCH_VISIBLE_FIELDS,
  EMPTY_LEAD_BASIC_SEARCH,
  MAX_LEAD_SEARCH_TAGS,
  addLeadBasicFilter,
  leadBasicFilterId,
  leadSearchField,
  removeLeadBasicFilter,
  type LeadBasicSearch,
  type LeadSearchFieldId,
} from "../lead-basic-search-contract";
import type { LeadSearchState } from "../lead-search-contract";
import { useCreateLeadTags } from "./useCreateLeadTags";
import type { LeadStage } from "./useLeads";

export interface LeadBasicSearchProps {
  state: LeadSearchState;
  stages: LeadStage[];
  disabled?: boolean;
  onChange: (next: LeadSearchState) => void;
}

export function useLeadBasicSearch({ state, stages, onChange }: LeadBasicSearchProps) {
  const { t, lang } = useI18n();
  const labels = t.crmLeads.basicSearch;
  const { items: sources, degraded: sourcesDegraded } = useCrmAcquisitionSources();
  const tags = useCreateLeadTags(true);
  const [query, setQuery] = useState("");
  const [field, setField] = useState<LeadSearchFieldId | null>(null);
  const fieldLabels: Record<LeadSearchFieldId, string> = {
    ...labels.fields,
    leadType: t.crmLeads.advancedSearch.fields.leadType,
    stage: t.crmLeads.stage,
    source: t.crmLeads.source,
  };
  const term = query.trim();
  const matches = (value: string) => value.toLocaleLowerCase(lang).includes(term.toLocaleLowerCase(lang));

  function valuesFor(id: LeadSearchFieldId): FilterSearchOption[] {
    if (id === "stage" || id === "source") {
      return (id === "stage" ? stages : sources).map((entry) => ({
        id: entry.id,
        label: localizedName(entry, lang),
      }));
    }
    if (id === "tag") {
      return tags.items.map((tag) => ({ id: tag.id, label: tag.name }));
    }
    const statuses: Record<string, string | undefined> = t.statusValues;
    const types: Record<string, string | undefined> = t.crmLeads.create.types;
    return (leadSearchField(id).values ?? []).map((value) => ({
      id: value,
      label: (id === "leadType"
        ? types[value]
        : statuses[`${id === "status" ? "LeadStatus" : "LeadStageFlag"}.${value}`]) ?? labels.valueUnavailable,
    }));
  }

  const tokens: FilterSearchToken[] = [
    ...(state.basic.myLeads ? [{ id: "my-leads", label: labels.myLeads, kind: "filter" as const }] : []),
    ...state.basic.filters.map((filter) => ({
      id: leadBasicFilterId(filter),
      label: fieldLabels[filter.field],
      kind: "field" as const,
      value: leadSearchField(filter.field).kind === "text"
        ? filter.value
        : valuesFor(filter.field).find((entry) => entry.id === filter.value)?.label ?? labels.valueUnavailable,
    })),
  ];

  function suggestion(id: LeadSearchFieldId, expandable: boolean): FilterSearchOption {
    const currentText = state.basic.filters.find((filter) => leadSearchField(filter.field).kind === "text")?.value;
    return {
      id,
      label: term ? labels.searchFor(fieldLabels[id], term) : fieldLabels[id],
      expandable,
      ...(term ? {
        search: {
          prefix: labels.searchPrefix,
          field: fieldLabels[id],
          connector: labels.searchConnector,
          value: term,
        },
      } : {}),
      description: leadSearchField(id).kind === "text" && currentText && currentText !== term
        ? labels.replaceTextHint
        : undefined,
    };
  }

  const selectedTagCount = state.basic.filters.filter((filter) => filter.field === "tag").length;
  const availableFields = LEAD_BASIC_SEARCH_VISIBLE_FIELDS.filter((entry) =>
    (entry.id !== "tag" || (tags.canRead && selectedTagCount < MAX_LEAD_SEARCH_TAGS)),
  );
  let options: FilterSearchOption[];
  if (field && leadSearchField(field).kind === "text") {
    options = term ? [{ ...suggestion(field, false), id: `${field}-value` }] : [];
  } else if (field) {
    options = valuesFor(field).filter((entry) =>
      matches(entry.label) &&
      !state.basic.filters.some((filter) => filter.field === field && filter.value === entry.id),
    );
  } else {
    options = [
      ...(!state.basic.myLeads && (!term || matches(labels.myLeads))
        ? [{ id: "my-leads", label: labels.myLeads, description: labels.myLeadsHint }]
        : []),
      ...availableFields.map((entry) => suggestion(entry.id, entry.kind !== "text")),
    ];
  }

  function change(basic: LeadBasicSearch) {
    onChange({ ...state, mode: "basic", basic });
  }

  function resetDraft() {
    setQuery("");
    setField(null);
  }

  function select(id: string) {
    if (!field && id === "my-leads") {
      change({ ...state.basic, myLeads: true });
      resetDraft();
      return;
    }
    if (field) {
      const definition = leadSearchField(field);
      change(addLeadBasicFilter(state.basic, {
        field,
        value: definition.kind === "text" ? term : id,
      }));
      resetDraft();
      return;
    }
    const selected = LEAD_BASIC_SEARCH_VISIBLE_FIELDS.find((entry) => entry.id === id);
    if (!selected) return;
    if (selected.kind === "text" && term) {
      change(addLeadBasicFilter(state.basic, { field: selected.id, value: term }));
      resetDraft();
      return;
    }
    setField(selected.id);
    if (selected.kind !== "text" && !valuesFor(selected.id).some((entry) => matches(entry.label))) {
      setQuery("");
    }
  }

  const catalogueUnavailable =
    (field === "source" && sourcesDegraded) ||
    (field === "tag" && tags.degraded);

  return {
    labels,
    query,
    tokens,
    options,
    prompt: field ? fieldLabels[field] : undefined,
    placeholder: field ? labels.chooseValue : t.crmLeads.search,
    emptyLabel: catalogueUnavailable
      ? labels.catalogueUnavailable
      : field && leadSearchField(field).kind === "text"
        ? labels.typeValue
        : labels.noMatches,
    setQuery,
    select,
    resetDraft,
    remove(id: string) { change(removeLeadBasicFilter(state.basic, id)); },
    clear() { change(EMPTY_LEAD_BASIC_SEARCH); resetDraft(); },
  };
}
