"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { coreGet, corePatch, corePost } from "../../../core-api";
import {
  EMAIL_CONFIG_PATH,
  EMAIL_CONFIG_VERIFY_CONNECTION_PATH,
  EMAIL_CONFIG_VERIFY_PATH,
  NOT_READY_CODE,
  PRECONDITION_REQUIRED_CODE,
  STALE_REVISION_CODE,
  buildPatchEmailConfigRequest,
  ifMatchHeaderValue,
  readRevisionFromEtag,
  toEmailConfigForm,
  type EmailConfig,
  type EmailConfigFormValues,
} from "../email-config-contract";
import {
  parseEmailConfigResponse,
  parseVerifyConnectionResponse,
} from "../email-config-response";
import { emailConfigMessage } from "../email-config-messages";

const CONFIG_RESPONSE_LIMIT_BYTES = 40_000;

/** Which precondition failure the server reported; the two need different copy. */
export type EmailConflictKind = "preconditionRequired" | "staleRevision";

export function useEmailConfig() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("workspace.email.manage") ?? false;

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [draft, setDraft] = useState<EmailConfigFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<"save" | "verify" | "probe" | null>(null);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<EmailConflictKind | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await coreGet(EMAIL_CONFIG_PATH, {
        signal,
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
      });
      const parsed = parseEmailConfigResponse(result.data);
      setConfig(parsed);
      setDraft(toEmailConfigForm(parsed));
      // The ETag header is the precondition's authority. The body's `revision`
      // is the same integer by construction and covers a hop that strips the
      // header, so a write is never left without a precondition to send.
      setRevision(readRevisionFromEtag(result.headers) ?? parsed.revision);
    } catch (error) {
      if (isAbortError(error)) return;
      setConfig(null);
      setDraft(null);
      setRevision(null);
      setLoadError(normalizeApiError(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const applyResult = useCallback((data: unknown, headers: Headers) => {
    const parsed = parseEmailConfigResponse(data);
    setConfig(parsed);
    setDraft(toEmailConfigForm(parsed));
    setRevision(readRevisionFromEtag(headers) ?? parsed.revision);
  }, []);

  const handleWriteFailure = useCallback(
    (error: unknown, failureTitle: string): void => {
      const normalized = normalizeApiError(error);
      if (normalized.status === 403) return;
      if (normalized.code === PRECONDITION_REQUIRED_CODE || normalized.status === 428) {
        setConflict("preconditionRequired");
        return;
      }
      if (normalized.code === STALE_REVISION_CODE) {
        setConflict("staleRevision");
        return;
      }
      if (toast.outcomeFromApi(normalized)) return;
      const specific = emailConfigMessage(normalized.code, t);
      if (specific) {
        toast.error(failureTitle, specific);
        return;
      }
      toast.errorFromApi(failureTitle, normalized);
    },
    [toast, t],
  );

  const save = useCallback(async (): Promise<void> => {
    if (!config || !draft || revision === null || !canManage || pending) return;
    setPending("save");
    setFormError(null);
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
      applyResult(result.data, result.headers);
      toast.success(t.coreSettings.savedTitle, t.coreSettings.emailSaved);
    } catch (error) {
      const formMessageText = formMessage(error, t);
      if (formMessageText) {
        setFormError(formMessageText);
        return;
      }
      handleWriteFailure(error, t.coreSettings.emailSaveFailed);
    } finally {
      setPending(null);
    }
  }, [config, draft, revision, canManage, pending, applyResult, handleWriteFailure, toast, t]);

  const verify = useCallback(async (): Promise<void> => {
    if (revision === null || !canManage || pending) return;
    setPending("verify");
    try {
      // The command takes no body — sending one is a 400 by contract.
      const result = await corePost(EMAIL_CONFIG_VERIFY_PATH, undefined, {
        maxResponseBytes: CONFIG_RESPONSE_LIMIT_BYTES,
        headers: { "If-Match": ifMatchHeaderValue(revision) },
      });
      applyResult(result.data, result.headers);
      toast.success(t.coreSettings.emailVerifiedTitle, t.coreSettings.emailVerifiedMessage);
    } catch (error) {
      handleWriteFailure(error, t.coreSettings.emailVerifyFailed);
    } finally {
      setPending(null);
    }
  }, [revision, canManage, pending, applyResult, handleWriteFailure, toast, t]);

  const verifyConnection = useCallback(async (): Promise<void> => {
    if (!canManage || pending) return;
    setPending("probe");
    try {
      const result = await corePost(EMAIL_CONFIG_VERIFY_CONNECTION_PATH, undefined, {
        maxResponseBytes: 10_000,
      });
      parseVerifyConnectionResponse(result.data);
      // The probe is deliberately vague about network detail; it is not a
      // diagnostic log and is not presented as one.
      toast.success(t.coreSettings.emailProbeTitle, t.coreSettings.emailProbeMessage);
    } catch (error) {
      handleWriteFailure(error, t.coreSettings.emailProbeFailed);
    } finally {
      setPending(null);
    }
  }, [canManage, pending, handleWriteFailure, toast, t]);

  const resolveConflict = useCallback(async (): Promise<void> => {
    setConflict(null);
    await load();
  }, [load]);

  return {
    t,
    lang,
    canManage,
    config,
    draft,
    revision,
    isLoading,
    pending,
    isNotReady: loadError?.code === NOT_READY_CODE,
    loadError: loadError?.code === NOT_READY_CODE ? null : loadError,
    formError,
    conflict,
    updateDraft: (patch: Partial<EmailConfigFormValues>) => {
      setFormError(null);
      setDraft((current) => (current ? { ...current, ...patch } : current));
    },
    dismissConflict: () => setConflict(null),
    resolveConflict,
    save,
    verify,
    verifyConnection,
    reload: () => load(),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

/** Client-side form stops, raised before any request leaves. */
function formMessage(error: unknown, t: Dictionary): string | null {
  const reason = error instanceof Error ? error.message : "";
  switch (reason) {
    case "EMAIL_FORM_FROM_ADDRESS":
      return t.coreSettings.emailFormFromAddress;
    case "EMAIL_FORM_FROM_NAME":
      return t.coreSettings.emailFormFromName;
    case "EMAIL_FORM_SENDER_DOMAIN":
      return t.coreSettings.emailFormSenderDomain;
    case "EMAIL_FORM_DKIM_SELECTOR":
      return t.coreSettings.emailFormDkimSelector;
    case "EMAIL_FORM_SMTP_HOST":
      return t.coreSettings.emailFormSmtpHost;
    case "EMAIL_FORM_SMTP_PORT":
      return t.coreSettings.emailFormSmtpPort;
    case "EMAIL_FORM_SMTP_USERNAME":
      return t.coreSettings.emailFormSmtpUsername;
    case "EMAIL_FORM_SMTP_PASSWORD":
      return t.coreSettings.emailFormSmtpPassword;
    case "EMAIL_FORM_REVISION":
      return t.coreSettings.emailFormRevision;
    default:
      return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
