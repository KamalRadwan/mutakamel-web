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
import type { SettingsLoadState } from "../../hooks/useSettings";
import {
  buildFatalAlertPatch,
  formFromConfig,
  isFatalAlertFormDirty,
  readFatalAlertConfigEnvelope,
  type CoreSnapshot,
  type FatalAlertField,
  type FatalAlertFormState,
  type FatalAlertValidationErrors,
  type RealtimeFatalAlertConfig,
} from "../fatal-alert-contract";

const SAVE_PERMISSIONS = [
  "admin.settings.update",
  "admin.settings.critical",
] as const;

type MutationState = {
  phase: "IDLE" | "PENDING" | "SUCCEEDED" | "FAILED";
  error: NormalizedApiError | null;
  localCode: string | null;
  correlationId: string | null;
};

const EMPTY_MUTATION: MutationState = {
  phase: "IDLE",
  error: null,
  localCode: null,
  correlationId: null,
};

export function useFatalAlertSettings() {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canRead = adminCan(user, "admin.settings.read");
  const canSaveCritical = adminCanAll(user, SAVE_PERMISSIONS);
  const [snapshot, setSnapshot] = useState<CoreSnapshot<RealtimeFatalAlertConfig> | null>(null);
  const [form, setForm] = useState<FatalAlertFormState | null>(null);
  const [token, setTokenState] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FatalAlertValidationErrors>({});
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<MutationState>(EMPTY_MUTATION);
  const generation = useRef(0);
  const saveIntent = useRef<{ fingerprint: string; key: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    const currentGeneration = ++generation.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      setSnapshot(null);
      setForm(null);
      setLoadError(null);
      setLoadState("FORBIDDEN");
      return;
    }
    setLoadState("LOADING");
    setLoadError(null);
    try {
      const response = await axiosClient.get<unknown>(
        "/api/admin/core/v1/system-settings/fatal-alerts",
        { cache: "no-store" },
      );
      if (currentGeneration !== generation.current) return;
      const result = readFatalAlertConfigEnvelope(response.data);
      setSnapshot(result);
      setForm(formFromConfig(result.data));
      setTokenState("");
      setFieldErrors({});
      saveIntent.current = null;
      setMutation(EMPTY_MUTATION);
      setLoadState("READY");
    } catch (caught) {
      if (currentGeneration !== generation.current) return;
      const normalized = normalizeApiError(caught);
      setSnapshot(null);
      setForm(null);
      setLoadError(normalized);
      setLoadState(classifyLoadError(normalized));
    }
  }, [canRead, isAuthLoading]);

  useEffect(() => {
    queueMicrotask(() => void fetchConfig());
  }, [fetchConfig]);

  const update = useCallback(
    <K extends keyof FatalAlertFormState>(field: K, value: FatalAlertFormState[K]) => {
      if (!canSaveCritical) return;
      setForm((current) => (current ? { ...current, [field]: value } : current));
      setFieldErrors((current) => without(current, field));
      saveIntent.current = null;
      setMutation(EMPTY_MUTATION);
    },
    [canSaveCritical],
  );

  const setToken = useCallback(
    (value: string) => {
      if (!canSaveCritical) return;
      setTokenState(value);
      setFieldErrors((current) => without(current, "webhookToken"));
      saveIntent.current = null;
      setMutation(EMPTY_MUTATION);
    },
    [canSaveCritical],
  );

  const hasUnsavedChanges = useMemo(
    () => Boolean(snapshot && form && isFatalAlertFormDirty(form, token, snapshot.data)),
    [form, snapshot, token],
  );

  const save = useCallback(async () => {
    if (!snapshot || !form || !canSaveCritical || mutation.phase === "PENDING") {
      setMutation({ ...EMPTY_MUTATION, phase: "FAILED", localCode: "SAVE_PERMISSION_OR_STATE_REQUIRED" });
      return false;
    }
    const result = buildFatalAlertPatch(form, token, snapshot.data);
    setFieldErrors(result.errors);
    if (Object.keys(result.errors).length || !Object.keys(result.dto).length) {
      setMutation({
        ...EMPTY_MUTATION,
        phase: "FAILED",
        localCode: Object.keys(result.errors).length
          ? "FATAL_ALERT_VALIDATION_FAILED"
          : "NO_FATAL_ALERT_CHANGES",
      });
      return false;
    }
    const fingerprint = JSON.stringify(result.dto);
    const key = saveIntent.current?.fingerprint === fingerprint
      ? saveIntent.current.key
      : generateUUIDv7();
    saveIntent.current = { fingerprint, key };
    setMutation({ ...EMPTY_MUTATION, phase: "PENDING" });
    try {
      const response = await axiosClient.patch<unknown>(
        "/api/admin/core/v1/system-settings/fatal-alerts",
        result.dto,
        { headers: { "x-idempotency-key": key } },
      );
      const saved = readFatalAlertConfigEnvelope(response.data);
      saveIntent.current = null;
      setSnapshot(saved);
      setForm(formFromConfig(saved.data));
      setTokenState("");
      setFieldErrors({});
      setMutation({
        phase: "SUCCEEDED",
        error: null,
        localCode: null,
        correlationId: saved.correlationId,
      });
      return true;
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (!retainIntent(normalized)) saveIntent.current = null;
      setMutation({
        phase: "FAILED",
        error: normalized,
        localCode: null,
        correlationId: normalized.correlationId ?? null,
      });
      return false;
    }
  }, [canSaveCritical, form, mutation.phase, snapshot, token]);

  return {
    lang,
    snapshot,
    form,
    token,
    fieldErrors,
    loadState,
    loadError,
    mutation,
    canSaveCritical,
    hasUnsavedChanges,
    update,
    setToken,
    save,
    refetch: fetchConfig,
  };
}

function classifyLoadError(error: NormalizedApiError): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") return "UNAVAILABLE";
  return "ERROR";
}

function retainIntent(error: NormalizedApiError): boolean {
  return (
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR" ||
    error.errorCode === "GW.IDEM.IN_FLIGHT"
  );
}

function without(
  errors: FatalAlertValidationErrors,
  field: FatalAlertField,
): FatalAlertValidationErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
