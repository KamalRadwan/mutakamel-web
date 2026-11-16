"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { coreGet } from "../../../core-api";
import { isSettingsAbortError } from "../../settings-failure";
import {
  compareEmailConfigConflict, hasServerConfigChanged,
  mergeDraftOntoLatestConfig, type EmailConflictReview,
} from "../email-config-conflict";
import {
  EMAIL_CONFIG_PATH, hasEmailConfigChanges, readRevisionFromEtag,
  toEmailConfigForm, type EmailConfig, type EmailConfigFormValues,
} from "../email-config-contract";
import { validateEmailConfigDraft, type EmailConfigFieldErrors } from "../email-config-messages";
import {
  ORDERED_EMAIL_FIELDS, emailFieldAnchorId, focusEmailField, modalForEmailField,
  type EmailModalKind,
} from "../email-form-navigation";
import { parseEmailConfigResponse } from "../email-config-response";

const CONFIG_RESPONSE_LIMIT_BYTES = 40_000;

/** Which precondition failure the server reported; 428 and 409 stay distinct. */
export type EmailConflictKind = "preconditionRequired" | "staleRevision";

interface UseEmailConfigConflictOptions {
  t: Dictionary;
  lang: "en" | "ar";
  canManage: boolean;
  baseline: EmailConfig | null;
  draft: EmailConfigFormValues | null;
  isLoading: boolean;
  pending: "save" | "verify" | "probe" | null;
  activeModal: EmailModalKind | null;
  writeInFlightRef: MutableRefObject<boolean>;
  setActiveModal: (modal: EmailModalKind | null) => void;
  setConfig: (config: EmailConfig) => void;
  setBaseline: (config: EmailConfig) => void;
  setDraft: (draft: EmailConfigFormValues) => void;
  setRevision: (revision: number) => void;
  setFieldErrors: (errors: EmailConfigFieldErrors) => void;
  setFormError: (error: string | null) => void;
  onFetchFailure: (error: unknown) => void;
}

export function useEmailConfigConflict({
  t, lang, canManage, baseline, draft, isLoading, pending, activeModal, writeInFlightRef,
  setActiveModal, setConfig, setBaseline, setDraft, setRevision, setFieldErrors, setFormError,
  onFetchFailure,
}: UseEmailConfigConflictOptions) {
  const [conflict, setConflict] = useState<EmailConflictKind | null>(null);
  const [conflictReview, setConflictReview] = useState<EmailConflictReview | null>(null);
  const [isConflictLoading, setIsConflictLoading] = useState(false);
  const returnModalRef = useRef<EmailModalKind | null>(null);
  const reviewAbortRef = useRef<AbortController | null>(null);
  const reviewRequestIdRef = useRef(0);
  const disposedRef = useRef(false);

  const cancelConflictFetch = useCallback((): void => {
    reviewRequestIdRef.current += 1;
    if (reviewAbortRef.current !== null) {
      reviewAbortRef.current.abort();
      reviewAbortRef.current = null;
      writeInFlightRef.current = false;
    }
  }, [writeInFlightRef]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      cancelConflictFetch();
    };
  }, [cancelConflictFetch]);

  useEffect(() => {
    if (!canManage && (conflict !== null || reviewAbortRef.current !== null)) {
      cancelConflictFetch();
      returnModalRef.current = null;
      setIsConflictLoading(false);
      setConflict(null);
      setConflictReview(null);
    }
  }, [canManage, conflict, cancelConflictFetch]);

  const resetConflictState = useCallback((): void => {
    cancelConflictFetch();
    returnModalRef.current = null;
    if (!disposedRef.current) {
      setIsConflictLoading(false);
      setConflict(null);
      setConflictReview(null);
    }
  }, [cancelConflictFetch]);

  const openConflict = useCallback((kind: EmailConflictKind): void => {
    if (disposedRef.current) return;
    cancelConflictFetch();
    if (activeModal !== null) {
      returnModalRef.current = activeModal;
      setActiveModal(null);
    }
    setIsConflictLoading(false);
    setConflictReview(null);
    setConflict(kind);
  }, [activeModal, cancelConflictFetch, setActiveModal]);

  const dismissConflict = useCallback((): void => {
    if (isConflictLoading || writeInFlightRef.current) return;
    setFormError(null);
    setConflict(null);
    setConflictReview(null);
    if (returnModalRef.current !== null) {
      setActiveModal(returnModalRef.current);
      returnModalRef.current = null;
    }
  }, [isConflictLoading, writeInFlightRef, setFormError, setActiveModal]);

  const resolveConflict = useCallback(async (): Promise<void> => {
    if (
      disposedRef.current || !canManage || !conflict || writeInFlightRef.current ||
      reviewAbortRef.current !== null || isConflictLoading || pending !== null || isLoading
    ) return;

    const controller = new AbortController();
    reviewAbortRef.current = controller;
    reviewRequestIdRef.current += 1;
    const requestId = reviewRequestIdRef.current;
    writeInFlightRef.current = true;
    setIsConflictLoading(true);
    setFormError(null);

    const isStaleOrAborted = () =>
      disposedRef.current ||
      controller.signal.aborted ||
      reviewAbortRef.current !== controller ||
      reviewRequestIdRef.current !== requestId;

    try {
      const result = await coreGet(EMAIL_CONFIG_PATH, {
        signal: controller.signal,
        suppressForbiddenToast: true,
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
      });
      if (isStaleOrAborted()) return;

      const latestConfig = parseEmailConfigResponse(result.data);
      const latestRevision = readRevisionFromEtag(result.headers) ?? latestConfig.revision;
      if (isStaleOrAborted()) return;

      if (conflict === "preconditionRequired") {
        const draftDirty =
          baseline !== null && draft !== null && hasEmailConfigChanges(baseline, draft);
        if (!draftDirty || !baseline || !draft) {
          setConfig(latestConfig);
          setBaseline(latestConfig);
          setDraft(toEmailConfigForm(latestConfig));
          setRevision(latestRevision);
          setFieldErrors({});
          setFormError(null);
          resetConflictState();
          return;
        }
        if (!hasServerConfigChanged(baseline, latestConfig)) {
          setConfig(latestConfig);
          setBaseline(latestConfig);
          setRevision(latestRevision);
          setFormError(null);
          setConflict(null);
          setConflictReview(null);
          if (returnModalRef.current !== null) {
            setActiveModal(returnModalRef.current);
            returnModalRef.current = null;
          }
          return;
        }
        setConflict("staleRevision");
        setConflictReview({
          latestConfig,
          latestRevision,
          diffRows: compareEmailConfigConflict(baseline, draft, latestConfig, t, lang),
        });
        return;
      }

      const diffRows =
        baseline && draft
          ? compareEmailConfigConflict(baseline, draft, latestConfig, t, lang)
          : [];
      setConflictReview({ latestConfig, latestRevision, diffRows });
    } catch (error) {
      if (isSettingsAbortError(error) || isStaleOrAborted()) return;
      onFetchFailure(error);
    } finally {
      if (reviewAbortRef.current === controller) {
        reviewAbortRef.current = null;
        writeInFlightRef.current = false;
        if (!disposedRef.current) setIsConflictLoading(false);
      }
    }
  }, [
    canManage, conflict, writeInFlightRef, isConflictLoading, pending, isLoading,
    baseline, draft, t, lang, setConfig, setBaseline, setDraft, setRevision,
    setFieldErrors, setFormError, setActiveModal, resetConflictState, onFetchFailure,
  ]);

  const adoptConflictLatest = useCallback((): void => {
    if (
      disposedRef.current || !canManage || !conflictReview ||
      writeInFlightRef.current || isConflictLoading || pending !== null
    ) return;
    const nextDraft =
      baseline && draft
        ? mergeDraftOntoLatestConfig(baseline, draft, conflictReview.latestConfig)
        : toEmailConfigForm(conflictReview.latestConfig);
    const validationErrors = validateEmailConfigDraft(conflictReview.latestConfig, nextDraft, t);
    const firstInvalid = ORDERED_EMAIL_FIELDS.find((key) => Boolean(validationErrors[key]));
    setConfig(conflictReview.latestConfig);
    setBaseline(conflictReview.latestConfig);
    setRevision(conflictReview.latestRevision);
    setDraft(nextDraft);
    setFieldErrors(validationErrors);
    setFormError(null);
    setConflict(null);
    setConflictReview(null);
    const nextModal = firstInvalid
      ? modalForEmailField(firstInvalid, returnModalRef.current)
      : returnModalRef.current;
    returnModalRef.current = null;
    if (nextModal !== null) {
      setActiveModal(nextModal);
      if (firstInvalid) {
        queueMicrotask(() => focusEmailField(emailFieldAnchorId(firstInvalid)));
      }
    }
  }, [
    canManage, conflictReview, writeInFlightRef, isConflictLoading, pending,
    baseline, draft, t, setConfig, setBaseline, setRevision, setDraft,
    setFieldErrors, setFormError, setActiveModal,
  ]);

  const discardConflictDraft = useCallback((): void => {
    if (
      disposedRef.current || !conflictReview ||
      writeInFlightRef.current || isConflictLoading || pending !== null
    ) return;
    setConfig(conflictReview.latestConfig);
    setBaseline(conflictReview.latestConfig);
    setRevision(conflictReview.latestRevision);
    setDraft(toEmailConfigForm(conflictReview.latestConfig));
    setFieldErrors({});
    setFormError(null);
    resetConflictState();
    setActiveModal(null);
  }, [
    conflictReview, writeInFlightRef, isConflictLoading, pending, setConfig, setBaseline,
    setRevision, setDraft, setFieldErrors, setFormError, resetConflictState, setActiveModal,
  ]);

  return {
    conflict, conflictReview, isConflictLoading, resetConflictState,
    openConflict, dismissConflict, resolveConflict, adoptConflictLatest, discardConflictDraft,
  };
}
