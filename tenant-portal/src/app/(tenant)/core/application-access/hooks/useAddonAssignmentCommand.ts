"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { addonAssignmentCommandSchema, sendAddonAssignmentCommand, type AddonAssignmentCommand, type AddonAssignmentReceipt } from "../application-addon-assignment-command";
import { captureAddonAssignmentDraft, clearAddonAssignmentIntent, readAddonAssignmentIntent, retainAddonAssignmentIntent,
  type AddonAssignmentDraft, type AddonAssignmentSource, type AddonIntentContext } from "../application-addon-assignment-intent";

interface State {
  key: string; phase: "idle" | "review" | "submitting" | "uncertain" | "rejected" | "committed" | "storage";
  open: boolean; draft: AddonAssignmentDraft | null; command: AddonAssignmentCommand | null;
  receipt: AddonAssignmentReceipt | null; error: NormalizedApiError | null; refreshFailed: boolean;
  rejectedSource?: AddonAssignmentSource["row"]; refreshRequested?: boolean;
}
interface Owner { key: string; active: boolean; ready: boolean; busy: boolean; controller: AbortController }
function initial(key: string): State {
  return { key, phase: "idle", open: false, draft: null, command: null, receipt: null, error: null, refreshFailed: false };
}

export function useAddonAssignmentCommand(userId: string, source: AddonAssignmentSource, onReload: () => void | Promise<void>) {
  const { user, isAuthenticated, realtimeAuthGeneration, authState, retryBootstrap } = useTenantAuth();
  const toast = useToast();
  const { t } = useI18n();
  const allowed = isAuthenticated && !!user && source.row.userId === userId && (user.isTenantOwner || user.permissions.includes("applications.addon_seats.manage"));
  const ready = allowed && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const key = JSON.stringify([user?.id, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, allowed, userId, source.row.addonSelectionId]);
  const context: AddonIntentContext = { actorId: user?.id ?? "", userId, addonSelectionId: source.row.addonSelectionId };
  const [state, setState] = useState<State | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  if (state?.key === key && state.phase === "rejected" && state.refreshRequested && state.rejectedSource !== source.row) setState(initial(key));

  useLayoutEffect(() => {
    const captured: Owner = { key, active: true, ready: false, busy: false, controller: new AbortController() };
    owner.current = captured;
    queueMicrotask(() => {
      if (!captured.active || !allowed) return;
      try {
        const command = readAddonAssignmentIntent({ actorId: user?.id ?? "", userId, addonSelectionId: source.row.addonSelectionId });
        setState({ ...initial(key), phase: command ? "uncertain" : "idle", command });
      } catch { setState({ ...initial(key), phase: "storage" }); }
    });
    return () => { captured.active = false; captured.controller.abort(); };
  }, [allowed, key, user?.id, userId, source.row.addonSelectionId]);
  // Refresh can temporarily suspend submission without rebinding or losing the intent.
  useLayoutEffect(() => { if (owner.current?.key === key) owner.current.ready = ready; }, [key, ready]);

  const current = state?.key === key && ready ? state : null;
  const denied = !allowed || current?.error?.status === 403;
  const draft = captureAddonAssignmentDraft(userId, source);
  const isCurrent = (captured: Owner) => captured.active && owner.current === captured && captured.key === key;

  const open = () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || !captured.ready || captured.busy || !current || denied
      || current.phase === "storage" || current.phase === "rejected" || current.phase === "committed" || (!current.command && !draft)) return;
    setState({ ...current, open: true, draft: current.command ?? draft,
      phase: current.command ? "uncertain" : "review" });
  };
  const close = (next = false) => {
    const captured = owner.current;
    if (next || !captured || !isCurrent(captured) || captured.busy || !current) return;
    setState({ ...current, open: false, phase: current.command ? current.phase : "idle", draft: current.command ? current.draft : null });
  };

  const confirm = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || !captured.ready || captured.busy || !current?.open || denied
      || !current.draft || current.receipt || current.phase === "storage") return;
    captured.busy = true;
    let command: AddonAssignmentCommand;
    try {
      command = current.command ?? addonAssignmentCommandSchema.parse({ ...current.draft, idempotencyKey: generateUUIDv7() });
      retainAddonAssignmentIntent(context, command);
    } catch {
      captured.busy = false; setState({ ...current, phase: "storage" }); return;
    }
    setState({ ...current, phase: "submitting", command, error: null });
    let receipt: AddonAssignmentReceipt;
    try { receipt = await sendAddonAssignmentCommand(command, captured.controller.signal); }
    catch (error) {
      if (isCurrent(captured)) {
        const normalized = normalizeApiError(error);
        // Only a typed first-send pre-commit rejection can retire an intent without a receipt.
        if (current.command === null && normalized.status === 409 && normalized.code === "ADDON_ASSIGNMENT_REVISION_STALE") {
          try {
            clearAddonAssignmentIntent(context, command);
            setState({ ...current, phase: "rejected", open: false, command: null, error: normalized, rejectedSource: source.row });
          } catch { setState({ ...current, phase: "storage", command, error: normalized }); }
        } else setState({ ...current, phase: "uncertain", command, error: normalized });
      }
      captured.busy = false; return;
    }
    // A stale success cannot clear recovery evidence or update another context.
    if (!isCurrent(captured)) { captured.busy = false; return; }
    let refreshFailed = false;
    try { clearAddonAssignmentIntent(context, command); } catch { refreshFailed = true; }
    setState({ ...current, phase: "committed", open: false, command, receipt, error: null, refreshFailed });
    captured.busy = false;
    const copy = t.addonAssignmentCommand;
    // A read refresh may retire this row before its in-body receipt is painted.
    toast.success(receipt.changed ? receipt.operationKind === "ASSIGN_ADDON" ? copy.assigned : copy.removed : copy.noChange, copy.historical);
    try {
      if (user?.id === command.userId) await retryBootstrap();
      if (isCurrent(captured)) await onReload();
    } catch {
      if (isCurrent(captured)) setState((previous) => previous?.key === key && previous.receipt === receipt
        ? { ...previous, refreshFailed: true } : previous);
    }
  };

  const recheck = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy) return;
    try {
      await retryBootstrap();
      if (!isCurrent(captured)) return;
      await onReload();
      if (!isCurrent(captured)) return;
      const command = readAddonAssignmentIntent(context);
      setState((previous) => previous?.receipt ? previous : previous?.phase === "rejected"
        ? { ...previous, refreshRequested: true } : { ...initial(key), command, phase: command ? "uncertain" : "idle" });
    } catch {
      if (isCurrent(captured)) setState((previous) => previous?.key === key ? { ...previous, refreshFailed: true } : previous);
    }
  };
  return { state: current, denied, ready, loading: allowed && !current, draft,
    canOpen: ready && !denied && current !== null && !["submitting", "storage", "rejected", "committed"].includes(current.phase) && !!(current.command || draft),
    open, close, confirm, recheck };
}
