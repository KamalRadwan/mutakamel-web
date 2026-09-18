"use client";

import { FilterSearchInput } from "@/design-system";
import {
  useOpportunityBasicSearch,
  type OpportunityBasicSearchProps,
} from "../hooks/useOpportunityBasicSearch";

export function OpportunityBasicSearch(props: OpportunityBasicSearchProps) {
  const model = useOpportunityBasicSearch(props);
  return (
    <FilterSearchInput
      query={model.query}
      tokens={model.tokens}
      options={model.options}
      prompt={model.prompt}
      label={model.labels.value}
      placeholder={model.placeholder}
      optionsLabel={model.labels.suggestions}
      toggleLabel={model.labels.toggle}
      emptyLabel={model.emptyLabel}
      clearLabel={model.labels.clear}
      backLabel={model.labels.back}
      removeLabel={model.labels.remove}
      disabled={props.disabled}
      onQueryChange={model.setQuery}
      onSelectOption={model.select}
      onRemoveToken={model.remove}
      onClearPrompt={model.resetDraft}
      onClear={model.clear}
    />
  );
}
