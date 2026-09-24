"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { replaceSearchParams } from "./replace-search-params";
import type { SelectionState, SortDirection, SortState } from "../patterns/data-table/types";
import type { RecordWorkspaceView, WorkspaceView } from "./types";
import { RECORD_WORKSPACE_VIEWS, useWorkspaceView } from "./useWorkspaceView";

interface WorkspaceStateOptions<V extends WorkspaceView> {
  // The screen's own view set, in switcher order. The record workspaces omit
  // it and get board/card/table; Activities passes calendar/board/table.
  views?: readonly V[];
  defaultView: NoInfer<V>;
  defaultSort?: SortState;
  // The data hook's own setters. The URL is authoritative, so these fire
  // whenever it disagrees with what this hook last delivered — that is what
  // makes ?page= and ?sort= work on a deep link and a refresh, not only on a
  // click.
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: SortState) => void;
}

export interface WorkspaceState<V extends WorkspaceView = RecordWorkspaceView> {
  view: V;
  setView: (view: V) => void;
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
export function useWorkspaceState(
  screenId: string,
  options: WorkspaceStateOptions<RecordWorkspaceView>,
): WorkspaceState;
export function useWorkspaceState<V extends WorkspaceView>(
  screenId: string,
  options: WorkspaceStateOptions<V> & { views: readonly V[] },
): WorkspaceState<V>;
export function useWorkspaceState<V extends WorkspaceView>(
  screenId: string,
  options: WorkspaceStateOptions<V>,
): WorkspaceState<V> {
  const { views, defaultView, defaultSort, onPageChange, onSortChange } = options;
  const searchParams = useSearchParams();
  // Only the first signature may omit the set, and it fixes V to the record views.
  const [view, setView] = useWorkspaceView<V>(
    screenId,
    defaultView,
    views ?? (RECORD_WORKSPACE_VIEWS as readonly V[]),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const urlPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isSafeInteger(urlPage) && urlPage > 0 ? urlPage : 1;

  const sortId = searchParams.get("sort");
  const sortDirection = parseDirection(searchParams.get("dir"));
  const sort = useMemo<SortState | undefined>(
    () => (sortId ? { id: sortId, direction: sortDirection ?? "asc" } : defaultSort),
    [defaultSort, sortDirection, sortId],
  );

  const setPage = useCallback((next: number) => replaceSearchParams({ page: String(next) }), []);

  // A new sort is a new result set, so it starts at page 1. Changing VIEW
  // never touches either — that is the whole point.
  const setSort = useCallback(
    (next: SortState) => replaceSearchParams({ sort: next.id, dir: next.direction, page: "1" }),
    [],
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
