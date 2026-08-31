"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { evaluateBrandColor } from "@/lib/branding/brand-ramp";
import { generateUUIDv7 } from "@/lib/uuid";
import {
  BRANDING_FILE_REQUIRED_CODE,
  BRANDING_FILE_TOO_LARGE_CODE,
  BRANDING_FILE_TYPE_UNSUPPORTED_CODE,
  BRANDING_FORM_COLOR_ERROR,
  BRANDING_MANAGE_PERMISSION,
  BRANDING_STORAGE_UNAVAILABLE_CODE,
  buildUpdateBrandingRequest,
  EMPTY_BRANDING,
  fetchBrandingSettings,
  toBrandingForm,
  updateBrandingSettings,
  uploadBrandingAsset,
  type BrandingAssetKind,
  type BrandingFormValues,
  type BrandingSettings,
} from "../branding-contract";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const EMPTY_FORM = toBrandingForm(EMPTY_BRANDING);

export function useBranding() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes(BRANDING_MANAGE_PERMISSION) ?? false;

  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [values, setValues] = useState<BrandingFormValues>(EMPTY_FORM);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<BrandingAssetKind | null>(null);
  const [uploadError, setUploadError] = useState<Record<BrandingAssetKind, string | null>>({
    logo: null,
    icon: null,
  });
  /** Bumped after an upload so the 5-minute public asset cache is bypassed. */
  const [assetVersion, setAssetVersion] = useState(0);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBrandingSettings(signal);
      if (signal?.aborted) return;
      setBranding(result);
      setValues(toBrandingForm(result));
      setHasLoaded(true);
    } catch (caught) {
      if (isAbortError(caught)) return;
      setError(normalizeApiError(caught));
      setHasLoaded(true);
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

  /**
   * The runtime contrast guard (MASTER-PLAN 6.18), computed on what the owner
   * has typed rather than on what is stored — so the refusal is visible before
   * the colour is ever saved.
   *
   * `scripts/design/contrast.mjs` cannot cover this: it is a build-time Node
   * pass over the static tokens, and from the moment branding overrides
   * `--color-brand-*` at runtime it proves nothing about a real tenant.
   */
  const contrast = useMemo(() => {
    const color = values.primaryColor.trim();
    if (!color) return null;
    return evaluateBrandColor(color);
  }, [values.primaryColor]);

  const save = useCallback(async (): Promise<void> => {
    if (!canManage || isSaving) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const request = buildUpdateBrandingRequest(values);
      const saved = await updateBrandingSettings(request);
      setBranding(saved);
      setValues(toBrandingForm(saved));
      toast.success(t.coreBilling.brandingSavedTitle, t.coreBilling.brandingSaved);
    } catch (caught) {
      if (caught instanceof Error && caught.message === BRANDING_FORM_COLOR_ERROR) {
        setFormError(t.coreBilling.brandingColorInvalid);
        return;
      }
      const normalized = normalizeApiError(caught);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(t.coreBilling.brandingSaveFailed, normalized);
      }
      setFormError(t.coreBilling.brandingSaveFailed);
    } finally {
      setIsSaving(false);
    }
  }, [canManage, isSaving, values, toast, t]);

  /**
   * Three upload failures, three messages. They are branched on status **and**
   * code because they are genuinely different problems: no file part (400), the
   * wrong image format (415), and over the 2 MB cap (413).
   */
  const describeUploadError = useCallback(
    (error: NormalizedApiError): string => {
      if (error.status === 413 || error.code === BRANDING_FILE_TOO_LARGE_CODE) {
        return t.coreBilling.brandingFileTooLarge;
      }
      if (error.status === 415 || error.code === BRANDING_FILE_TYPE_UNSUPPORTED_CODE) {
        return t.coreBilling.brandingFileTypeUnsupported;
      }
      if (error.code === BRANDING_FILE_REQUIRED_CODE) return t.coreBilling.brandingFileRequired;
      if (error.code === BRANDING_STORAGE_UNAVAILABLE_CODE) {
        return t.coreBilling.brandingStorageUnavailable;
      }
      return t.coreBilling.brandingUploadFailed;
    },
    [t],
  );

  const upload = useCallback(
    async (kind: BrandingAssetKind, file: File): Promise<void> => {
      if (!canManage || uploading) return;
      setUploading(kind);
      setUploadError((current) => ({ ...current, [kind]: null }));
      try {
        const { branding: saved, replayed } = await uploadBrandingAsset(
          kind,
          file,
          generateUUIDv7(),
        );
        setBranding(saved);
        setAssetVersion((version) => version + 1);
        toast.success(
          t.coreBilling.brandingSavedTitle,
          replayed ? t.coreBilling.brandingUploadReplayed : t.coreBilling.brandingUploaded,
        );
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        setUploadError((current) => ({ ...current, [kind]: describeUploadError(normalized) }));
      } finally {
        setUploading(null);
      }
    },
    [canManage, uploading, toast, t, describeUploadError],
  );

  return {
    canManage,
    branding,
    values,
    contrast,
    error,
    formError,
    uploadError,
    uploading,
    assetVersion,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    isSaving,
    setValue: (patch: Partial<BrandingFormValues>) =>
      setValues((current) => ({ ...current, ...patch })),
    rejectUpload: (kind: BrandingAssetKind, message: string) =>
      setUploadError((current) => ({ ...current, [kind]: message })),
    save,
    upload,
    reload: () => load(),
  };
}
