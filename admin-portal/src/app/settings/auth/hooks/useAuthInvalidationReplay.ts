"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  authInvalidationReplayIntentFingerprint,
  authInvalidationReplayScopeFingerprint,
  buildAuthInvalidationReplayCommand,
  parseAuthInvalidationEventIds,
  replayAuthInvalidationOutbox,
  shouldRetainAuthInvalidationReplayIntent,
  type AuthInvalidationReplayDraft,
  type AuthInvalidationReplayMode,
  type AuthInvalidationReplayReceipt,
  type AuthInvalidationReplayTarget,
  type AuthInvalidationReplayValidationErrors,
} from "../authInvalidationReplay";

const INITIAL_DRAFT: AuthInvalidationReplayDraft = {
  target: "CONTROL_PLANE",
  tenantId: "",
  eventIdsText: "",
  reason: "",
};

export function useAuthInvalidationReplay() {
  const [draft, setDraft] = useState<AuthInvalidationReplayDraft>(INITIAL_DRAFT);
  const [validationErrors, setValidationErrors] =
    useState<AuthInvalidationReplayValidationErrors>({});
  const [confirmationMode, setConfirmationMode] =
    useState<AuthInvalidationReplayMode | null>(null);
  const [pendingMode, setPendingMode] =
    useState<AuthInvalidationReplayMode | null>(null);
  const [retryMode, setRetryMode] =
    useState<AuthInvalidationReplayMode | null>(null);
  const [receipt, setReceipt] =
    useState<AuthInvalidationReplayReceipt | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [validatedScope, setValidatedScope] = useState<string | null>(null);
  const intentKeys = useRef(new Map<string, string>());

  const resetOutcome = useCallback(() => {
    setValidationErrors({});
    setConfirmationMode(null);
    setRetryMode(null);
    setReceipt(null);
    setError(null);
    setValidatedScope(null);
    intentKeys.current.clear();
  }, []);

  const setTarget = useCallback((target: AuthInvalidationReplayTarget) => {
    setDraft((current) => ({
      ...current,
      target,
      tenantId: target === "CONTROL_PLANE" ? "" : current.tenantId,
    }));
    resetOutcome();
  }, [resetOutcome]);

  const setTenantId = useCallback((tenantId: string) => {
    setDraft((current) => ({ ...current, tenantId }));
    resetOutcome();
  }, [resetOutcome]);

  const setEventIdsText = useCallback((eventIdsText: string) => {
    setDraft((current) => ({ ...current, eventIdsText }));
    resetOutcome();
  }, [resetOutcome]);

  const setReason = useCallback((reason: string) => {
    setDraft((current) => ({ ...current, reason }));
    resetOutcome();
  }, [resetOutcome]);

  const currentDryRun = useMemo(
    () => buildAuthInvalidationReplayCommand(draft, "DRY_RUN"),
    [draft],
  );
  const currentScope = currentDryRun.command
    ? authInvalidationReplayScopeFingerprint(currentDryRun.command)
    : null;
  const canApply = currentScope !== null && currentScope === validatedScope;
  const eventCount = parseAuthInvalidationEventIds(draft.eventIdsText).length;

  const requestConfirmation = useCallback((mode: AuthInvalidationReplayMode) => {
    const built = buildAuthInvalidationReplayCommand(draft, mode);
    if (!built.command) {
      setValidationErrors(built.errors);
      setConfirmationMode(null);
      return false;
    }
    if (
      mode === "APPLY" &&
      authInvalidationReplayScopeFingerprint(built.command) !== validatedScope
    ) {
      setValidationErrors({ workflow: "dryRunRequired" });
      setConfirmationMode(null);
      return false;
    }
    setValidationErrors({});
    setConfirmationMode(mode);
    return true;
  }, [draft, validatedScope]);

  const closeConfirmation = useCallback(() => {
    if (pendingMode === null) setConfirmationMode(null);
  }, [pendingMode]);

  const confirm = useCallback(async () => {
    const mode = confirmationMode;
    if (!mode || pendingMode !== null) return;
    const built = buildAuthInvalidationReplayCommand(draft, mode);
    if (!built.command) {
      setValidationErrors(built.errors);
      setConfirmationMode(null);
      return;
    }
    const command = built.command;
    const fingerprint = authInvalidationReplayIntentFingerprint(command);
    const idempotencyKey = intentKeys.current.get(fingerprint) ?? generateUUIDv7();
    intentKeys.current.set(fingerprint, idempotencyKey);
    if (mode === "DRY_RUN") setValidatedScope(null);
    setPendingMode(mode);
    setError(null);
    setReceipt(null);
    try {
      const nextReceipt = await replayAuthInvalidationOutbox(
        command,
        idempotencyKey,
      );
      intentKeys.current.delete(fingerprint);
      setReceipt(nextReceipt);
      setRetryMode(null);
      if (mode === "DRY_RUN") {
        setValidatedScope(authInvalidationReplayScopeFingerprint(command));
      } else {
        setValidatedScope(null);
      }
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      const retainIntent = shouldRetainAuthInvalidationReplayIntent(normalized);
      if (!retainIntent) intentKeys.current.delete(fingerprint);
      if (mode === "APPLY" && !retainIntent) setValidatedScope(null);
      setError(normalized);
      setRetryMode(retainIntent ? mode : null);
    } finally {
      setPendingMode(null);
      setConfirmationMode(null);
    }
  }, [confirmationMode, draft, pendingMode]);

  return {
    draft,
    setTarget,
    setTenantId,
    setEventIdsText,
    setReason,
    validationErrors,
    confirmationMode,
    pendingMode,
    retryMode,
    receipt,
    error,
    eventCount,
    canApply,
    requestConfirmation,
    closeConfirmation,
    confirm,
  };
}
