"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCan, useToast } from "@/design-system";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { coreGet, corePatch } from "../../../core-api";
import {
  EMAIL_CONFIG_PATH, NOT_READY_CODE, buildPatchEmailConfigRequest,
  hasEmailConfigChanges, ifMatchHeaderValue, readRevisionFromEtag,
  toEmailConfigForm, type EmailConfig, type EmailConfigFormValues,
} from "../email-config-contract";
import {
  classifyEmailWriteError, describeEmailConfigApiError,
  validateEmailConfigDraft, type EmailConfigFieldErrors,
} from "../email-config-messages";
import {
  ORDERED_EMAIL_FIELDS, emailFieldAnchorId, focusEmailField, modalForEmailField,
  type EmailConfigFieldKey, type EmailModalKind,
} from "../email-form-navigation";
import { parseEmailConfigResponse } from "../email-config-response";
import {
  classifySettingsFailure, isSettingsAbortError, type SettingsReadFailure,
} from "../../settings-failure";
import { useEmailConfigActions } from "./useEmailConfigActions";
import { useEmailConfigConflict, type EmailConflictKind } from "./useEmailConfigConflict";

export type { EmailConflictKind };

const CONFIG_RESPONSE_LIMIT_BYTES = 40_000;
const SMTP_FIELD_KEYS: readonly EmailConfigFieldKey[] = [
  "smtpHost", "smtpPort", "smtpSecure", "smtpProtocol", "smtpUsername", "smtpPassword",
];
const MODAL_FIELDS: Record<EmailModalKind, readonly EmailConfigFieldKey[]> = {
  sender: ["fromName", "fromAddress", "replyTo", "senderDomain", "providerDriver"],
  provider: ["providerDriver", "status"],
  smtp: SMTP_FIELD_KEYS,
  dns: ["dkimSelector"],
  limits: ["dailyQuota", "rateLimitPerMin"],
  probe: [],
};

export function useEmailConfig() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const canManage = useCan("workspace.email.manage", { tenantWide: true });

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [baseline, setBaseline] = useState<EmailConfig | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [draft, setDraft] = useState<EmailConfigFormValues | null>(null);
  const [activeModal, setActiveModal] = useState<EmailModalKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<"save" | "verify" | "probe" | null>(null);
  const [loadFailure, setLoadFailure] = useState<SettingsReadFailure | null>(null);
  const loadError = loadFailure?.kind === "api" ? loadFailure.error : null;
  const loadAbortRef = useRef<AbortController | null>(null);
  const writeInFlightRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<EmailConfigFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isDirty = config !== null && draft !== null ? hasEmailConfigChanges(config, draft) : false;
  const { isDiscardOpen, requestDiscard, confirmDiscard, cancelDiscard } =
    useUnsavedChangesGuard(isDirty);

  const handleReadBoundaryLoss = useCallback((error: NormalizedApiError) => {
    setConfig(null); setBaseline(null); setDraft(null); setRevision(null);
    setActiveModal(null); setFieldErrors({}); setFormError(null);
    setLoadFailure({ kind: "api", error });
  }, []);

  const conflictState = useEmailConfigConflict({
    t, lang, canManage, baseline, draft, isLoading, pending, activeModal, writeInFlightRef,
    setActiveModal, setConfig, setBaseline, setDraft, setRevision, setFieldErrors, setFormError,
    onFetchFailure: (error) => {
      const readFailure = classifySettingsFailure(error);
      if (readFailure.kind === "invalid-response") {
        setFormError(t.coreSettings.invalidResponseDescription);
        toast.error?.(t.coreSettings.emailLoadFailed, t.coreSettings.invalidResponseDescription);
        return;
      }
      const normalized = readFailure.error;
      if (normalized.code === "ACCESS_POLICY_BLOCKED" || normalized.code === NOT_READY_CODE || normalized.status === 403) {
        conflictState.resetConflictState();
        handleReadBoundaryLoss(normalized);
        return;
      }
      const detail = describeEmailConfigApiError(normalized, t);
      setFormError(detail ? `${t.coreSettings.emailLoadFailed} — ${detail}` : t.coreSettings.emailLoadFailed);
      if (!toast.outcomeFromApi?.(normalized)) toast.error?.(t.coreSettings.emailLoadFailed, detail);
    },
  });
  const { resetConflictState, openConflict } = conflictState;

  const handleWriteFailure = useCallback((error: unknown, failureTitle: string): string | undefined => {
    const outcome = classifyEmailWriteError(
      error, failureTitle, t, (normalized) => Boolean(toast.outcomeFromApi?.(normalized)),
    );
    if (!outcome || outcome.kind === "forbidden") return undefined;
    if (outcome.kind === "invalid-response") {
      setFormError(outcome.detail);
      toast.error?.(failureTitle, outcome.detail);
      return outcome.detail;
    }
    if (outcome.kind === "access-blocked") {
      resetConflictState();
      handleReadBoundaryLoss(outcome.error);
      return undefined;
    }
    if (outcome.kind === "conflict") {
      openConflict(outcome.conflict);
      return undefined;
    }
    toast.error?.(failureTitle, outcome.detail);
    setFormError(outcome.formatted);
    return outcome.formatted;
  }, [toast, t, resetConflictState, handleReadBoundaryLoss, openConflict]);

  const applyResult = useCallback((data: unknown, headers: Headers) => {
    const parsed = parseEmailConfigResponse(data);
    setConfig(parsed); setBaseline(parsed); setDraft(toEmailConfigForm(parsed));
    setRevision(readRevisionFromEtag(headers) ?? parsed.revision);
    setFieldErrors({}); setFormError(null); resetConflictState(); setActiveModal(null);
  }, [resetConflictState]);

  const actions = useEmailConfigActions({
    t, canManage, config, draft, revision, pending, isLoading,
    isConflictLoading: conflictState.isConflictLoading, conflict: conflictState.conflict,
    writeInFlightRef, setActiveModal, setPending, setFormError, applyResult, handleWriteFailure,
    toastSuccess: toast.success,
  });
  const { clearProbeOutcome } = actions;

  const load = useCallback(async (): Promise<void> => {
    loadAbortRef.current?.abort();
    resetConflictState();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setIsLoading(true);
    setLoadFailure(null);
    setFieldErrors({});
    setFormError(null);
    clearProbeOutcome();
    try {
      const result = await coreGet(EMAIL_CONFIG_PATH, {
        signal: controller.signal,
        suppressForbiddenToast: true,
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
      });
      if (controller.signal.aborted || loadAbortRef.current !== controller) return;
      const parsed = parseEmailConfigResponse(result.data);
      setConfig(parsed);
      setBaseline(parsed);
      setDraft(toEmailConfigForm(parsed));
      setRevision(readRevisionFromEtag(result.headers) ?? parsed.revision);
      resetConflictState();
    } catch (error) {
      if (isSettingsAbortError(error) || controller.signal.aborted || loadAbortRef.current !== controller) return;
      setConfig(null);
      setBaseline(null);
      setDraft(null);
      setRevision(null);
      setActiveModal(null);
      setLoadFailure(classifySettingsFailure(error));
    } finally {
      if (!controller.signal.aborted && loadAbortRef.current === controller) setIsLoading(false);
    }
  }, [clearProbeOutcome, resetConflictState]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void load(); });
    return () => { disposed = true; loadAbortRef.current?.abort(); };
  }, [load]);

  const save = useCallback(async (): Promise<void> => {
    if (
      writeInFlightRef.current || !config || !draft || revision === null || !canManage ||
      pending !== null || isLoading || conflictState.isConflictLoading || conflictState.conflict !== null
    ) return;
    setFormError(null);
    const validationErrors = validateEmailConfigDraft(config, draft, t);
    const firstInvalid = ORDERED_EMAIL_FIELDS.find((key) => Boolean(validationErrors[key]));
    if (firstInvalid) {
      setFieldErrors(validationErrors);
      const currentFields = activeModal ? MODAL_FIELDS[activeModal] : [];
      const invalidInCurrent = currentFields.find((key) => Boolean(validationErrors[key]));
      const targetField = invalidInCurrent ?? firstInvalid;
      const targetModal = invalidInCurrent && activeModal ? activeModal : modalForEmailField(targetField, activeModal);
      if (targetModal !== activeModal) setActiveModal(targetModal);
      queueMicrotask(() => focusEmailField(emailFieldAnchorId(targetField)));
      return;
    }
    setFieldErrors({});
    if (!hasEmailConfigChanges(config, draft)) {
      setFormError(t.coreSettings.emailNoChanges);
      return;
    }
    writeInFlightRef.current = true;
    setPending("save");
    try {
      const request = buildPatchEmailConfigRequest(config, draft);
      if (Object.keys(request).length === 0) {
        setFormError(t.coreSettings.emailNoChanges);
        return;
      }
      const result = await corePatch(EMAIL_CONFIG_PATH, request, {
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
        headers: { "If-Match": ifMatchHeaderValue(revision) },
      });
      clearProbeOutcome();
      applyResult(result.data, result.headers);
      toast.success?.(t.coreSettings.savedTitle, t.coreSettings.emailSaved);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_FORM_REVISION") {
        setFormError(t.coreSettings.emailFormRevision);
        return;
      }
      handleWriteFailure(error, t.coreSettings.emailSaveFailed);
    } finally {
      writeInFlightRef.current = false;
      setPending(null);
    }
  }, [
    config, draft, revision, canManage, pending, isLoading,
    conflictState.isConflictLoading, conflictState.conflict, activeModal,
    clearProbeOutcome, applyResult, handleWriteFailure, toast, t,
  ]);

  const openModal = useCallback((modal: EmailModalKind): void => {
    if (writeInFlightRef.current || pending !== null || isLoading || conflictState.conflict !== null) return;
    setFormError(null);
    if (modal !== "probe") clearProbeOutcome();
    setActiveModal(modal);
  }, [pending, isLoading, conflictState.conflict, clearProbeOutcome]);

  const closeModal = useCallback((): void => {
    if (writeInFlightRef.current || pending !== null || isLoading) return;
    if (config) setDraft(toEmailConfigForm(config));
    setFieldErrors({});
    setFormError(null);
    clearProbeOutcome();
    setActiveModal(null);
  }, [config, pending, isLoading, clearProbeOutcome]);

  const discardDraft = useCallback((): void => {
    if (!config || isLoading || pending !== null || writeInFlightRef.current) return;
    requestDiscard(() => {
      setDraft(toEmailConfigForm(config));
      setFieldErrors({});
      setFormError(null);
      clearProbeOutcome();
      setActiveModal(null);
    });
  }, [config, isLoading, pending, requestDiscard, clearProbeOutcome]);

  const reload = useCallback((): void => {
    if (isLoading || pending !== null || writeInFlightRef.current) return;
    requestDiscard(() => { setActiveModal(null); void load(); });
  }, [isLoading, pending, requestDiscard, load]);

  const isNotReady = loadError?.code === NOT_READY_CODE;
  const isAccessBlocked = loadError?.code === "ACCESS_POLICY_BLOCKED";
  const isForbidden = loadError?.status === 403 && !isAccessBlocked;
  const visibleLoadError = isNotReady || isAccessBlocked || isForbidden ? null : loadError;

  return {
    t, lang, canManage, config, baseline, draft, revision, activeModal, isLoading, pending,
    probeOutcome: actions.probeOutcome, isDirty, isDiscardOpen, isNotReady, isAccessBlocked, isForbidden,
    loadError: visibleLoadError,
    hasLoadError: visibleLoadError !== null || loadFailure?.kind === "invalid-response",
    loadErrorMessage: loadFailure?.kind === "invalid-response"
      ? t.coreSettings.invalidResponseDescription
      : describeEmailConfigApiError(visibleLoadError, t),
    fieldErrors, formError, conflict: conflictState.conflict,
    conflictReview: conflictState.conflictReview, isConflictLoading: conflictState.isConflictLoading,
    openModal, closeModal, discardDraft, confirmDiscard, cancelDiscard,
    updateDraft: (patch: Partial<EmailConfigFormValues>) => {
      setFormError(null);
      clearProbeOutcome();
      setFieldErrors((current) => {
        if (Object.keys(current).length === 0) return current;
        const next = { ...current };
        for (const key of Object.keys(patch) as EmailConfigFieldKey[]) delete next[key];
        if (patch.providerDriver && patch.providerDriver !== "smtp") {
          for (const smtpKey of SMTP_FIELD_KEYS) delete next[smtpKey];
        }
        return next;
      });
      setDraft((current) => (current ? { ...current, ...patch } : current));
    },
    resetConflict: resetConflictState, dismissConflict: conflictState.dismissConflict,
    resolveConflict: conflictState.resolveConflict, adoptConflictLatest: conflictState.adoptConflictLatest,
    discardConflictDraft: conflictState.discardConflictDraft,
    setDeliveryStatus: actions.setDeliveryStatus, save,
    verify: actions.verify, verifyConnection: actions.verifyConnection, reload,
  };
}
