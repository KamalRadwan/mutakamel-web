"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { buildDashboardBlueprintAdoption, dashboardBlueprintsPath, parseDashboardBlueprintReceipt,
  parseDashboardBlueprintsResponse, type DashboardBlueprint } from "../dashboard-blueprint-contract";
import { dashboardPath, parseDashboardDetailResponse, DASHBOARD_NAME_MAX_LENGTH } from "../dashboard-contract";
import { invalidDashboardReceipt, uncertainDashboardWrite, useDashboardSafety } from "./useDashboardSafety";

const READ = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
const WRITE = { ...READ, nonReplayable: true } as const;
type BranchSelection = { scope: object; branchId: string | null };
type ReadState = BranchSelection & { items: DashboardBlueprint[]; error: NormalizedApiError | null };
type Review = BranchSelection & { key: string; revision: number; name: string; confirmed: boolean; error?: NormalizedApiError };

export function useDashboardBlueprints(enabled: boolean, navigate: (id: string) => void) {
  const { user } = useTenantAuth();
  const { t } = useI18n();
  const toast = useToast();
  const safety = useDashboardSafety("blueprints");
  const { scope, startRead, currentRead, readSettled, readSucceeded, beginWrite, currentWrite, fence, finish } = safety;
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<BranchSelection | null>(null);
  const [settled, setSettled] = useState<ReadState | null>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<AbortController | null>(null);
  const branchIds = useMemo(() => (user?.accessibleBranches ?? []).filter(isUUIDv7).map(id => id.toLowerCase()), [user?.accessibleBranches]);
  const branchId = selection?.scope === scope && selection.branchId && branchIds.includes(selection.branchId) ? selection.branchId : null;
  const current = settled?.scope === scope && settled.branchId === branchId ? settled : null;
  const items = current?.items ?? [];
  const selected = review?.scope === scope && review.branchId === branchId
    ? items.find(item => item.key === review.key && item.definitionRevision === review.revision
      && item.adoption.state === "AVAILABLE" && !item.branchSelectionRequired)
    : undefined;
  const activeReview = selected ? review : null;

  const reload = useCallback(async (signal?: AbortSignal) => {
    const ticket = enabled ? startRead() : null;
    if (!ticket) return false;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    setLoading(true);
    try {
      const response = await axiosClient.get<unknown>(dashboardBlueprintsPath(branchId), { ...READ, signal: controller.signal });
      if (controller.signal.aborted || !currentRead(ticket)) return false;
      const next = parseDashboardBlueprintsResponse(response.data);
      setSettled({ scope, branchId, items: next, error: null });
      readSucceeded();
      return true;
    } catch (error) {
      if (!controller.signal.aborted && currentRead(ticket)) setSettled({ scope, branchId, items: [], error: normalizeApiError(error) });
      return false;
    } finally {
      if (!controller.signal.aborted && readSettled(ticket)) setLoading(false);
    }
  }, [enabled, scope, branchId, startRead, currentRead, readSettled, readSucceeded]);

  useEffect(() => {
    if (!open || !enabled) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void reload(controller.signal); });
    return () => controller.abort();
  }, [enabled, open, reload]);

  function changeOpen(next: boolean) {
    if (submitting || (next && !enabled)) return;
    if (!next) {
      request.current?.abort();
      setReview(null);
      setSettled(null);
      setLoading(false);
    }
    setOpen(next);
  }

  function selectBranch(next: string | null) {
    if (safety.busy || safety.blocked || (next !== null && !branchIds.includes(next))) return;
    setReview(null);
    setSelection({ scope, branchId: next });
  }

  function choose(blueprint: DashboardBlueprint) {
    if (!enabled || !items.includes(blueprint) || loading || safety.busy || safety.blocked) return;
    if (blueprint.adoption.state === "ADOPTED") {
      changeOpen(false);
      navigate(blueprint.adoption.dashboardId);
    } else if (blueprint.adoption.state === "AVAILABLE" && !blueprint.branchSelectionRequired) {
      setReview({ scope, branchId, key: blueprint.key, revision: blueprint.definitionRevision, name: "", confirmed: false });
    }
  }

  function updateReview(update: Partial<Pick<Review, "name" | "confirmed" | "error">>) {
    if (activeReview) setReview({ ...activeReview, ...update });
  }

  async function adopt() {
    if (!selected || !activeReview || loading || activeReview.name.trim().length > DASHBOARD_NAME_MAX_LENGTH
      || (selected.targets.length > 0 && !activeReview.confirmed)) return;
    const ticket = beginWrite(enabled);
    if (!ticket) return;
    setSubmitting(true);
    updateReview({ error: undefined });
    let hasReceipt = false;
    try {
      const command = buildDashboardBlueprintAdoption(selected, branchId, activeReview.name, activeReview.confirmed);
      const response = await axiosClient.put<unknown>(command.path, command.body, WRITE);
      if (!currentWrite(ticket)) { fence(ticket); return; }
      if (response.status !== 200) invalidDashboardReceipt();
      const receipt = parseDashboardBlueprintReceipt(response.data, selected.definitionRevision);
      hasReceipt = true;
      const detailResponse = await axiosClient.get<unknown>(dashboardPath(receipt.dashboardId), READ);
      if (!currentWrite(ticket)) { fence(ticket); return; }
      if (detailResponse.status !== 200) invalidDashboardReceipt();
      const detail = parseDashboardDetailResponse(detailResponse.data);
      if (detail.id !== receipt.dashboardId || detail.ownerUserId !== user?.id || detail.accessLevel !== "OWNER"
        || (receipt.created && (detail.name !== (command.body.name ?? selected.name.trim())
          || (detail.defaultFilters.branchId ?? null) !== branchId || detail.placements.length !== selected.widgetCount))) {
        invalidDashboardReceipt();
      }
      setOpen(false);
      setReview(null);
      setSettled(null);
      if (receipt.created) toast.success(t.crmDashboards.created);
      else toast.info(t.errors.idempotencyReplayedTitle, t.errors.idempotencyReplayedDescription);
      navigate(receipt.dashboardId);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (hasReceipt || uncertainDashboardWrite(normalized)) fence(ticket);
      if (currentWrite(ticket)) updateReview({ error: normalized });
    } finally {
      finish(ticket);
      setSubmitting(false);
    }
  }

  return { open: open && enabled, changeOpen, branchIds, branchId, selectBranch, choose, selected, activeReview, updateReview,
    clearReview: () => setReview(null), items, queryError: current?.error ?? null, loading: open && (loading || current === null),
    submitting, busy: safety.busy, blocked: safety.blocked, reviewReady: safety.reviewReady,
    needsReconciliation: safety.needsResourceReconciliation,
    reload: () => reload(), acknowledge: safety.acknowledge, adopt };
}
