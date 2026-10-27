"use client";

import { useCallback, useState } from "react";
import { INVENTORY_LIST_LIMIT } from "../inventory-governance-contract";

/** Scope and server filters own a page position; changing either starts at page 1. */
export function useInventoryPagination(queryKey: string) {
  const [position, setPosition] = useState({ queryKey, page: 1, total: 0 });
  const current = position.queryKey === queryKey
    ? position
    : { queryKey, page: 1, total: 0 };
  const setPage = useCallback((page: number) => {
    setPosition((previous) => ({
      queryKey,
      page,
      total: previous.queryKey === queryKey ? previous.total : 0,
    }));
  }, [queryKey]);
  const setTotal = useCallback((total: number) => {
    setPosition((previous) => ({
      queryKey,
      page: previous.queryKey === queryKey ? previous.page : 1,
      total,
    }));
  }, [queryKey]);
  return {
    page: current.page,
    pagination: { page: current.page, total: current.total, limit: INVENTORY_LIST_LIMIT },
    setPage,
    setTotal,
  };
}
