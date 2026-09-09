"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { captureConfigurationCommand, clearConfigurationIntent, clearConfigurationMetadata, configurationInputMatches, configurationReason, configurationRestoreInputMatches, readConfigurationIntent, retainConfigurationIntent, restoreConfigurationCommand,
  sendConfigurationCommand, type ConfigurationCommand, type ConfigurationIntent, type ConfigurationReceipt } from "../configuration-command";
import { configurationDraftAt, setConfigurationDraft, validateConfigurationDraft, type ConfigurationDraft, type ConfigurationDraftErrors, type ConfigurationPath } from "../configuration-draft";
import type { ConfigurationTarget } from "../configuration-input-api";
import type { ConfigurationNode } from "../configuration-input-schema";
import type { useApplicationAccess } from "./useApplicationAccess";
import { useConfigurationInput } from "./useConfigurationInput";
import { clearCompanyCommandContinuation, companyCommandReference, readCompanyCommandContinuation, readCompanyCommandStatus,
  retainCompanyCommandContinuation, type CompanyCommandOutcome } from "../company-command-status";

interface State {
  key: string; phase: "editing" | "review" | "restore" | "pending" | "processing" | "uncertain" | "committed" | "storage" | "rejected";
  draft: ConfigurationDraft; draftFence: string | null; errors: ConfigurationDraftErrors; reason: string; invalidReason: boolean;
  command: ConfigurationCommand | null; intent: ConfigurationIntent | null; restoreMismatch: boolean;
  receipt: ConfigurationReceipt | null; error: NormalizedApiError | null; open: boolean; refreshFailed: boolean;
  status: CompanyCommandOutcome | null; statusLoading: boolean; statusError: NormalizedApiError | null;
}
interface Owner { key: string; active: boolean; busy: boolean; controller: AbortController }
const initial = (key: string): State => ({ key, phase: "editing", draft: undefined, draftFence: null, errors: {}, reason: "", invalidReason: false,
  command: null, intent: null, restoreMismatch: false, receipt: null, error: null, open: false, refreshFailed: false,
  status: null, statusLoading: false, statusError: null });
function restored(key: string, actorId: string, request: ConfigurationTarget): State {
  const intent = readConfigurationIntent(actorId, request);
  const reference = intent && companyCommandReference(intent.target, intent.idempotencyKey, intent.observedResourceId);
  const status = reference ? readCompanyCommandContinuation(actorId, reference) : null;
  return { ...initial(key), intent, status, phase: status ? "processing" : intent ? "restore" : "editing" };
}
export interface ConfigurationFormProps { request: ConfigurationTarget; read: ReturnType<typeof useApplicationAccess> }

export function useConfigurationForm({ request, read }: ConfigurationFormProps) {
  const { user, isAuthenticated, authState, realtimeAuthGeneration, retryBootstrap } = useTenantAuth();
  const actorId = user?.id ?? null;
  const manage = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.includes("applications.configuration.manage"));
  const canRead = isAuthenticated && !!user && (user.isTenantOwner || user.permissions.some((permission) =>
    permission === "applications.configuration.read" || permission === "applications.configuration.manage"));
  const input = useConfigurationInput(request, manage ? read.snapshotKey : null);
  const requestKey = JSON.stringify(request);
  const key = JSON.stringify([requestKey, actorId, realtimeAuthGeneration, user?.permissions, user?.isTenantOwner, manage, canRead]);
  const fence = JSON.stringify([read.snapshotKey, input.snapshotKey]);
  const [state, setState] = useState<State | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  if (state?.key === key && ["editing", "review"].includes(state.phase) && state.draftFence !== fence)
    setState({ ...initial(key), draftFence: fence });
  if (state?.key === key && state.phase === "restore" && state.draftFence !== fence)
    setState({ ...state, draft: undefined, reason: "", draftFence: fence, errors: {}, restoreMismatch: false });

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
  }, [key, canRead, actorId, requestKey]);

  const current = state?.key === key ? state : null;
  const denied = !manage || read.denied || input.denied || current?.error?.status === 403;
  const ready = !denied && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const canReadStatus = canRead && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null && current?.statusError?.status !== 403;
  const fresh = ready && !read.loading && !read.error && !input.loading && !input.error && !!read.view && !!input.view
    && configurationInputMatches(read.view, input.view);
  const restoreReady = ready && !!current?.intent && !!input.view && !input.loading && !input.error
    && configurationRestoreInputMatches(current.intent, input.view);
  const editable = !!current && current.draftFence === fence && ((fresh && current.phase === "editing") || (restoreReady && current.phase === "restore"));
  const isCurrent = (captured: Owner) => captured.active && owner.current === captured && captured.key === key;
  const change = (path: ConfigurationPath, next: ConfigurationDraft) => {
    if (!editable || !current || !input.view) return;
    setState({ ...current, draft: setConfigurationDraft(input.view.inputSchema, current.draft, path, next), errors: {} });
  };
  const changeScalar = (path: ConfigurationPath, text: string) => change(path, { kind: "scalar", text });
  const chooseEnum = (path: ConfigurationPath, node: ConfigurationNode, option: string) => {
    if (node.type === "object" || node.type === "array" || !node.enum || !/^[1-9][0-9]*$/u.test(option)) return;
    const value = node.enum[Number(option) - 1];
    if (value !== undefined) changeScalar(path, String(value));
  };
  const include = (path: ConfigurationPath, node: ConfigurationNode) => {
    if (node.type === "object") change(path, { kind: "object", fields: {} });
    if (node.type === "array") change(path, { kind: "array", items: [] });
  };
  const addItem = (path: ConfigurationPath, node: ConfigurationNode) => {
    const draft = configurationDraftAt(current?.draft, path);
    if (node.type === "array" && draft?.kind === "array" && draft.items.length < node.maxItems)
      change(path, { kind: "array", items: [...draft.items, undefined] });
  };
  const removeItem = (path: ConfigurationPath, index: number) => {
    const draft = configurationDraftAt(current?.draft, path);
    if (draft?.kind === "array") change(path, { kind: "array", items: draft.items.filter((_, position) => position !== index) });
  };
  const changeReason = (reason: string) => { if (editable && current) setState({ ...current, reason, invalidReason: false }); };
  const review = () => {
    if (!editable || !current || !input.view || owner.current?.busy) return;
    const values = validateConfigurationDraft(input.view.inputSchema, current.draft), reason = configurationReason.safeParse(current.reason.trim());
    if (!values.values || !reason.success) { setState({ ...current, errors: values.errors, invalidReason: !reason.success }); return; }
    try {
      if (current.phase === "restore" && current.intent) {
        const command = restoreConfigurationCommand(current.intent, values.values, reason.data);
        setState({ ...current, command, reason: reason.data, phase: "uncertain", open: true, restoreMismatch: false });
        return;
      }
      if (!read.view) return;
      const command = captureConfigurationCommand(request, read.view, input.view, values.values, reason.data, generateUUIDv7());
      setState({ ...current, command, reason: reason.data, phase: "review", open: true });
    } catch {
      if (current.phase === "restore") setState({ ...current, restoreMismatch: true });
      else setState({ ...current, phase: "rejected", command: null });
    }
  };
  const reviewOriginal = () => {
    if (ready && current?.phase === "uncertain" && current.command && !owner.current?.busy) setState({ ...current, open: true });
  };
  const changeOpen = (open: boolean) => {
    if (!open && current && !owner.current?.busy) setState({ ...current, open: false,
      ...(current.phase === "review" ? { phase: "editing" as const, command: null } : {}) });
  };
  const committed = (receipt: ConfigurationReceipt, intent: ConfigurationIntent, previous: State) => {
    if (!actorId) return;
    let refreshFailed = false;
    try {
      clearConfigurationMetadata(actorId, intent);
      const reference = companyCommandReference(intent.target, intent.idempotencyKey, intent.observedResourceId);
      if (reference) clearCompanyCommandContinuation(actorId, reference);
    } catch { refreshFailed = true; }
    setState({ ...previous, intent: null, command: null, phase: "committed", open: false, receipt, error: null, refreshFailed,
      draft: undefined, reason: "", status: null, statusLoading: false, statusError: null });
    read.reload();
  };
  const confirm = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !ready || !actorId || !current?.open || !current.command
      || !["review", "uncertain"].includes(current.phase) || (current.phase === "review" && (!fresh || current.draftFence !== fence))) return;
    captured.busy = true;
    const command = current.command;
    let intent: ConfigurationIntent;
    try { intent = retainConfigurationIntent(actorId, command); }
    catch { captured.busy = false; setState({ ...current, phase: "storage", open: false }); return; }
    setState({ ...current, intent, phase: "pending", error: null });
    try {
      const result = await sendConfigurationCommand(command, captured.controller.signal);
      if (!isCurrent(captured)) return;
      if (result.state === "PENDING") {
        const reference = companyCommandReference(command.target, command.idempotencyKey, command.observedResourceId);
        if (!reference) throw new Error("The pending Company target could not be verified.");
        const status = retainCompanyCommandContinuation(actorId, reference, result);
        setState({ ...current, intent, command: null, draft: undefined, reason: "", phase: "processing", open: false, status, error: null, statusError: null });
        return;
      }
      committed(result, intent, current);
    } catch (error) {
      if (!isCurrent(captured)) return;
      const normalized = normalizeApiError(error);
      if (current.phase === "review" && normalized.status === 409 && normalized.code === "ADDON_REVISION_STALE") {
        try { clearConfigurationIntent(actorId, command); setState({ ...current, phase: "rejected", command: null, open: false, error: normalized }); }
        catch { setState({ ...current, phase: "storage", open: false, error: normalized }); }
      } else setState({ ...current, intent, phase: "uncertain", open: false, error: normalized });
    } finally { captured.busy = false; }
  };
  const readStatus = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !canReadStatus || !actorId
      || !current?.intent || current.status?.state !== "PENDING") return;
    const intent = current.intent, reference = companyCommandReference(intent.target, intent.idempotencyKey, intent.observedResourceId);
    if (!reference) return;
    captured.busy = true;
    setState({ ...current, statusLoading: true, statusError: null });
    try {
      const result = await readCompanyCommandStatus(reference, current.status, captured.controller.signal);
      if (!isCurrent(captured)) return;
      if (result.state === "COMMITTED") { committed(result, intent, current); return; }
      if (result.state === "PENDING") retainCompanyCommandContinuation(actorId, reference, result);
      else {
        clearConfigurationMetadata(actorId, intent);
        clearCompanyCommandContinuation(actorId, reference);
      }
      setState({ ...current, status: result, statusLoading: false, statusError: null,
        phase: result.state === "PENDING" ? "processing" : "rejected", intent: result.state === "PENDING" ? intent : null,
        command: null, draft: undefined, reason: "" });
    } catch (error) {
      if (isCurrent(captured)) setState({ ...current, statusLoading: false, statusError: normalizeApiError(error) });
    } finally { captured.busy = false; }
  };
  const recheck = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !actorId) return;
    try {
      await retryBootstrap(); if (!isCurrent(captured)) return;
      setState(restored(key, actorId, request)); read.reload();
    } catch { if (isCurrent(captured)) setState((previous) => previous?.key === key ? { ...previous, refreshFailed: true } : previous); }
  };
  return { state: current, input, manage, canRead, canReadStatus, denied, ready, fresh, restoreReady, editable, change, changeScalar, chooseEnum, include, addItem, removeItem,
    changeReason, review, reviewOriginal, changeOpen, confirm, readStatus, recheck };
}
