"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { DIRECTORY_SETTINGS_PERMISSION } from "../../directory-contract";
import {
  buildDirectorySettingsRequest,
  fetchDirectorySettings,
  saveDirectorySettings,
  toDirectorySettingsForm,
  type DirectorySettings,
  type DirectorySettingsFormValues,
} from "../directory-settings-contract";

const EMPTY_FORM: DirectorySettingsFormValues = {
  duplicateScope: "TENANT",
  preventDuplicateEmail: false,
  preventDuplicatePhone: false,
  preventDuplicateWhatsapp: false,
  maxContactMethodsPerParty: "",
  maxAddressesPerParty: "",
  partyCacheTtlSeconds: "",
};

/**
 * `directory.settings.manage` gates the GET as well — there is no read grant,
 * so a user who cannot manage settings cannot see them at all.
 */
export function useDirectorySettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes(DIRECTORY_SETTINGS_PERMISSION) ?? false;

  const [settings, setSettings] = useState<DirectorySettings | null>(null);
  const [values, setValues] = useState<DirectorySettingsFormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canManage) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await fetchDirectorySettings(signal);
        setSettings(loaded);
        setValues(toDirectorySettingsForm(loaded));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canManage],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const save = useCallback(async (): Promise<void> => {
    if (!settings || isSaving) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const request = buildDirectorySettingsRequest(settings, values);
      if (Object.keys(request).length === 0) {
        setIsSaving(false);
        return;
      }
      const saved = await saveDirectorySettings(request);
      setSettings(saved);
      setValues(toDirectorySettingsForm(saved));
      toast.success(t.coreOperations.directory.settingsSavedTitle, t.coreOperations.directory.settingsSaved);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason.startsWith("DIRECTORY_SETTINGS_FORM_")) {
        setFormError(formMessage(reason, t));
      } else {
        const normalized = normalizeApiError(error);
        // The transport already toasts a 403; a second would double-fire.
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          toast.errorFromApi(t.coreOperations.directory.settingsSaveFailed, normalized);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [settings, isSaving, values, toast, t]);

  const isDirty =
    settings !== null &&
    JSON.stringify(values) !== JSON.stringify(toDirectorySettingsForm(settings));

  return {
    t,
    canManage,
    settings,
    values,
    isLoading: isLoading && canManage,
    isSaving,
    isDirty,
    loadError,
    formError,
    change: (patch: Partial<DirectorySettingsFormValues>) =>
      setValues((current) => ({ ...current, ...patch })),
    revert: () => settings && setValues(toDirectorySettingsForm(settings)),
    save,
    reload: () => setReloadToken((token) => token + 1),
  };
}

type Dictionary = ReturnType<typeof useI18n>["t"];

function formMessage(reason: string, t: Dictionary): string {
  const copy = t.coreOperations.directory;
  if (reason === "DIRECTORY_SETTINGS_FORM_CONTACTS") return copy.settingsContactsInvalid;
  if (reason === "DIRECTORY_SETTINGS_FORM_ADDRESSES") return copy.settingsAddressesInvalid;
  return copy.settingsTtlInvalid;
}
