"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { ComboboxOption } from "../Combobox";

export function useNameSelect(options: readonly ComboboxOption[], value?: string) {
  const { lang } = useI18n();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase(lang);
  return {
    selectedLabel: options.find((option) => option.value === value)?.label,
    options: options.filter((option) => option.label.toLocaleLowerCase(lang).includes(normalized))
      .map(({ value: optionValue, label, disabled }) => ({ value: optionValue, label, disabled })),
    search: setQuery,
    resetSearch: () => setQuery(""),
  };
}
