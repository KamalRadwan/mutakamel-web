"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUUIDv7 } from "@/lib/uuid";
import type { ActiveStatus } from "../../../core-validation";
import {
  TAX_PAGE_SIZE,
  TAX_PAGE_SIZE_OPTIONS,
  TAX_SORT_FIELDS,
  buildTaxesListQuery,
  type TaxSortField,
} from "../tax-contract";

const SEARCH_DEBOUNCE_MS = 300;

export function useTaxListFilters() {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(TAX_PAGE_SIZE);
  const [statusFilter, setStatusFilterState] = useState<ActiveStatus | undefined>(undefined);
  const [companyFilter, setCompanyFilterState] = useState<string | undefined>(undefined);
  const [isScopeSelectOpen, setIsScopeSelectOpen] = useState(false);
  const [inclusiveFilter, setInclusiveFilterState] = useState<boolean | undefined>(undefined);
  const [searchInput, setSearchInputState] = useState("");
  const [appliedSearch, setAppliedSearchState] = useState("");
  const [sort, setSortState] = useState<{ id: TaxSortField; direction: "asc" | "desc" }>({
    id: "code",
    direction: "asc",
  });

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchDebounceRef.current), []);

  const currentQuery = buildTaxesListQuery({
    page,
    limit: pageSize,
    status: statusFilter,
    companyId: companyFilter,
    isInclusive: inclusiveFilter,
    search: appliedSearch,
    sortBy: sort.id,
    sortDir: sort.direction === "asc" ? "ASC" : "DESC",
  });

  const setSearch = useCallback((next: string) => {
    setSearchInputState(next);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPageState(1);
      setAppliedSearchState(next);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const setStatusFilter = useCallback((next: ActiveStatus | undefined) => {
    setPageState(1);
    setStatusFilterState(next);
  }, []);

  const setCompanyFilter = useCallback((next: string | undefined) => {
    if (next !== undefined && !isUUIDv7(next)) return;
    setPageState(1);
    setCompanyFilterState(next);
  }, []);

  const setInclusiveFilter = useCallback((next: boolean | undefined) => {
    setPageState(1);
    setInclusiveFilterState(next);
  }, []);

  const clearAllFilters = useCallback(() => {
    clearTimeout(searchDebounceRef.current);
    setPageState(1);
    setStatusFilterState(undefined);
    setCompanyFilterState(undefined);
    setInclusiveFilterState(undefined);
    setSearchInputState("");
    setAppliedSearchState("");
  }, []);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = TAX_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    setSortState({ id: field, direction: next.direction });
    setPageState(1);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1) return;
    setPageState(nextPage);
  }, []);

  const setPageSize = useCallback(
    (nextSize: number) => {
      if (!TAX_PAGE_SIZE_OPTIONS.some((allowed) => allowed === nextSize)) return;
      if (nextSize === pageSize) return;
      setPageState(1);
      setPageSizeState(nextSize);
    },
    [pageSize],
  );

  const hasActiveFilters = Boolean(
    statusFilter !== undefined ||
      companyFilter !== undefined ||
      inclusiveFilter !== undefined ||
      searchInput.trim() ||
      appliedSearch.trim(),
  );

  return {
    page,
    pageSize,
    statusFilter,
    companyFilter,
    isScopeSelectOpen,
    inclusiveFilter,
    search: searchInput,
    sort,
    currentQuery,
    hasActiveFilters,
    setPage,
    setPageSize,
    setStatusFilter,
    setCompanyFilter,
    setIsScopeSelectOpen,
    setInclusiveFilter,
    setSearch,
    setSort,
    clearAllFilters,
  };
}
