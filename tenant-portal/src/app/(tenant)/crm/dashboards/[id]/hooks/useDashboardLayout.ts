"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { buildAddPlacementRequest, buildLayoutRequest, dashboardLayoutPath, dashboardPlacementPath, dashboardPlacementsPath,
  parseDashboardDetailResponse, type DashboardDetail } from "../../dashboard-contract";
import { parseBox, parseWidgetDefinition } from "../../widget-contract";
import { record } from "../../dashboard-parse";
import type { DashboardCatalog } from "../../dashboard-catalog-contract";
import { adjustPlacement, movePlacement, orderedBoxes, packPlacements, placeAtGeometry, type PlacementAdjustment, type PlacementGeometry } from "../../dashboard-layout";
import { dashboardWriteDenied, invalidDashboardReceipt, uncertainDashboardWrite, useDashboardSafety } from "../../hooks/useDashboardSafety";
import { isRevisionConflict, type DashboardMutationResult } from "./useDashboardDetail";

const WRITE_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024, nonReplayable: true } as const;
export function useDashboardLayout(dashboardId: string, detail: DashboardDetail | null, onChanged: () => Promise<boolean> | Promise<void> | void,
  catalog?: DashboardCatalog | null) {
  const { user } = useTenantAuth();
  const safety = useDashboardSafety(`dashboard:${dashboardId}`);
  const serverOrder = useMemo(() => detail?.id === dashboardId ? orderedBoxes(detail.placements) : [], [detail, dashboardId]);
  const [editing, setEditing] = useState(false);
  const revision = detail?.revision ?? null;
  const [draftState, setDraft] = useState({ scope: safety.scope, boxes: serverOrder, revision });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingPlacementId, setPendingPlacementId] = useState<string | null>(null);
  const draft = draftState.scope === safety.scope ? draftState.boxes : serverOrder;
  const selected = draft.find((box) => box.id === selectedId) ?? draft[0];
  const hasEditAccess = detail?.id === dashboardId && (detail.accessLevel === "OWNER" || detail.accessLevel === "EDIT");
  const hasUpdatePermission = Boolean(user?.isTenantOwner || hasPermission(user?.permissions ?? [], "crm.dashboards.update"));
  const hasAuthority = Boolean(hasEditAccess && safety.canMutate && hasUpdatePermission);
  const canEdit = hasAuthority && !safety.blocked;
  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setDraft({ scope: safety.scope, boxes: serverOrder, revision }); });
    return () => { cancelled = true; };
  }, [editing, safety.scope, serverOrder, revision]);
  function move(id: string, offset: -1 | 1) {
    if (!canEdit || safety.busy || !detail) return;
    const next = movePlacement(draft, id, offset);
    if (next) setDraft({ ...draftState, boxes: packPlacements(next, detail.unavailablePlacements) });
  }
  function reorder(fromIndex: number, toIndex: number) {
    if (!canEdit || safety.busy || !detail || fromIndex === toIndex || fromIndex < 0 || fromIndex >= draft.length || toIndex < 0 || toIndex >= draft.length) return;
    const next = [...draft]; const [moved] = next.splice(fromIndex, 1); next.splice(toIndex, 0, moved);
    setDraft({ ...draftState, boxes: packPlacements(next, detail.unavailablePlacements) });
  }
  function placementBounds(id: string) {
    if (!canEdit || safety.busy || !detail || draftState.scope !== safety.scope) return null;
    const widget = detail.placements.find((placement) => placement.id === id)?.widget;
    const capability = catalog?.visualizations.find(({ key }) => key === widget?.visualizationType);
    const { minW, maxW, minH, maxH } = capability ?? {};
    if (minW === undefined || maxW === undefined || minH === undefined || maxH === undefined) return null;
    return { minW, maxW, minH, maxH };
  }
  function adjusted(id: string, adjustment: PlacementAdjustment) {
    const bounds = placementBounds(id);
    return bounds && detail ? adjustPlacement(draft, detail.unavailablePlacements, id, adjustment, bounds) : null;
  }
  function positioned(id: string, geometry: PlacementGeometry) {
    const bounds = placementBounds(id);
    return bounds && detail ? placeAtGeometry(draft, detail.unavailablePlacements, id, geometry, bounds) : null;
  }
  function adjust(id: string, adjustment: PlacementAdjustment) {
    const next = adjusted(id, adjustment);
    if (next) setDraft({ ...draftState, boxes: next });
  }
  function position(id: string, geometry: PlacementGeometry) {
    const next = positioned(id, geometry);
    if (next) setDraft({ ...draftState, boxes: next });
  }
  async function write(call: () => Promise<{ data: unknown }>, validate: (data: unknown) => void, placementId: string | null = null): Promise<DashboardMutationResult> {
    const ticket = safety.beginWrite(hasAuthority);
    if (!ticket) return hasAuthority ? { ok: false, conflict: false, error: null, ignored: true } : { ok: false, conflict: false, error: dashboardWriteDenied() };
    setIsSaving(true); setPendingPlacementId(placementId);
    try {
      const response = await call(); validate(response.data);
      if (!safety.currentWrite(ticket)) return { ok: false, conflict: false, error: null, ignored: true };
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (uncertainDashboardWrite(normalized)) safety.fence(ticket);
      if (!safety.currentWrite(ticket)) return { ok: false, conflict: false, error: null, ignored: true };
      return { ok: false, conflict: isRevisionConflict(normalized), error: normalized };
    } finally { safety.finish(ticket); setIsSaving(false); setPendingPlacementId(null); }
    const refreshed = await onChanged();
    if (!safety.isScopeCurrent()) return { ok: false, conflict: false, error: null, ignored: true };
    if (refreshed !== false) setEditing(false);
    return { ok: true, conflict: false, error: null, refreshFailed: refreshed === false };
  }
  async function save(): Promise<DashboardMutationResult> {
    const expectedRevision = draftState.revision;
    if (!detail || !editing || draftState.scope !== safety.scope || expectedRevision === null) return { ok: false, conflict: false, error: null };
    const submitted = draft;
    return write(() => axiosClient.put<unknown>(dashboardLayoutPath(dashboardId), buildLayoutRequest(expectedRevision, submitted), WRITE_CONFIG), (data) => {
      const receipt = parseDashboardDetailResponse(data);
      if (receipt.id !== dashboardId || receipt.revision <= expectedRevision || receipt.placements.length !== submitted.length
        || submitted.some((box) => !receipt.placements.some((p) => p.id === box.id && p.x === box.x && p.y === box.y && p.width === box.width && p.height === box.height))) invalidDashboardReceipt();
    });
  }
  async function addWidget(widgetId: string): Promise<DashboardMutationResult> {
    if (!detail || detail.placements.length + detail.unavailablePlacements.length >= 20 || detail.placements.some((p) => p.widgetId === widgetId)) return { ok: false, conflict: false, error: { status: 422, code: "CRM_DASHBOARD_WIDGET_LIMIT" } };
    return write(() => axiosClient.post<unknown>(dashboardPlacementsPath(dashboardId), buildAddPlacementRequest(widgetId), WRITE_CONFIG), (data) => {
      const receipt = record(data);
      if (!receipt || !isUUIDv7(receipt.id) || receipt.dashboardId !== dashboardId || receipt.widgetId !== widgetId || !parseBox(receipt)
        || !Number.isInteger(receipt.dashboardRevision) || Number(receipt.dashboardRevision) <= detail.revision || parseWidgetDefinition(receipt.widget).id !== widgetId) invalidDashboardReceipt();
    });
  }
  async function removePlacement(id: string): Promise<DashboardMutationResult> {
    if (!detail?.placements.some((p) => p.id === id)) return { ok: false, conflict: false, error: { status: 404, code: "CRM_DASHBOARD_PLACEMENT_NOT_FOUND" } };
    return write(() => axiosClient.delete<unknown>(dashboardPlacementPath(dashboardId, id), WRITE_CONFIG), (data) => {
      const receipt = record(data);
      if (!receipt || !Number.isInteger(receipt.dashboardRevision) || Number(receipt.dashboardRevision) <= detail.revision) invalidDashboardReceipt();
    }, id);
  }
  return { canEdit, editPermissionMissing: Boolean(hasEditAccess && !hasUpdatePermission), readOnly: Boolean(hasEditAccess && !safety.canMutate),
    isEditing: editing && draftState.scope === safety.scope && Boolean(hasEditAccess),
    setIsEditing: (value: boolean) => {
      if (safety.busy || (value && !canEdit)) return;
      setDraft({ scope: safety.scope, boxes: serverOrder, revision }); setSelectedId(null); setEditing(value);
    },
    draft, selected, select: setSelectedId, isDirty: JSON.stringify(draft) !== JSON.stringify(serverOrder),
    isSaving, pendingPlacementId, move, reorder, adjust, canAdjust: (id: string, adjustment: PlacementAdjustment) => adjusted(id, adjustment) !== null,
    position, canPosition: (id: string, geometry: PlacementGeometry) => positioned(id, geometry) !== null,
    save, addWidget, removePlacement };
}

