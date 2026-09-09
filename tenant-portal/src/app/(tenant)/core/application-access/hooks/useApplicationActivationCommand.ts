"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import type { ApplicationAccessRequest } from "../application-access-contract";
import { activationReason, captureActivationCommand, clearActivationIntent, readActivationIntent, retainActivationIntent,
  sendActivationCommand, type ActivationCommand, type ActivationReceipt } from "../application-activation-command";
import type { useApplicationAccess } from "./useApplicationAccess";
import { clearCompanyCommandContinuation, companyCommandReference, readCompanyCommandContinuation, readCompanyCommandStatus,
  retainCompanyCommandContinuation, type CompanyCommandOutcome, type CompanyCommandPending } from "../company-command-status";

export interface ActivationCommandProps {
  request: ApplicationAccessRequest;
  read: Pick<ReturnType<typeof useApplicationAccess>, "requestedKey" | "snapshotKey" | "view" | "loading" | "denied" | "error" | "reload">;
}
interface State {
  key: string; phase: "idle" | "review" | "pending" | "processing" | "uncertain" | "rejected" | "committed" | "storage";
  open: boolean; enabled: boolean; reason: string; invalidReason: boolean; snapshot: string | null;
  command: ActivationCommand | null; receipt: ActivationReceipt | null; error: NormalizedApiError | null; refreshFailed: boolean;
  status: CompanyCommandOutcome | null; statusLoading: boolean; statusError: NormalizedApiError | null;
}
interface Owner { key: string; active: boolean; busy: boolean; controller: AbortController }
const initial = (key: string): State => ({ key, phase: "idle", open: false, enabled: false, reason: "", invalidReason: false,
  snapshot: null, command: null, receipt: null, error: null, refreshFailed: false, status: null, statusLoading: false, statusError: null });
function restored(key: string, actorId: string, request: ApplicationAccessRequest): State {
  const command = readActivationIntent(actorId, request);
  const reference = command && companyCommandReference(command.target, command.idempotencyKey, command.observedResourceId);
  const status = reference ? readCompanyCommandContinuation(actorId, reference) : null;
  return { ...initial(key), command, status, phase: status ? "processing" : command ? "uncertain" : "idle" };
}

export function useApplicationActivationCommand({ request, read }: ActivationCommandProps) {
  const { user, isAuthenticated, authState, realtimeAuthGeneration, retryBootstrap } = useTenantAuth();
  const { t } = useI18n();
  const toast = useToast();
  const actorId = user?.id;
  const supported = request.kind === "APPLICATION_ACTIVATION" || request.kind === "ADDON_ACTIVATION" || request.kind === "BRANCH_OVERRIDE";
  const manage = supported && isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes("applications.activation.manage"));
  const canRead = supported && isAuthenticated && !!user && (user.isTenantOwner
    || user.permissions.some((permission) => permission === "applications.activation.read" || permission === "applications.activation.manage"));
  const requestKey = JSON.stringify(request);
  const key = JSON.stringify([requestKey, user?.id, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, manage, canRead]);
  const [state, setState] = useState<State | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  if (state?.key === key && ["review", "rejected"].includes(state.phase) && state.snapshot !== read.snapshotKey) setState(initial(key));

  useLayoutEffect(() => {
    const captured: Owner = { key, active: true, busy: false, controller: new AbortController() };
    owner.current = captured;
    queueMicrotask(() => {
      if (!captured.active || !canRead || !actorId) return;
      try {
        setState(restored(key, actorId, JSON.parse(requestKey)));
      } catch { setState({ ...initial(key), phase: "storage" }); }
    });
    return () => { captured.active = false; captured.controller.abort(); };
  }, [actorId, key, canRead, requestKey]);

  const current = state?.key === key ? state : null;
  const denied = !manage || read.requestedKey !== requestKey || read.denied || [401, 403, 404].includes(read.error?.status ?? 0) || current?.error?.status === 403;
  const ready = !denied && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const canReadStatus = canRead && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null && current?.statusError?.status !== 403;
  const fresh = ready && !read.loading && read.error === null && read.snapshotKey !== null && read.view !== null;
  const canReview = fresh && current?.phase === "idle";
  const resource = read.view?.resource;
  const definition = resource?.kind === "ADDON_ACTIVATION" ? resource.definitionVersionId ?? read.view?.source.selectedDefinitionVersionId : null;
  const hasDefinition = typeof definition === "string" && definition[14] === "7";
  const canEnable = canReview && (resource?.kind === "BRANCH_OVERRIDE" ? resource.mode !== "INHERIT"
    : resource?.kind === "APPLICATION_ACTIVATION" ? resource.enabled !== true
      : resource?.kind === "ADDON_ACTIVATION" && hasDefinition && resource.enabled !== true);
  const canDisable = canReview && (resource?.kind === "BRANCH_OVERRIDE" ? resource.mode !== "DISABLED"
    : resource?.kind === "APPLICATION_ACTIVATION" ? resource.enabled !== false
      : resource?.kind === "ADDON_ACTIVATION" && hasDefinition && resource.id !== null && resource.enabled !== false);
  const isCurrent = (captured: Owner) => captured.active && owner.current === captured && captured.key === key;

  const review = (enabled: boolean) => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !(enabled ? canEnable : canDisable) || !current) return;
    setState({ ...current, phase: "review", open: true, reason: "", enabled, snapshot: read.snapshotKey });
  };
  const reviewOriginal = () => {
    const captured = owner.current;
    if (captured && isCurrent(captured) && !captured.busy && ready && current?.phase === "uncertain" && current.command)
      setState({ ...current, open: true, reason: current.command.body.reason });
  };
  const changeOpen = (open: boolean) => {
    const captured = owner.current;
    if (!open && captured && isCurrent(captured) && !captured.busy && current)
      setState({ ...current, open: false, phase: current.command ? current.phase : "idle" });
  };
  const changeReason = (reason: string) => {
    if (ready && current?.phase === "review") setState({ ...current, reason, invalidReason: false });
  };
  const committed = async (captured: Owner, command: ActivationCommand, receipt: ActivationReceipt, previous: State) => {
    if (!isCurrent(captured) || !actorId) return;
    let refreshFailed = false;
    try {
      clearActivationIntent(actorId, command);
      const reference = companyCommandReference(command.target, command.idempotencyKey, command.observedResourceId);
      if (reference) clearCompanyCommandContinuation(actorId, reference);
    } catch { refreshFailed = true; }
    setState({ ...previous, phase: "committed", open: false, command, receipt, error: null, refreshFailed,
      status: null, statusLoading: false, statusError: null });
    toast.success(receipt.changed ? t.applicationActivationCommand.applied : t.applicationActivationCommand.noChange, t.applicationActivationCommand.historical);
    try { await retryBootstrap(); if (isCurrent(captured)) read.reload(); }
    catch { if (isCurrent(captured)) setState((value) => value?.key === key ? { ...value, refreshFailed: true } : value); }
  };
  const confirm = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !ready || !current?.open || !user
      || !["review", "uncertain"].includes(current.phase) || (!current.command && (!fresh || current.snapshot !== read.snapshotKey))) return;
    if (!activationReason.safeParse(current.reason).success) { setState({ ...current, invalidReason: true }); return; }
    captured.busy = true;
    let command: ActivationCommand;
    try {
      command = current.command ?? captureActivationCommand(request, read.view!, current.reason, generateUUIDv7(), current.enabled);
      retainActivationIntent(user.id, command);
    } catch { captured.busy = false; setState({ ...current, phase: "storage", open: false }); return; }
    setState({ ...current, phase: "pending", command, error: null });
    let result: ActivationReceipt | CompanyCommandPending;
    try {
      result = await sendActivationCommand(command, captured.controller.signal);
      if (!isCurrent(captured)) { captured.busy = false; return; }
      if (result.state === "PENDING") {
        const reference = companyCommandReference(command.target, command.idempotencyKey, command.observedResourceId);
        if (!reference) throw new Error("The pending Company target could not be verified.");
        const status = retainCompanyCommandContinuation(user.id, reference, result);
        setState({ ...current, phase: "processing", open: false, command, status, error: null, statusError: null });
        captured.busy = false; return;
      }
    }
    catch (error) {
      if (isCurrent(captured)) {
        const normalized = normalizeApiError(error);
        const staleCode = command.operationKind === "SET_APPLICATION_ACTIVATION" ? "APPLICATION_ACTIVATION_REVISION_STALE" : "ADDON_REVISION_STALE";
        if (current.command === null && normalized.status === 409 && normalized.code === staleCode) {
          try {
            clearActivationIntent(user.id, command);
            setState({ ...current, phase: "rejected", open: false, error: normalized });
          } catch { setState({ ...current, phase: "storage", open: false, command, error: normalized }); }
        } else setState({ ...current, phase: "uncertain", open: false, command, error: normalized });
      }
      captured.busy = false; return;
    }
    if (!isCurrent(captured)) { captured.busy = false; return; }
    await committed(captured, command, result, current);
    captured.busy = false;
  };
  const readStatus = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !canReadStatus || !actorId
      || !current?.command || current.status?.state !== "PENDING") return;
    const command = current.command, reference = companyCommandReference(command.target, command.idempotencyKey, command.observedResourceId);
    if (!reference) return;
    captured.busy = true;
    setState({ ...current, statusLoading: true, statusError: null });
    try {
      const result = await readCompanyCommandStatus(reference, current.status, captured.controller.signal);
      if (!isCurrent(captured)) return;
      if (result.state === "COMMITTED") { await committed(captured, command, result, current); return; }
      if (result.state === "PENDING") retainCompanyCommandContinuation(actorId, reference, result);
      else {
        clearActivationIntent(actorId, command);
        clearCompanyCommandContinuation(actorId, reference);
      }
      setState({ ...current, status: result, statusLoading: false, statusError: null,
        phase: result.state === "PENDING" ? "processing" : "rejected", snapshot: read.snapshotKey,
        command: result.state === "PENDING" ? command : null });
    } catch (error) {
      if (isCurrent(captured)) setState({ ...current, statusLoading: false, statusError: normalizeApiError(error) });
    } finally { captured.busy = false; }
  };
  const recheck = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !user) return;
    try {
      await retryBootstrap(); if (!isCurrent(captured)) return;
      setState(restored(key, user.id, request));
      read.reload();
    } catch { if (isCurrent(captured)) setState((previous) => previous?.key === key ? { ...previous, refreshFailed: true } : previous); }
  };
  return { manage, canRead, canReadStatus, denied, ready, fresh, canReview, canEnable, canDisable, state: current,
    review, reviewOriginal, changeOpen, changeReason, confirm, readStatus, recheck };
}
