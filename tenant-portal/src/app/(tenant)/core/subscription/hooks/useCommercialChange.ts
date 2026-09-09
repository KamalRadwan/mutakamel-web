"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import type { CommercialApplyReceipt } from "../commercial-apply";
import type { CommercialPreparationRequest } from "../commercial-command-request";
import { clearCommercialIntent, parseTenantCommercialRequest, readCommercialIntent, retainCommercialIntent, type CommercialIntent, type CommercialPendingCommand } from "../commercial-intent";
import { commercialPreviewIdentity, executeCommercialIntent, readCommercialHistory } from "../commercial-intent-execution";
import { DEFINITION_ADOPTION_PERMISSION, parseDefinitionAdoptionRequest, parseDefinitionAdoptionSources, type DefinitionAdoptionSource } from "../definition-adoption-command";
import type { CommercialOperationReceipt } from "../commercial-operation";
import type { CommercialPreview } from "../commercial-preview";
import { commercialRecoveryRequestSchema, type CommercialRecoveryRequest } from "../commercial-recovery";
import type { SubscriptionView } from "../subscription-read";

interface State {
  key: string; intent: CommercialIntent | null; operation: CommercialOperationReceipt | null; preview: CommercialPreview | null;
  receipt: CommercialApplyReceipt | null; phase: "idle" | "saved" | "pending" | "uncertain" | "complete" | "storage";
  error: NormalizedApiError | null; receiptError: NormalizedApiError | null;
}
interface Owner { key: string; active: boolean; busy: boolean; controller: AbortController }
const initial = (key: string): State => ({ key, intent: null, operation: null, preview: null, receipt: null, phase: "idle", error: null, receiptError: null });

/** The original command is retained before dispatch. A fresh subscription read
 * cannot establish the financial outcome of an uncertain request. */
export function useCommercialChange(view: SubscriptionView | null, onApplied: () => void, enabled = true, adoptionRevision?: string | null) {
  const { user, isAuthenticated, authState, realtimeAuthGeneration, retryBootstrap } = useTenantAuth();
  const actorId = user?.id ?? null;
  const adoption = adoptionRevision !== undefined;
  const purpose = adoption ? "ADOPTION" : "PURCHASE";
  const allowed = isAuthenticated && !!user && (user.isTenantOwner || (adoption && user.permissions.includes(DEFINITION_ADOPTION_PERMISSION)));
  const key = JSON.stringify([actorId, realtimeAuthGeneration, allowed, purpose, authState]);
  const [state, setState] = useState<State | null>(null);
  const [quoteClock, setQuoteClock] = useState<{ preview: CommercialPreview; expired: boolean } | null>(null);
  const owner = useRef<Owner | null>(null);
  if (state !== null && state.key !== key) setState(null);
  useLayoutEffect(() => {
    const captured: Owner = { key, active: true, busy: false, controller: new AbortController() };
    owner.current = captured;
    queueMicrotask(() => {
      if (!captured.active || !allowed || !actorId) return;
      try {
        const intent = readCommercialIntent(actorId, purpose);
        setState({ ...initial(key), intent, phase: intent ? (intent.pending ? "uncertain" : "saved") : "idle" });
      } catch { setState({ ...initial(key), phase: "storage" }); }
    });
    return () => { captured.active = false; captured.controller.abort(); };
  }, [key, allowed, actorId, purpose]);
  const current = state?.key === key ? state : null;
  const preview = current?.preview ?? null;
  useEffect(() => {
    if (!preview) return;
    let active = true;
    const remaining = Date.parse(preview.expiresAt) - Date.now();
    queueMicrotask(() => { if (active) setQuoteClock({ preview, expired: remaining <= 0 }); });
    const timer = setTimeout(() => { if (active) setQuoteClock({ preview, expired: true }); }, Math.max(0, remaining));
    return () => { active = false; clearTimeout(timer); };
  }, [preview]);
  const denied = !allowed || current?.error?.status === 403;
  const ready = !denied && authState === "AUTHENTICATED" && realtimeAuthGeneration !== null;
  const fresh = ready && enabled && (adoption ? adoptionRevision !== null : !!view && ["TRIAL", "ACTIVE"].includes(view.subscription.status)
    && view.subscription.currentCollectionInvoiceId === null);
  const sameSubscription = adoption ? current?.intent?.purpose === "ADOPTION" : !!view && current?.intent?.subscriptionId === view.subscription.id;
  const busy = current?.phase === "pending";
  const canStart = fresh && current?.phase === "idle";
  const canQuote = fresh && sameSubscription && current?.phase === "saved" && !current.intent?.pending && current.operation?.state === "READY"
    && (!adoption || current.intent?.request.expectedSubscriptionRevision === adoptionRevision);
  const observedClock = quoteClock?.preview === preview ? quoteClock : null;
  const expired = observedClock?.expired ?? false;
  const canApply = canQuote && !!preview?.financial.canApply && observedClock !== null && !expired;
  const canRetry = ready && sameSubscription && current?.phase === "uncertain" && !!current.intent?.pending;
  const canRecover = ready && sameSubscription && !!current && ["saved", "uncertain"].includes(current.phase) && !!current.operation
    && !["COMMITTED", "ABORTED"].includes(current.operation.state) && (!current.intent?.pending || current.intent.pending.kind === "PREVIEW");
  const isCurrent = (captured: Owner) => captured.active && owner.current === captured && captured.key === key;

  const run = async (next: CommercialIntent) => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !current || !actorId || !ready) return;
    captured.busy = true;
    let retained: CommercialIntent;
    try { retained = retainCommercialIntent(actorId, current.intent, next); }
    catch { captured.busy = false; setState({ ...current, phase: "storage" }); return; }
    const pendingState: State = { ...current, intent: retained, phase: "pending", error: null };
    setState(pendingState);
    try {
      const result = await executeCommercialIntent(retained, captured.controller.signal, current.preview);
      if (!isCurrent(captured)) return;
      if (result.kind === "receipt") {
        clearCommercialIntent(actorId, retained);
        setState({ ...pendingState, intent: null, receipt: result.value, phase: "complete" });
        onApplied();
      } else if (result.kind === "operation") {
        if (result.value.state === "ABORTED") {
          clearCommercialIntent(actorId, retained);
          setState({ ...pendingState, intent: null, operation: result.value, preview: null, phase: "complete" });
        } else {
          const intent = retainCommercialIntent(actorId, retained, { ...retained, operationId: result.value.operationId, pending: null });
          setState({ ...pendingState, intent, operation: result.value, preview: null, phase: "saved" });
        }
      } else if (result.kind === "recoveryRejected") {
        const intent = retainCommercialIntent(actorId, retained, { ...retained, pending: null,
          rejectedRecoveries: [...retained.rejectedRecoveries, { key: result.command.key, request: result.command.request }] });
        // Retire the old progress/quote. Only an explicit successful status read
        // can supply a revision for a newly reviewed recovery after this refusal.
        setState({ ...pendingState, intent, operation: null, preview: null, phase: "saved", error: result.error });
      } else if (result.kind === "expired") {
        const original = retained.preview!;
        const intent = retainCommercialIntent(actorId, retained, { ...retained, preview: null, pending: null,
          expiredApplies: [...retained.expiredApplies, { previewId: original.id, previewKey: original.key, applyKey: retained.pending!.key }] });
        setState({ ...pendingState, intent, preview: null, phase: "saved", error: result.error });
      } else {
        const intent = retainCommercialIntent(actorId, retained, { ...retained, subscriptionId: result.value.subscriptionId,
          preview: { id: result.value.previewId, key: retained.pending!.key,
            ...(adoption ? { identity: commercialPreviewIdentity(result.value) } : {}) }, pending: null });
        setState({ ...pendingState, intent, preview: result.value, phase: "saved" });
      }
    } catch (error) {
      if (isCurrent(captured)) setState({ ...pendingState, phase: "uncertain", error: normalizeApiError(error) });
    } finally { captured.busy = false; }
  };
  const start = async (request: CommercialPreparationRequest, sources: DefinitionAdoptionSource[] = []) => {
    if (!canStart || !actorId || (!adoption && !view)) return;
    const input = adoption ? parseDefinitionAdoptionRequest(request) : parseTenantCommercialRequest(request);
    const adoptionSources = adoption ? parseDefinitionAdoptionSources(parseDefinitionAdoptionRequest(input), sources) : [];
    if (input.expectedSubscriptionRevision !== (adoption ? adoptionRevision : view!.subscriptionRevision)) return;
    const prepareKey = generateUUIDv7();
    await run({ actorId, purpose, adoptionSources, subscriptionId: adoption ? null : view!.subscription.id, request: input, prepareKey, operationId: null, preview: null,
      expiredApplies: [], unresolvedPreviews: [], rejectedRecoveries: [],
      pending: { kind: "PREPARE", key: prepareKey } });
  };
  const command = async (pending: CommercialPendingCommand) => {
    if (!current?.intent) return;
    const previous = current.intent.pending;
    // A quote cannot settle money. Explicit preparation recovery may supersede
    // a quote attempt, but its original key/body remain available in the journal.
    await run({ ...current.intent, pending, unresolvedPreviews: previous?.kind === "PREVIEW" && pending.kind === "RECOVER"
      ? [...current.intent.unresolvedPreviews, previous.key] : current.intent.unresolvedPreviews });
  };
  const quote = async () => { if (canQuote) await command({ kind: "PREVIEW", key: generateUUIDv7() }); };
  const apply = async () => {
    if (!canApply || !preview || Date.parse(preview.expiresAt) <= Date.now()) return false;
    await command({ kind: "APPLY", key: generateUUIDv7() }); return true;
  };
  const retry = async () => { if (canRetry && current?.intent) await run(current.intent); };
  const recover = async (action: CommercialRecoveryRequest["action"], reason: string) => {
    if (!canRecover || !current?.operation) return;
    const request = commercialRecoveryRequestSchema.safeParse({ expectedOperationRevision: current.operation.operationRevision, action, reason: reason.trim() });
    if (request.success) await command({ kind: "RECOVER", key: generateUUIDv7(), request: request.data });
  };
  const reload = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !ready || !actorId || !current?.intent?.operationId) return;
    captured.busy = true;
    setState({ ...current, phase: "pending", error: null });
    try {
      const history = await readCommercialHistory(current.intent, captured.controller.signal);
      if (!isCurrent(captured)) return;
      if (history.receipt || history.operation.state === "ABORTED") {
        clearCommercialIntent(actorId, current.intent);
        setState({ ...current, ...history, intent: null, phase: "complete", error: null });
        if (history.receipt) onApplied();
      } else setState({ ...current, ...history, phase: history.receiptError ? "saved" : current.intent.pending ? "uncertain" : "saved", error: null });
    } catch (error) { if (isCurrent(captured)) setState({ ...current, error: normalizeApiError(error) }); }
    finally { captured.busy = false; }
  };
  const recheck = async () => {
    const captured = owner.current;
    if (!captured || !isCurrent(captured) || captured.busy || !actorId) return;
    try {
      await retryBootstrap();
      if (!isCurrent(captured)) return;
      const intent = readCommercialIntent(actorId, purpose);
      setState({ ...initial(key), intent, phase: intent ? (intent.pending ? "uncertain" : "saved") : "idle" });
      onApplied();
    } catch { if (isCurrent(captured)) setState({ ...initial(key), phase: "storage" }); }
  };
  const newChange = () => { if (current?.phase === "complete" && !owner.current?.busy) setState(initial(key)); };
  return { state: current, denied, ready, fresh, busy, canStart, canQuote, canApply, canRetry, canRecover, expired,
    start, quote, apply, retry, recover, reload, recheck, newChange };
}
