"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  buildSmtpPatch,
  formFromSmtpConfig,
  isSmtpFormDirty,
  readSmtpAuditEnvelope,
  readSmtpConfigEnvelope,
  readSmtpVerificationEnvelope,
  type CoreSnapshot,
  type PlatformSmtpConfig,
  type SmtpAuditLog,
  type SmtpField,
  type SmtpFormState,
  type SmtpValidationErrors,
} from "../smtp-contract";
import type { SettingsLoadState } from "../../hooks/useSettings";

const SAVE_PERMISSIONS = [
  "admin.settings.update",
  "admin.settings.critical",
] as const;

type SmtpMutation = {
  action: "SAVE" | "VERIFY" | null;
  phase: "IDLE" | "PENDING" | "SUCCEEDED" | "FAILED";
  error: NormalizedApiError | null;
  localCode: string | null;
  correlationId: string | null;
};

const EMPTY_MUTATION: SmtpMutation = {
  action: null,
  phase: "IDLE",
  error: null,
  localCode: null,
  correlationId: null,
};

export function useSmtpSettings() {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.settings.read");
  const canSaveCritical = adminCanAll(user, SAVE_PERMISSIONS);
  const canVerify = adminCan(user, "admin.settings.update");
  const [snapshot, setSnapshot] = useState<CoreSnapshot<PlatformSmtpConfig> | null>(null);
  const [form, setForm] = useState<SmtpFormState | null>(null);
  const [password, setPasswordState] = useState("");
  const [auditLogs, setAuditLogs] = useState<SmtpAuditLog[]>([]);
  const [configState, setConfigState] = useState<SettingsLoadState>("LOADING");
  const [auditState, setAuditState] = useState<SettingsLoadState>("LOADING");
  const [configError, setConfigError] = useState<NormalizedApiError | null>(null);
  const [auditError, setAuditError] = useState<NormalizedApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SmtpValidationErrors>({});
  const [mutation, setMutation] = useState<SmtpMutation>(EMPTY_MUTATION);
  const configGeneration = useRef(0);
  const auditGeneration = useRef(0);
  const saveIntent = useRef<{ fingerprint: string; key: string } | null>(null);
  // Bound to the configuration it was raised for. A verification carries no
  // body, so its idempotency key is the *only* thing that distinguishes one
  // probe from another: an unbound key retained past a save lets the Gateway
  // answer a probe of revision B by replaying revision A's stored success.
  const verifyIntent = useRef<{ configuration: string; key: string } | null>(
    null,
  );

  const fetchConfig = useCallback(async () => {
    const generation = ++configGeneration.current;
    if (isAuthLoading) {
      setConfigState("LOADING");
      return;
    }
    if (!canRead) {
      setSnapshot(null);
      setForm(null);
      setConfigError(null);
      setConfigState("FORBIDDEN");
      return;
    }
    setConfigState("LOADING");
    setConfigError(null);
    try {
      const response = await axiosClient.get<unknown>(
        "/api/admin/core/v1/system-settings/email",
        { cache: "no-store" },
      );
      if (generation !== configGeneration.current) return;
      const result = readSmtpConfigEnvelope(response.data);
      setSnapshot(result);
      setForm(formFromSmtpConfig(result.data));
      setPasswordState("");
      setFieldErrors({});
      saveIntent.current = null;
      setConfigState("READY");
    } catch (caught) {
      if (generation !== configGeneration.current) return;
      const normalized = normalizeApiError(caught);
      setSnapshot(null);
      setForm(null);
      setConfigError(normalized);
      setConfigState(classifyLoadError(normalized));
    }
  }, [canRead, isAuthLoading]);

  const fetchAudit = useCallback(async () => {
    const generation = ++auditGeneration.current;
    if (isAuthLoading) {
      setAuditState("LOADING");
      return;
    }
    if (!canRead) {
      setAuditLogs([]);
      setAuditError(null);
      setAuditState("FORBIDDEN");
      return;
    }
    setAuditState("LOADING");
    setAuditError(null);
    try {
      const response = await axiosClient.get<unknown>(
        "/api/admin/core/v1/system-settings/email/audit",
        { cache: "no-store" },
      );
      if (generation !== auditGeneration.current) return;
      const result = readSmtpAuditEnvelope(response.data);
      setAuditLogs(result.data);
      setAuditState("READY");
    } catch (caught) {
      if (generation !== auditGeneration.current) return;
      const normalized = normalizeApiError(caught);
      setAuditLogs([]);
      setAuditError(normalized);
      setAuditState(classifyLoadError(normalized));
    }
  }, [canRead, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchConfig();
      void fetchAudit();
    });
  }, [fetchAudit, fetchConfig]);

  const handleUpdate = useCallback(
    <K extends keyof SmtpFormState>(field: K, value: SmtpFormState[K]) => {
      if (!canSaveCritical) return;
      setForm((current) => (current ? { ...current, [field]: value } : current));
      setFieldErrors((current) => without(current, field));
      saveIntent.current = null;
      setMutation(EMPTY_MUTATION);
    },
    [canSaveCritical],
  );
  const setPassword = useCallback(
    (value: string) => {
      if (!canSaveCritical) return;
      setPasswordState(value);
      setFieldErrors((current) => without(current, "smtpPassword"));
      saveIntent.current = null;
      setMutation(EMPTY_MUTATION);
    },
    [canSaveCritical],
  );

  const hasUnsavedChanges = useMemo(
    () => Boolean(snapshot && form && isSmtpFormDirty(form, password, snapshot.data)),
    [form, password, snapshot],
  );

  const saveConfig = useCallback(async () => {
    if (!snapshot || !form || !canSaveCritical || mutation.phase === "PENDING") {
      setMutation({ ...EMPTY_MUTATION, action: "SAVE", phase: "FAILED", localCode: "SAVE_PERMISSION_OR_STATE_REQUIRED" });
      return false;
    }
    const { dto, errors } = buildSmtpPatch(form, password, snapshot.data);
    setFieldErrors(errors);
    if (Object.keys(errors).length || !Object.keys(dto).length) {
      setMutation({ ...EMPTY_MUTATION, action: "SAVE", phase: "FAILED", localCode: Object.keys(errors).length ? "SMTP_VALIDATION_FAILED" : "NO_SMTP_CHANGES" });
      return false;
    }
    const fingerprint = JSON.stringify(dto);
    const key = saveIntent.current?.fingerprint === fingerprint
      ? saveIntent.current.key
      : generateUUIDv7();
    saveIntent.current = { fingerprint, key };
    setMutation({ action: "SAVE", phase: "PENDING", error: null, localCode: null, correlationId: null });
    try {
      const response = await axiosClient.patch<unknown>(
        "/api/admin/core/v1/system-settings/email",
        dto,
        { headers: { "x-idempotency-key": key } },
      );
      const result = readSmtpConfigEnvelope(response.data);
      saveIntent.current = null;
      setSnapshot(result);
      setForm(formFromSmtpConfig(result.data));
      setPasswordState("");
      setFieldErrors({});
      setMutation({ action: "SAVE", phase: "SUCCEEDED", error: null, localCode: null, correlationId: result.correlationId });
      void fetchAudit();
      return true;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (!retainIntent(normalized)) saveIntent.current = null;
      setMutation({ action: "SAVE", phase: "FAILED", error: normalized, localCode: null, correlationId: normalized.correlationId ?? null });
      return false;
    }
  }, [canSaveCritical, fetchAudit, form, mutation.phase, password, snapshot]);

  const verifyConnection = useCallback(async () => {
    if (
      !snapshot?.data.configured ||
      !canVerify ||
      hasUnsavedChanges ||
      mutation.phase === "PENDING"
    ) {
      setMutation({ ...EMPTY_MUTATION, action: "VERIFY", phase: "FAILED", localCode: hasUnsavedChanges ? "SAVE_BEFORE_VERIFY" : "VERIFY_PERMISSION_OR_STATE_REQUIRED" });
      return false;
    }
    // Retry the same probe, never a different configuration's probe.
    const configuration = smtpConfigIdentity(snapshot.data);
    const key =
      verifyIntent.current?.configuration === configuration
        ? verifyIntent.current.key
        : generateUUIDv7();
    verifyIntent.current = { configuration, key };
    setMutation({ action: "VERIFY", phase: "PENDING", error: null, localCode: null, correlationId: null });
    try {
      const response = await axiosClient.post<unknown>(
        "/api/admin/core/v1/system-settings/email/verify-connection",
        undefined,
        { headers: { "x-idempotency-key": key } },
      );
      const result = readSmtpVerificationEnvelope(response.data);
      verifyIntent.current = null;
      setMutation({ action: "VERIFY", phase: "SUCCEEDED", error: null, localCode: null, correlationId: result.correlationId });
      void fetchAudit();
      return true;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (!retainIntent(normalized)) verifyIntent.current = null;
      setMutation({ action: "VERIFY", phase: "FAILED", error: normalized, localCode: null, correlationId: normalized.correlationId ?? null });
      return false;
    }
  }, [canVerify, fetchAudit, hasUnsavedChanges, mutation.phase, snapshot]);

  return {
    lang,
    snapshot,
    form,
    password,
    auditLogs,
    configState,
    auditState,
    configError,
    auditError,
    fieldErrors,
    mutation,
    canRead,
    canSaveCritical,
    canVerify,
    hasUnsavedChanges,
    canTestSavedConfig: Boolean(
      snapshot?.data.configured && canVerify && !hasUnsavedChanges && configState === "READY",
    ),
    handleUpdate,
    setPassword,
    saveConfig,
    verifyConnection,
    refetchConfig: fetchConfig,
    refetchAudit: fetchAudit,
  };
}

function classifyLoadError(error: NormalizedApiError): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") return "UNAVAILABLE";
  return "ERROR";
}

/**
 * Which saved configuration a verification result is about.
 *
 * `revision` is Core's own counter for the stored configuration and is what
 * makes this correct; `updatedAt` is carried with it so a backend that ever
 * reissued a revision number could not silently make two configurations look
 * like one to the retry logic.
 */
function smtpConfigIdentity(config: PlatformSmtpConfig): string {
  return `${config.revision}:${config.updatedAt}`;
}

function retainIntent(error: NormalizedApiError): boolean {
  return (
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

function without(errors: SmtpValidationErrors, field: SmtpField): SmtpValidationErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
