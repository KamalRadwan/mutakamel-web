"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import type { ApplicationAccessRequest, ApplicationAccessView } from "../application-access-contract";
import type { useApplicationAccess } from "./useApplicationAccess";

type BranchView = ApplicationAccessView & {
  scope: Extract<ApplicationAccessView["scope"], { kind: "BRANCH" }>;
  resource: Extract<ApplicationAccessView["resource"], { kind: "BRANCH_OVERRIDE" }>;
};
export interface BranchAddonRestrictionProps {
  request: ApplicationAccessRequest;
  read: Pick<ReturnType<typeof useApplicationAccess>, "requestedKey" | "snapshotKey" | "view" | "loading" | "denied" | "error" | "reload">;
  // Local intent handoff only, not a transport DTO or an authoritative write receipt.
  onConfirm: (observed: BranchView, reason: string) => void | Promise<void>;
}
interface State {
  key: string; open: boolean; reason: string; invalidReason: boolean;
  phase: "review" | "pending" | "submitted" | "stale" | "uncertain";
  error: NormalizedApiError | null;
}
interface Owner { key: string; active: boolean; busy: boolean; ready: boolean }

export function useBranchAddonRestriction({ request, read, onConfirm }: BranchAddonRestrictionProps) {
  const { user, isAuthenticated, authState, realtimeAuthGeneration } = useTenantAuth();
  const manage = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes("applications.activation.manage"));
  const view = read.view?.scope.kind === "BRANCH" && read.view.resource.kind === "BRANCH_OVERRIDE"
    && request.kind === "BRANCH_OVERRIDE" && read.view.scope.branchId === request.branchId
    && read.view.target.applicationKey === request.applicationKey && read.view.target.addonKey === request.addonKey
    && read.view.target.addonId !== null ? read.view as BranchView : null;
  const wrongTarget = request.kind !== "BRANCH_OVERRIDE" || read.requestedKey !== JSON.stringify(request) || (read.view !== null && !view);
  const key = JSON.stringify([read.requestedKey, read.snapshotKey, user?.id, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, manage, wrongTarget, read.denied, read.error?.status]);
  const [state, setState] = useState<State | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  useLayoutEffect(() => {
    const captured = { key, active: true, busy: false, ready: false }; owner.current = captured;
    return () => { captured.active = false; };
  }, [key]);
  const current = state?.key === key ? state : null;
  const denied = !manage || wrongTarget || read.denied || [401, 403, 404].includes(read.error?.status ?? 0) || current?.error?.status === 403;
  const ready = !denied && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null
    && !read.loading && read.error === null && read.snapshotKey !== null && view !== null;
  useLayoutEffect(() => { if (owner.current?.key === key) owner.current.ready = ready; }, [key, ready]);
  const canOpen = ready && view?.resource.mode !== "DISABLED" && (!current || current.phase === "review");
  const isCurrent = (captured: Owner) => captured.active && owner.current === captured && captured.key === key;
  const changeOpen = (open: boolean) => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || (open && (!captured.ready || !canOpen))) return;
    if (!open && current?.phase !== "review") return;
    setState(open ? { key, open: true, reason: "", invalidReason: false, phase: "review", error: null } : null);
  };
  const changeReason = (event: ChangeEvent<HTMLInputElement>) => {
    const captured = owner.current;
    if (captured && isCurrent(captured) && captured.ready && !captured.busy && current?.phase === "review")
      setState({ ...current, reason: event.target.value, invalidReason: false });
  };
  const confirm = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || !captured.ready || captured.busy || !canOpen || !current?.open || !view) return;
    const reason = current.reason;
    // Existing Core application-access-command.contract.ts: reason() — never invent/trim a reason.
    if (reason.length < 3 || reason.length > 500 || reason.trim() !== reason || Array.from(reason).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      setState({ ...current, invalidReason: true }); return;
    }
    captured.busy = true; setState({ ...current, phase: "pending", error: null });
    try {
      await onConfirm(view, reason);
      if (isCurrent(captured)) setState({ ...current, open: false, phase: "submitted" });
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (isCurrent(captured)) setState({ ...current, open: false, error: normalized,
        phase: normalized.status === 409 && normalized.code === "ADDON_REVISION_STALE" ? "stale" : "uncertain" });
    } finally { captured.busy = false; }
  };
  const reread = () => {
    const captured = owner.current;
    if (captured && isCurrent(captured) && captured.ready && !captured.busy && current?.phase !== "uncertain") read.reload();
  };
  return { manage, ready, denied, view, state: current, canOpen, changeOpen, changeReason, confirm, reread };
}
