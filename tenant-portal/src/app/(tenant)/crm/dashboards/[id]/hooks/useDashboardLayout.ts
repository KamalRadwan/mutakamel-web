"use client";

import { useEffect, useMemo, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import {
  buildAddPlacementRequest,
  buildLayoutRequest,
  dashboardLayoutPath,
  dashboardPlacementPath,
  dashboardPlacementsPath,
  type DashboardDetail,
} from "../../dashboard-contract";
import {
  movePlacement,
  orderedBoxes,
  packPlacements,
  type PlacementBox,
} from "../../dashboard-layout";
import { isRevisionConflict, type DashboardMutationResult } from "./useDashboardDetail";

const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 2 * 1024 * 1024,
  nonReplayable: true,
} as const;

const IDLE: DashboardMutationResult = { ok: true, conflict: false, error: null };

export function useDashboardLayout(
  dashboardId: string,
  detail: DashboardDetail | null,
  onChanged: () => Promise<void> | void,
) {
  const serverOrder = useMemo(
    () => (detail ? orderedBoxes(detail.placements) : []),
    [detail],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PlacementBox[]>(serverOrder);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPlacementId, setPendingPlacementId] = useState<string | null>(null);

  // The draft follows the server whenever the definition reloads and the
  // editor is closed — never while it is open, which would discard an edit in
  // progress under the user.
  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDraft(serverOrder);
    });
    return () => {
      cancelled = true;
    };
  }, [isEditing, serverOrder]);

  const canEdit = detail?.accessLevel === "OWNER" || detail?.accessLevel === "EDIT";
  const isDirty = draft.map((box) => box.id).join(",") !== serverOrder.map((box) => box.id).join(",");

  function move(id: string, offset: -1 | 1): void {
    const next = movePlacement(draft, id, offset);
    if (next) setDraft(next);
  }

  function reorder(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= draft.length) return;
    const next = [...draft];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setDraft(next);
  }

  async function save(): Promise<DashboardMutationResult> {
    if (!detail) return IDLE;
    setIsSaving(true);
    try {
      // Hidden placements are obstacles, not payload: the server keeps them
      // and still checks the submitted boxes against them for overlap.
      const packed = packPlacements(draft, detail.unavailablePlacements);
      await axiosClient.put<unknown>(
        dashboardLayoutPath(dashboardId),
        buildLayoutRequest(detail.revision, packed),
        WRITE_CONFIG,
      );
      setIsEditing(false);
      await onChanged();
      return IDLE;
    } catch (error) {
      const normalized = normalizeApiError(error);
      return { ok: false, conflict: isRevisionConflict(normalized), error: normalized };
    } finally {
      setIsSaving(false);
    }
  }

  async function addWidget(widgetId: string): Promise<DashboardMutationResult> {
    setIsSaving(true);
    try {
      // Position is left to the server: `addPlacement` places the widget below
      // everything else at its visualization's default size and refuses an
      // overlap, so a client-chosen box could only be a worse guess.
      await axiosClient.post<unknown>(
        dashboardPlacementsPath(dashboardId),
        buildAddPlacementRequest(widgetId),
        WRITE_CONFIG,
      );
      await onChanged();
      return IDLE;
    } catch (error) {
      const normalized = normalizeApiError(error);
      return { ok: false, conflict: false, error: normalized };
    } finally {
      setIsSaving(false);
    }
  }

  async function removePlacement(placementId: string): Promise<DashboardMutationResult> {
    setPendingPlacementId(placementId);
    try {
      // 200, not 204 — the body carries the dashboard's new revision, which
      // the refetch below picks up anyway.
      await axiosClient.delete<unknown>(
        dashboardPlacementPath(dashboardId, placementId),
        WRITE_CONFIG,
      );
      await onChanged();
      return IDLE;
    } catch (error) {
      return { ok: false, conflict: false, error: normalizeApiError(error) };
    } finally {
      setPendingPlacementId(null);
    }
  }

  return {
    canEdit,
    isEditing,
    setIsEditing: (editing: boolean) => {
      setDraft(serverOrder);
      setIsEditing(editing);
    },
    draft,
    isDirty,
    isSaving,
    pendingPlacementId,
    move,
    reorder,
    save,
    addWidget,
    removePlacement,
  };
}
