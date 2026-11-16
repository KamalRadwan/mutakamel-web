"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { corePatch, corePost } from "../../../core-api";
import {
  EMAIL_CONFIG_PATH,
  EMAIL_CONFIG_VERIFY_CONNECTION_PATH,
  EMAIL_CONFIG_VERIFY_PATH,
  canSelectEmailConfigStatus,
  hasEmailConfigChanges,
  ifMatchHeaderValue,
  type EmailConfig,
  type EmailConfigFormValues,
  type EmailConfigStatus,
} from "../email-config-contract";
import type { EmailModalKind } from "../email-form-navigation";
import { parseVerifyConnectionResponse } from "../email-config-response";
import type { EmailConflictKind } from "./useEmailConfigConflict";

const CONFIG_RESPONSE_LIMIT_BYTES = 40_000;

export interface EmailProbeOutcome {
  status: "succeeded" | "failed";
  message: string;
}

interface UseEmailConfigActionsOptions {
  t: Dictionary;
  canManage: boolean;
  config: EmailConfig | null;
  draft: EmailConfigFormValues | null;
  revision: number | null;
  pending: "save" | "verify" | "probe" | null;
  isLoading: boolean;
  isConflictLoading: boolean;
  conflict: EmailConflictKind | null;
  writeInFlightRef: MutableRefObject<boolean>;
  setActiveModal: (modal: EmailModalKind | null) => void;
  setPending: (pending: "save" | "verify" | "probe" | null) => void;
  setFormError: (error: string | null) => void;
  applyResult: (data: unknown, headers: Headers) => void;
  handleWriteFailure: (error: unknown, failureTitle: string) => string | undefined;
  toastSuccess: (title: string, description?: string) => void;
}

export function useEmailConfigActions({
  t,
  canManage,
  config,
  draft,
  revision,
  pending,
  isLoading,
  isConflictLoading,
  conflict,
  writeInFlightRef,
  setActiveModal,
  setPending,
  setFormError,
  applyResult,
  handleWriteFailure,
  toastSuccess,
}: UseEmailConfigActionsOptions) {
  const [probeOutcome, setProbeOutcome] = useState<EmailProbeOutcome | null>(null);

  const clearProbeOutcome = useCallback((): void => {
    setProbeOutcome(null);
  }, []);

  const canRunSavedAction = useCallback((): boolean => {
    return (
      !writeInFlightRef.current &&
      config !== null &&
      draft !== null &&
      canManage &&
      pending === null &&
      !isLoading &&
      !isConflictLoading &&
      conflict === null &&
      !hasEmailConfigChanges(config, draft)
    );
  }, [writeInFlightRef, config, draft, canManage, pending, isLoading, isConflictLoading, conflict]);

  const setDeliveryStatus = useCallback(
    async (nextStatus: EmailConfigStatus): Promise<void> => {
      if (
        !canRunSavedAction() ||
        !config ||
        revision === null ||
        nextStatus === config.status ||
        !canSelectEmailConfigStatus(config, nextStatus)
      ) {
        return;
      }
      writeInFlightRef.current = true;
      setFormError(null);
      setPending("save");
      try {
        // Sending `{ status }` alone preserves backend `statusOnlySuspension`
        // emergency kill-switch semantics even when provider credentials need repair.
        const result = await corePatch(
          EMAIL_CONFIG_PATH,
          { status: nextStatus },
          {
            maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
            headers: { "If-Match": ifMatchHeaderValue(revision) },
          },
        );
        applyResult(result.data, result.headers);
        toastSuccess(t.coreSettings.savedTitle, t.coreSettings.emailSaved);
      } catch (error) {
        handleWriteFailure(error, t.coreSettings.emailSaveFailed);
      } finally {
        writeInFlightRef.current = false;
        setPending(null);
      }
    },
    [
      canRunSavedAction,
      config,
      revision,
      writeInFlightRef,
      setFormError,
      setPending,
      applyResult,
      toastSuccess,
      handleWriteFailure,
      t,
    ],
  );

  const verify = useCallback(async (): Promise<void> => {
    if (!canRunSavedAction() || revision === null) return;
    writeInFlightRef.current = true;
    setFormError(null);
    setPending("verify");
    try {
      // The command takes no body — sending one is a 400 by contract.
      const result = await corePost(EMAIL_CONFIG_VERIFY_PATH, undefined, {
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
        headers: { "If-Match": ifMatchHeaderValue(revision) },
      });
      applyResult(result.data, result.headers);
      toastSuccess(t.coreSettings.emailVerifiedTitle, t.coreSettings.emailVerifiedMessage);
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_FORM_REVISION") {
        setFormError(t.coreSettings.emailFormRevision);
        return;
      }
      handleWriteFailure(error, t.coreSettings.emailVerifyFailed);
    } finally {
      writeInFlightRef.current = false;
      setPending(null);
    }
  }, [
    canRunSavedAction,
    revision,
    writeInFlightRef,
    setFormError,
    setPending,
    applyResult,
    toastSuccess,
    handleWriteFailure,
    t,
  ]);

  const verifyConnection = useCallback(async (): Promise<void> => {
    if (!canRunSavedAction() || config?.providerDriver !== "smtp") return;
    writeInFlightRef.current = true;
    setFormError(null);
    setProbeOutcome(null);
    setActiveModal("probe");
    setPending("probe");
    try {
      const result = await corePost(EMAIL_CONFIG_VERIFY_CONNECTION_PATH, undefined, {
        maxResponseBytes: 10_000,
      });
      parseVerifyConnectionResponse(result.data);
      setProbeOutcome({ status: "succeeded", message: t.coreSettings.emailProbeMessage });
      toastSuccess(t.coreSettings.emailProbeTitle, t.coreSettings.emailProbeMessage);
    } catch (error) {
      const message = handleWriteFailure(error, t.coreSettings.emailProbeFailed);
      if (message) {
        setProbeOutcome({ status: "failed", message });
      } else {
        setActiveModal(null);
      }
    } finally {
      writeInFlightRef.current = false;
      setPending(null);
    }
  }, [
    canRunSavedAction,
    config,
    writeInFlightRef,
    setActiveModal,
    setFormError,
    setPending,
    toastSuccess,
    handleWriteFailure,
    t,
  ]);

  return {
    probeOutcome,
    clearProbeOutcome,
    setDeliveryStatus,
    verify,
    verifyConnection,
  };
}
