"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission, useCan, useToast } from "@/design-system";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError } from "@/lib/api/errors";
import { coreGet, corePut } from "../../../core-api";
import { resolveCoreErrorText } from "../../../hooks/useCoreErrorText";
import {
  classifyWorkspaceFailure, isAbortError, isWorkspaceInvalidResponseError, type WorkspaceQueryFailure,
} from "../workspace-errors";
import {
  CURRENCY_NOT_ENABLED_CODE, LANGUAGE_INVALID_CODE, TENANT_NOT_READY_CODE, TIMEZONE_INVALID_CODE,
  WORKSPACE_SETTINGS_PATH, buildWorkspaceSettingsRequest, isWorkspaceSettingsDraftValid,
  parseWorkspaceSettingsResponse, toWorkspaceSettingsDraft,
  type UpdateWorkspaceSettingsRequest, type WorkspaceSettings, type WorkspaceSettingsDraft,
} from "../workspace-settings-contract";
import { useWorkspaceCurrencyOptions } from "./useWorkspaceCurrencyOptions";

const SETTINGS_RESPONSE_LIMIT_BYTES = 20_000;

export type WorkspaceFieldName = "defaultLanguage" | "defaultCurrencyCode" | "timezone";
type WorkspaceDirtyField = keyof UpdateWorkspaceSettingsRequest;

export interface WorkspaceSettingsConflict {
  base: WorkspaceSettings;
  draft: WorkspaceSettingsDraft;
  server: WorkspaceSettings;
  editedFields: WorkspaceDirtyField[];
}

export function useWorkspaceSettings() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const toast = useToast();
  const canRead = hasPermission(user?.permissions ?? [], "workspace.read");
  const canManage = useCan("workspace.manage", { tenantWide: true });
  const canReadCurrencies = useCan("currencies.currency.read");

  const {
    currencyOptions,
    currenciesTotal,
    isCurrenciesTruncated,
    isLoadingCurrencies,
    currencyLoadFailure,
    fetchCurrencies,
  } = useWorkspaceCurrencyOptions(canRead, canReadCurrencies);

  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [draft, setDraft] = useState<WorkspaceSettingsDraft | null>(null);
  const [isLoading, setIsLoading] = useState(canRead);
  const [isSaving, setIsSaving] = useState(false);
  const [loadFailure, setLoadFailure] = useState<WorkspaceQueryFailure | null>(null);
  const [fieldError, setFieldError] = useState<{
    field: WorkspaceFieldName;
    message: string;
  } | null>(null);
  const [conflict, setConflict] = useState<WorkspaceSettingsConflict | null>(null);

  const settingsAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (): Promise<void> => {
    settingsAbortRef.current?.abort();
    if (!canRead) {
      settingsAbortRef.current = null;
      setSettings(null);
      setDraft(null);
      setLoadFailure(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    settingsAbortRef.current = controller;

    setIsLoading(true);
    setLoadFailure(null);
    setFieldError(null);
    setConflict(null);
    try {
      const result = await coreGet(WORKSPACE_SETTINGS_PATH, {
        signal: controller.signal,
        suppressForbiddenToast: true,
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
      });
      if (controller.signal.aborted || settingsAbortRef.current !== controller) return;
      const parsed = parseWorkspaceSettingsResponse(result.data);
      setSettings(parsed);
      setDraft(toWorkspaceSettingsDraft(parsed));
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        settingsAbortRef.current !== controller
      ) {
        return;
      }
      setSettings(null);
      setDraft(null);
      setLoadFailure(classifyWorkspaceFailure(error));
    } finally {
      if (settingsAbortRef.current === controller && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [canRead]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      settingsAbortRef.current?.abort();
    };
  }, [load]);

  const isLoadForbidden = loadFailure?.kind === "api" && loadFailure.error.status === 403;
  const isNotReady =
    loadFailure?.kind === "api" && loadFailure.error.code === TENANT_NOT_READY_CODE;
  const activeLoadFailure = isLoadForbidden || isNotReady ? null : loadFailure;

  const pendingRequest = useMemo<UpdateWorkspaceSettingsRequest>(
    () => (settings && draft ? buildWorkspaceSettingsRequest(settings, draft) : {}),
    [settings, draft],
  );
  const dirtyFields = useMemo<WorkspaceDirtyField[]>(
    () => Object.keys(pendingRequest) as WorkspaceDirtyField[],
    [pendingRequest],
  );
  const isDirty = dirtyFields.length > 0;
  const { isDiscardOpen, requestDiscard, confirmDiscard, cancelDiscard } =
    useUnsavedChangesGuard(isDirty);

  const updateDraft = useCallback((patch: Partial<WorkspaceSettingsDraft>) => {
    setFieldError(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const discardDraft = useCallback(() => {
    if (!settings || isSaving) return;
    requestDiscard(() => {
      setFieldError(null);
      setConflict(null);
      setDraft(toWorkspaceSettingsDraft(settings));
    });
  }, [settings, isSaving, requestDiscard]);

  const reload = useCallback(() => {
    if (isSaving || isLoading) return;
    requestDiscard(() => {
      void Promise.all([load(), fetchCurrencies()]);
    });
  }, [isSaving, isLoading, requestDiscard, load, fetchCurrencies]);

  const onDiscardOpenChange = useCallback(
    (open: boolean) => {
      if (!open) cancelDiscard();
    },
    [cancelDiscard],
  );

  const handleSaveError = useCallback(
    (error: unknown) => {
      if (isWorkspaceInvalidResponseError(error)) {
        toast.error(t.coreSettings.workspaceSaveFailed, t.coreSettings.invalidResponseDescription);
        return;
      }
      const normalized = normalizeApiError(error);
      const field = fieldForCode(normalized.code);
      if (field) {
        setFieldError({ field, message: messageForCode(normalized.code, t) });
        return;
      }
      // 403 already raises the transport's own toast — a second would double-fire.
      if (normalized.status === 403) return;
      if (toast.outcomeFromApi(normalized)) return;
      toast.error(
        t.coreSettings.workspaceSaveFailed,
        resolveCoreErrorText(normalized, t) ?? t.coreIdentity.errors.UNKNOWN,
      );
    },
    [t, toast],
  );

  const save = useCallback(async (): Promise<void> => {
    if (!settings || !draft || !canManage || isSaving) return;
    const request = buildWorkspaceSettingsRequest(settings, draft);
    if (Object.keys(request).length === 0) return;

    setIsSaving(true);
    setFieldError(null);
    try {
      const freshResult = await coreGet(WORKSPACE_SETTINGS_PATH, {
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
      });
      const fresh = parseWorkspaceSettingsResponse(freshResult.data);
      const editedFields = Object.keys(request) as WorkspaceDirtyField[];
      if (editedFields.some((field) => fresh[field] !== settings[field])) {
        setConflict({ base: settings, draft, server: fresh, editedFields });
        toast.error(t.tradeCommon.conflictTitle, t.tradeCommon.conflictDescription);
        return;
      }
      // A PUT of the singleton is naturally idempotent, so one replay after a
      // token refresh cannot double-apply anything.
      const result = await corePut(WORKSPACE_SETTINGS_PATH, request, {
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      });
      const parsed = parseWorkspaceSettingsResponse(result.data);
      setSettings(parsed);
      setDraft(toWorkspaceSettingsDraft(parsed));
      setConflict(null);
      toast.success(t.coreSettings.savedTitle, t.coreSettings.workspaceSavedMessage);
    } catch (error) {
      handleSaveError(error);
    } finally {
      setIsSaving(false);
    }
  }, [settings, draft, canManage, isSaving, toast, t, handleSaveError]);

  const reloadFromConflict = useCallback(async (): Promise<void> => {
    if (conflict) {
      setSettings(conflict.server);
      setDraft(toWorkspaceSettingsDraft(conflict.server));
      setConflict(null);
      setFieldError(null);
      return;
    }
    await load();
  }, [conflict, load]);

  const overwriteConflict = useCallback(async (): Promise<void> => {
    if (!conflict || !draft || !canManage || isSaving) return;
    const intendedChanges = buildWorkspaceSettingsRequest(conflict.base, draft);
    const overwriteRequest = buildWorkspaceSettingsRequest(conflict.server, {
      ...toWorkspaceSettingsDraft(conflict.server),
      ...intendedChanges,
    });
    if (Object.keys(overwriteRequest).length === 0) {
      setSettings(conflict.server);
      setDraft(toWorkspaceSettingsDraft(conflict.server));
      setConflict(null);
      return;
    }

    setIsSaving(true);
    setFieldError(null);
    try {
      const result = await corePut(WORKSPACE_SETTINGS_PATH, overwriteRequest, {
        maxResponseBytes: SETTINGS_RESPONSE_LIMIT_BYTES,
        replayAfterRefresh: true,
      });
      const parsed = parseWorkspaceSettingsResponse(result.data);
      setSettings(parsed);
      setDraft(toWorkspaceSettingsDraft(parsed));
      setConflict(null);
      toast.success(t.coreSettings.savedTitle, t.coreSettings.workspaceSavedMessage);
    } catch (error) {
      setConflict(null);
      handleSaveError(error);
    } finally {
      setIsSaving(false);
    }
  }, [conflict, draft, canManage, isSaving, toast, t, handleSaveError]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  return {
    t, lang, canManage, canReadCurrencies, settings, draft,
    currencyOptions, currenciesTotal, isCurrenciesTruncated,
    isLoadingCurrencies, currencyLoadFailure, dirtyCount: dirtyFields.length,
    conflict, isLoading, isSaving, isDirty, isLoadForbidden, isNotReady,
    loadFailure: activeLoadFailure, fieldError,
    canSave: Boolean(draft && isDirty && isWorkspaceSettingsDraftValid(draft)),
    isDiscardOpen, confirmDiscard, onDiscardOpenChange,
    updateDraft, discardDraft, save, dismissConflict, reloadFromConflict,
    overwriteConflict, retryCurrencyOptions: fetchCurrencies, reload,
  };
}

function fieldForCode(code: string | undefined): WorkspaceFieldName | null {
  if (code === LANGUAGE_INVALID_CODE) return "defaultLanguage";
  if (code === CURRENCY_NOT_ENABLED_CODE) return "defaultCurrencyCode";
  if (code === TIMEZONE_INVALID_CODE) return "timezone";
  return null;
}

function messageForCode(code: string | undefined, t: Dictionary): string {
  if (code === LANGUAGE_INVALID_CODE) return t.coreSettings.workspaceLanguageInvalid;
  if (code === CURRENCY_NOT_ENABLED_CODE) return t.coreSettings.workspaceCurrencyNotEnabled;
  if (code === TIMEZONE_INVALID_CODE) return t.coreSettings.workspaceTimezoneInvalid;
  return "";
}
