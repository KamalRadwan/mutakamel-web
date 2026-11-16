"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

interface UseNumberingToolbarSearchOptions {
  readonly searchValue: string;
  readonly onSearchChange: (next: string) => void;
  readonly onReset: () => void;
}

export function useNumberingToolbarSearch({
  searchValue,
  onSearchChange,
  onReset,
}: UseNumberingToolbarSearchOptions) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [syncedSearch, setSyncedSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (searchValue !== syncedSearch) {
    setSyncedSearch(searchValue);
    setLocalSearch(searchValue);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSearchInput = useCallback(
    (next: string) => {
      setLocalSearch(next);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearchChange(next), SEARCH_DEBOUNCE_MS);
    },
    [onSearchChange],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    setLocalSearch("");
    onSearchChange("");
  }, [onSearchChange]);

  const handleReset = useCallback(() => {
    clearTimeout(debounceRef.current);
    setLocalSearch("");
    onReset();
  }, [onReset]);

  return {
    localSearch,
    handleSearchInput,
    clearSearch,
    handleReset,
  };
}
