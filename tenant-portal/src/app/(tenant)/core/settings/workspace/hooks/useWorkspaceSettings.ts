"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { coreGet, corePut } from "../../../core-api";
import {
  CURRENCY_NOT_ENABLED_CODE,
  LANGUAGE_INVALID_CODE,
  TENANT_NOT_READY_CODE,
  TIMEZONE_INVALID_CODE,
  WORKSPACE_SETTINGS_PATH,
  buildWorkspaceSettingsRequest,
  isWorkspaceSettingsDraftValid,
  parseWorkspaceSettingsResponse,
  toWorkspaceSettingsDraft,
  type WorkspaceSettings,
  type WorkspaceSettingsDraft,
} from "../workspace-settings-contract";
import {
  CURRENCY_OPTIONS_PATH,
  parseCurrencyOptionsResponse,
  type CurrencyOption,
} from "../currency-options";

const SETTINGS_RESPONSE_LIMIT_BYTES = 20_000;
const CURRENCY_OPTIONS_RESPONSE_LIMIT_BYTES = 200_000;

export type WorkspaceFieldName = "defaultLanguage" | "defaultCurrencyCode" | "timezone";

export function useWorkspaceSettings() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("workspace.manage") ?? false;

  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [draft, setDraft] = useState<WorkspaceSettingsDraft | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [fieldError, setFieldError] = useState<{ field: WorkspaceFieldName; message: string } | null>(
    null,
  );

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    setFieldError(null);
    try {
      const result = await coreGet(WORKSPACE_SETTINGS_PATH, {
        signal,
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
      });
      const parsed = parseWorkspaceSettingsResponse(result.data);
      setSettings(parsed);
      setDraft(toWorkspaceSettingsDraft(parsed));
    } catch (error) {
      if (isAbortError(error)) return;
      setSettings(null);
      setDraft(null);
      setLoadError(normalizeApiError(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const loadCurrencyOptions = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const result = await coreGet(CURRENCY_OPTIONS_PATH, {
        signal,
        maxResponseBytes: CURRENCY_OPTIONS_RESPONSE_LIMIT_BYTES,
      });
      setCurrencyOptions(parseCurrencyOptionsResponse(result.data));
    } catch {
      // Advisory only. A reader without `currencies.currency.read` still gets
      // the plain three-letter code input, which is what the DTO accepts.
      setCurrencyOptions([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void load(controller.signal);
      void loadCurrencyOptions(controller.signal);
    });
    return () => controller.abort();
  }, [load, loadCurrencyOptions]);

  const isNotReady = loadError?.code === TENANT_NOT_READY_CODE;
  const isDirty = useMemo(
    () => Boolean(settings && draft && hasChanges(settings, draft)),
    [settings, draft],
  );

  const updateDraft = useCallback((patch: Partial<WorkspaceSettingsDraft>) => {
    setFieldError(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const save = useCallback(async (): Promise<void> => {
    if (!settings || !draft || !canManage || isSaving) return;
    const request = buildWorkspaceSettingsRequest(settings, draft);
    if (Object.keys(request).length === 0) return;

    setIsSaving(true);
    setFieldError(null);
    try {
      // A PUT of the full singleton is naturally idempotent, so one replay
      // after a refresh cannot double-apply anything.
      const result = await corePut(WORKSPACE_SETTINGS_PATH, request, {
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      });
      const parsed = parseWorkspaceSettingsResponse(result.data);
      setSettings(parsed);
      setDraft(toWorkspaceSettingsDraft(parsed));
      toast.success(t.coreSettings.savedTitle, t.coreSettings.workspaceSavedMessage);
    } catch (error) {
      const normalized = normalizeApiError(error);
      const field = fieldForCode(normalized.code);
      if (field) {
        setFieldError({ field, message: messageForCode(normalized.code, t) });
        return;
      }
      // 403 already raises the transport's own toast — a second would double-fire.
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.errorFromApi(t.coreSettings.workspaceSaveFailed, normalized);
    } finally {
      setIsSaving(false);
    }
  }, [settings, draft, canManage, isSaving, toast, t]);

  return {
    t,
    lang,
    canManage,
    settings,
    draft,
    currencyOptions,
    isLoading,
    isSaving,
    isDirty,
    isNotReady,
    loadError: isNotReady ? null : loadError,
    fieldError,
    canSave: Boolean(draft && isDirty && isWorkspaceSettingsDraftValid(draft)),
    updateDraft,
    save,
    reload: () => load(),
  };
}

function hasChanges(settings: WorkspaceSettings, draft: WorkspaceSettingsDraft): boolean {
  return Object.keys(buildWorkspaceSettingsRequest(settings, draft)).length > 0;
}

function fieldForCode(code: string | undefined): WorkspaceFieldName | null {
  if (code === CURRENCY_NOT_ENABLED_CODE) return "defaultCurrencyCode";
  if (code === TIMEZONE_INVALID_CODE) return "timezone";
  if (code === LANGUAGE_INVALID_CODE) return "defaultLanguage";
  return null;
}

function messageForCode(
  code: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (code === CURRENCY_NOT_ENABLED_CODE) return t.coreSettings.workspaceCurrencyNotEnabled;
  if (code === TIMEZONE_INVALID_CODE) return t.coreSettings.workspaceTimezoneInvalid;
  return t.coreSettings.workspaceLanguageInvalid;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
