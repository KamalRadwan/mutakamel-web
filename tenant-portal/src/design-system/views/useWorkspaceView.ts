"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { safeStorage } from "@/lib/safeStorage";
import type { WorkspaceView } from "./ViewSwitcher";

const VALID_VIEWS: readonly WorkspaceView[] = ["board", "card", "table"];

function isWorkspaceView(value: string | null): value is WorkspaceView {
  return value !== null && (VALID_VIEWS as readonly string[]).includes(value);
}

// URL is the source of truth (?view=), so a deep link and a refresh land on
// the same view. On mount with no ?view param, restores from
// localStorage["tenant_view_<screen>"], else falls back to defaultView.
// Storage reads/writes go through safeStorage and must survive a throwing
// or absent localStorage. See docs/design/views.md#view-state.
export function useWorkspaceView(screenId: string, defaultView: WorkspaceView): [WorkspaceView, (next: WorkspaceView) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `tenant_view_${screenId}`;

  const urlView = searchParams.get("view");
  const view = useMemo<WorkspaceView>(() => {
    if (isWorkspaceView(urlView)) return urlView;
    const stored = safeStorage.getItem(storageKey);
    return isWorkspaceView(stored) ? stored : defaultView;
  }, [urlView, storageKey, defaultView]);

  const setView = useCallback(
    (next: WorkspaceView) => {
      safeStorage.setItem(storageKey, next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, storageKey],
  );

  return [view, setView];
}
