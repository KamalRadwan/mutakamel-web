"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SelectionState, SortDirection, SortState } from "../patterns/data-table/types";
import type { WorkspaceView } from "./ViewSwitcher";
import { useWorkspaceView } from "./useWorkspaceView";

interface WorkspaceStateOptions {
  defaultView: WorkspaceView;
  defaultSort?: SortState;
  // The data hook's own setters. The URL is authoritative, so these fire
  // whenever it disagrees with what this hook last delivered — that is what
  // makes ?page= and ?sort= work on a deep link and a refresh, not only on a
  // click.
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: SortState) => void;
}

export interface WorkspaceState {
  view: WorkspaceView;
  setView: (view: WorkspaceView) => void;
  page: number;
  setPage: (page: number) => void;
  sort: SortState | undefined;
  setSort: (sort: SortState) => void;
  selection: SelectionState;
}

function parseDirection(value: string | null): SortDirection | null {
  return value === "asc" || value === "desc" ? value : null;
}

// Everything a workspace holds that is not the data itself: which view, which
// page, which sort, and what is selected — owned once, above the view, so
// switching view cannot drop any of it.
//
// Before this existed only the table had pagination, sorting and selection,
// and a user on page 4 who switched to cards lost both their place and their
// page (V2 in docs/build/MASTER-PLAN.md#05-the-three-views--board--card--table).
//
// Page and sort join `view` in the URL, so a deep link and a refresh land on
// the same screen state. Selection deliberately does NOT: it is a set of ids
// with no bound, and a URL is the wrong place for it. Living in this hook is
// enough for it to survive a view switch, which is what it has to survive.
export function useWorkspaceState(screenId: string, options: WorkspaceStateOptions): WorkspaceState {
  const { defaultView, defaultSort, onPageChange, onSortChange } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useWorkspaceView(screenId, defaultView);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const urlPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isSafeInteger(urlPage) && urlPage > 0 ? urlPage : 1;

  const sortId = searchParams.get("sort");
  const sortDirection = parseDirection(searchParams.get("dir"));
  const sort = useMemo<SortState | undefined>(
    () => (sortId ? { id: sortId, direction: sortDirection ?? "asc" } : defaultSort),
    [defaultSort, sortDirection, sortId],
  );

  const writeParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setPage = useCallback((next: number) => writeParams({ page: String(next) }), [writeParams]);

  // A new sort is a new result set, so it starts at page 1. Changing VIEW
  // never touches either — that is the whole point.
  const setSort = useCallback(
    (next: SortState) => writeParams({ sort: next.id, dir: next.direction, page: "1" }),
    [writeParams],
  );

  const deliveredPage = useRef(1);
  useEffect(() => {
    if (deliveredPage.current === page) return;
    deliveredPage.current = page;
    onPageChange?.(page);
  }, [onPageChange, page]);

  const deliveredSort = useRef(defaultSort);
  useEffect(() => {
    const current = deliveredSort.current;
    if (!sort || (current?.id === sort.id && current.direction === sort.direction)) return;
    deliveredSort.current = sort;
    onSortChange?.(sort);
  }, [onSortChange, sort]);

  const selection = useMemo<SelectionState>(
    () => ({ selectedIds, onSelectionChange: setSelectedIds }),
    [selectedIds],
  );

  return { view, setView, page, setPage, sort, setSort, selection };
}
