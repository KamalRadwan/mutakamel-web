"use client";

import { FilterSearchInput } from "@/design-system";
import {
  useCustomerProfileBasicSearch,
  type CustomerProfileBasicSearchProps,
} from "../hooks/useCustomerProfileBasicSearch";

export function CustomerProfileBasicSearch(
  props: CustomerProfileBasicSearchProps,
) {
  const model = useCustomerProfileBasicSearch(props);
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
