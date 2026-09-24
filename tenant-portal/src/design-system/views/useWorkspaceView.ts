"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { safeStorage } from "@/lib/safeStorage";
import { replaceSearchParams } from "./replace-search-params";
import type { RecordWorkspaceView, WorkspaceView } from "./types";

export const RECORD_WORKSPACE_VIEWS: readonly RecordWorkspaceView[] = ["board", "card", "table"];

// URL is the source of truth (?view=), so a deep link and a refresh land on
// the same view. On mount with no ?view param, restores from
// localStorage["tenant_view_<screen>"], else falls back to defaultView.
// Storage reads/writes go through safeStorage and must survive a throwing
// or absent localStorage. See docs/design/views.md#view-state.
//
// A value is honoured only if the screen offers that view, so a link or a
// stored preference naming one it does not falls back like any unknown value.
// The record workspaces name no set and get board/card/table; a screen with
// its own set passes it, and the returned view is typed to it.
export function useWorkspaceView(
  screenId: string,
  defaultView: RecordWorkspaceView,
): [RecordWorkspaceView, (next: RecordWorkspaceView) => void];
export function useWorkspaceView<V extends WorkspaceView>(
  screenId: string,
  defaultView: NoInfer<V>,
  views: readonly V[],
): [V, (next: V) => void];
export function useWorkspaceView<V extends WorkspaceView>(
  screenId: string,
  defaultView: V,
  // Only the first signature omits the set, and it fixes V to the record views.
  views: readonly V[] = RECORD_WORKSPACE_VIEWS as readonly V[],
): [V, (next: V) => void] {
  const searchParams = useSearchParams();
  const storageKey = `tenant_view_${screenId}`;

  const urlView = searchParams.get("view");
  const view = useMemo<V>(() => {
    const offered = (value: string | null) => views.find((candidate) => candidate === value);
    return offered(urlView) ?? offered(safeStorage.getItem(storageKey)) ?? defaultView;
  }, [urlView, storageKey, defaultView, views]);

  const setView = useCallback(
    (next: V) => {
      safeStorage.setItem(storageKey, next);
      replaceSearchParams({ view: next });
    },
    [storageKey],
  );

  return [view, setView];
}
