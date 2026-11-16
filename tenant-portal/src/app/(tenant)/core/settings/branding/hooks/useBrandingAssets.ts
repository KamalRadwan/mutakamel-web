"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import { describeApiOutcome, useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { SettingsInvalidResponseError } from "../../settings-failure";
import {
  BRANDING_FILE_INVALID_CODE,
  BRANDING_FILE_REQUIRED_CODE,
  BRANDING_FILE_TOO_LARGE_CODE,
  BRANDING_FILE_TYPE_UNSUPPORTED_CODE,
  BRANDING_IDEMPOTENCY_CONFLICT_CODE,
  BRANDING_STORAGE_UNAVAILABLE_CODE,
  uploadBrandingAsset,
  type BrandingAssetKind,
  type BrandingSettings,
} from "../branding-contract";
import {
  describeBrandingAssetRejection,
  formatBrandingTooLargeError,
  inspectBrandingAssetFile,
} from "../branding-image-validation";
import type { BrandingActiveOperation } from "./useBrandingIntentFence";

function matchesErrorCode(failure: NormalizedApiError, code: string): boolean {
  return failure.code === code || failure.message === code;
}

export interface UseBrandingAssetsOptions {
  intentFence: string;
  latestIntentFenceRef: MutableRefObject<string>;
  mountedRef: MutableRefObject<boolean>;
  activeOperationRef: MutableRefObject<BrandingActiveOperation | null>;
  canManage: boolean;
  isLoading: boolean;
  isSaving: boolean;
  hasLoadError: boolean;
  onAssetSaved: (saved: BrandingSettings) => void;
}

export function useBrandingAssets({
  intentFence,
  latestIntentFenceRef,
  mountedRef,
  activeOperationRef,
  canManage,
  isLoading,
  isSaving,
  hasLoadError,
  onAssetSaved,
}: UseBrandingAssetsOptions) {
  const { t, lang = "en" } = useI18n();
  const toast = useToast();

  const [trackedFence, setTrackedFence] = useState(intentFence);
  const [uploading, setUploading] = useState<BrandingAssetKind | null>(null);
  const [uploadError, setUploadError] = useState<Record<BrandingAssetKind, string | null>>({
    logo: null,
    icon: null,
  });
  const [activeUploadKind, setActiveUploadKind] = useState<BrandingAssetKind | null>(null);
  /** Bumped after an upload so the 5-minute public asset cache is bypassed. */
  const [assetVersion, setAssetVersion] = useState(0);

  if (trackedFence !== intentFence) {
    setTrackedFence(intentFence);
    setUploading(null);
    setUploadError({ logo: null, icon: null });
    setActiveUploadKind(null);
  }

  const describeUploadError = useCallback(
    (kind: BrandingAssetKind, failure: NormalizedApiError): string => {
      if (failure.status === 413 || matchesErrorCode(failure, BRANDING_FILE_TOO_LARGE_CODE)) {
        return formatBrandingTooLargeError(kind, t, lang);
      }
      if (failure.status === 415 || matchesErrorCode(failure, BRANDING_FILE_TYPE_UNSUPPORTED_CODE)) {
        return t.coreBilling.brandingFileTypeUnsupported;
      }
      if (matchesErrorCode(failure, BRANDING_FILE_INVALID_CODE)) {
        return t.coreSettings.brandingUi.fileInvalid;
      }
      if (matchesErrorCode(failure, BRANDING_FILE_REQUIRED_CODE)) {
        return t.coreBilling.brandingFileRequired;
      }
      if (failure.status === 503 || matchesErrorCode(failure, BRANDING_STORAGE_UNAVAILABLE_CODE)) {
        return t.coreBilling.brandingStorageUnavailable;
      }
      if (failure.status === 409 || matchesErrorCode(failure, BRANDING_IDEMPOTENCY_CONFLICT_CODE)) {
        return describeApiOutcome(failure, t)?.description ?? t.coreBilling.brandingUploadFailed;
      }
      return t.coreBilling.brandingUploadFailed;
    },
    [lang, t],
  );

  const upload = useCallback(
    async (kind: BrandingAssetKind, file: File): Promise<boolean> => {
      const startedFence = latestIntentFenceRef.current;
      const activeOp = activeOperationRef.current;
      if (
        !mountedRef.current ||
        startedFence !== intentFence ||
        (activeOp !== null && activeOp.intentFence === startedFence) ||
        !canManage ||
        uploading !== null ||
        isSaving ||
        isLoading ||
        hasLoadError
      ) {
        return false;
      }
      const operationToken = Symbol(kind);
      activeOperationRef.current = {
        token: operationToken,
        kind,
        intentFence: startedFence,
      };
      const isStaleIntent = () =>
        !mountedRef.current || latestIntentFenceRef.current !== startedFence;

      setUploading(kind);
      setUploadError((current) => ({ ...current, [kind]: null }));
      try {
        const inspection = await inspectBrandingAssetFile(kind, file);
        if (isStaleIntent()) return false;
        if (!inspection.ok) {
          setUploadError((current) => ({
            ...current,
            [kind]: describeBrandingAssetRejection(kind, inspection.reason, t, lang),
          }));
          return false;
        }
        const { branding: saved, replayed } = await uploadBrandingAsset(
          kind,
          file,
          generateUUIDv7(),
        );
        if (isStaleIntent()) return false;
        onAssetSaved(saved);
        setAssetVersion((version) => version + 1);
        toast.success(
          t.coreBilling.brandingSavedTitle,
          replayed ? t.coreBilling.brandingUploadReplayed : t.coreBilling.brandingUploaded,
        );
        return true;
      } catch (caught) {
        if (isStaleIntent()) return false;
        if (caught instanceof SettingsInvalidResponseError) {
          setUploadError((current) => ({
            ...current,
            [kind]: t.coreSettings.invalidResponseDescription,
          }));
          return false;
        }
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) {
          setUploadError((current) => ({
            ...current,
            [kind]: t.coreBilling.brandingReadOnlyNotice,
          }));
          return false;
        }
        const outcome = describeApiOutcome(normalized, t);
        if (toast.outcomeFromApi(normalized)) {
          setUploadError((current) => ({
            ...current,
            [kind]: outcome?.description ?? t.coreBilling.brandingUploadFailed,
          }));
          return false;
        }
        setUploadError((current) => ({
          ...current,
          [kind]: describeUploadError(kind, normalized),
        }));
        return false;
      } finally {
        if (activeOperationRef.current?.token === operationToken) {
          activeOperationRef.current = null;
        }
        if (!isStaleIntent()) {
          setUploading(null);
        }
      }
    },
    [
      activeOperationRef,
      canManage,
      describeUploadError,
      hasLoadError,
      intentFence,
      isLoading,
      isSaving,
      lang,
      latestIntentFenceRef,
      mountedRef,
      onAssetSaved,
      t,
      toast,
      uploading,
    ],
  );

  const openUploadModal = useCallback(
    (kind: BrandingAssetKind) => {
      const activeOp = activeOperationRef.current;
      if (
        !mountedRef.current ||
        (activeOp !== null && activeOp.intentFence === latestIntentFenceRef.current) ||
        !canManage ||
        uploading !== null ||
        isSaving ||
        isLoading ||
        hasLoadError
      ) {
        return;
      }
      setUploadError((current) => ({ ...current, [kind]: null }));
      setActiveUploadKind(kind);
    },
    [
      activeOperationRef,
      canManage,
      hasLoadError,
      isLoading,
      isSaving,
      latestIntentFenceRef,
      mountedRef,
      uploading,
    ],
  );

  const closeUploadModal = useCallback(() => {
    const activeOp = activeOperationRef.current;
    if (
      activeOp !== null &&
      activeOp.intentFence === latestIntentFenceRef.current &&
      activeOp.kind !== "save"
    ) {
      return;
    }
    setActiveUploadKind(null);
  }, [activeOperationRef, latestIntentFenceRef]);

  const clearUploadError = useCallback((kind: BrandingAssetKind) => {
    setUploadError((current) => (current[kind] === null ? current : { ...current, [kind]: null }));
  }, []);

  return {
    uploading,
    uploadError,
    activeUploadKind,
    assetVersion,
    upload,
    openUploadModal,
    closeUploadModal,
    clearUploadError,
  };
}
