"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeApiOutcome, useCan, useToast } from "@/design-system";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranding } from "@/context/BrandingContext";
import { normalizeApiError } from "@/lib/api/errors";
import { evaluateBrandColor } from "@/lib/branding/brand-ramp";
import { PUBLIC_BRANDING_ICON_PATH, PUBLIC_BRANDING_LOGO_PATH } from "@/lib/branding/public-branding";
import { useCoreErrorText } from "../../../hooks/useCoreErrorText";
import {
  classifySettingsFailure,
  isSettingsAbortError,
  SettingsInvalidResponseError,
  type SettingsReadFailure,
} from "../../settings-failure";
import {
  BRANDING_FORM_TEXT_ERROR,
  BRANDING_MANAGE_PERMISSION,
  buildUpdateBrandingRequest,
  EMPTY_BRANDING,
  fetchBrandingSettings,
  hasBrandingDraftEdits,
  hasBrandingMetadataChanges,
  mergeUploadedBranding,
  toBrandingForm,
  updateBrandingSettings,
  validateBrandingForm,
  type BrandingDraftState,
  type BrandingFormValues,
  type BrandingSettings,
  type UpdateBrandingRequest,
} from "../branding-contract";
import { useBrandingAssets } from "./useBrandingAssets";
import { useBrandingFormFocus } from "./useBrandingFormFocus";
import { useBrandingIntentFence } from "./useBrandingIntentFence";

const EMPTY_FORM = toBrandingForm(EMPTY_BRANDING);

export function useBranding() {
  const { t } = useI18n();
  const toast = useToast();
  const describeCoreError = useCoreErrorText();
  const { updateBranding } = useTenantBranding();
  const publishBranding = useCallback(
    (saved: BrandingSettings) => {
      updateBranding({
        appName: saved.appName, tabTitle: saved.tabTitle,
        primaryColor: saved.primaryColor, secondaryColor: saved.secondaryColor,
        fontFamily: saved.fontFamily,
        logoUrl: saved.hasLogo ? PUBLIC_BRANDING_LOGO_PATH : null,
        iconUrl: saved.hasIcon ? PUBLIC_BRANDING_ICON_PATH : null,
      });
    },
    [updateBranding],
  );
  const canManage = useCan(BRANDING_MANAGE_PERMISSION, { tenantWide: true });
  const {
    intentFence, latestIntentFenceRef, mountedRef, activeOperationRef, hasActiveCurrentOperation,
  } = useBrandingIntentFence(canManage);
  const {
    setErrorSummaryNode, setAppNameNode, setTabTitleNode, setPrimaryColorNode,
    setSecondaryColorNode, focusField, focusErrorSummary,
  } = useBrandingFormFocus();

  const [trackedFence, setTrackedFence] = useState(intentFence);
  const [{ branding, baseline, values }, setDraft] = useState<BrandingDraftState>({
    branding: null,
    baseline: null,
    values: EMPTY_FORM,
  });
  const [loadFailure, setLoadFailure] = useState<SettingsReadFailure | null>(null);
  const error = loadFailure?.kind === "api" ? loadFailure.error : null;
  const hasLoadError = loadFailure !== null;
  const loadAbortRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (trackedFence !== intentFence) {
    setTrackedFence(intentFence);
    setDraft({ branding: null, baseline: null, values: EMPTY_FORM });
    setLoadFailure(null);
    setIsLoading(true);
    setHasLoaded(false);
    setIsSaving(false);
    setSubmitAttempted(false);
    setFormError(null);
    setIsPreviewOpen(false);
  }

  const handleAssetSaved = useCallback(
    (saved: BrandingSettings) => {
      setDraft((current) => mergeUploadedBranding(current, saved));
      publishBranding(saved);
    },
    [publishBranding],
  );

  const assets = useBrandingAssets({
    intentFence, latestIntentFenceRef, mountedRef, activeOperationRef,
    canManage, isLoading, isSaving, hasLoadError, onAssetSaved: handleAssetSaved,
  });

  const load = useCallback(async (): Promise<void> => {
    loadAbortRef.current?.abort();
    const startedFence = latestIntentFenceRef.current;
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isStaleLoad = () =>
      !mountedRef.current || latestIntentFenceRef.current !== startedFence ||
      controller.signal.aborted || loadAbortRef.current !== controller;

    setIsLoading(true);
    setLoadFailure(null);
    setFormError(null);
    setSubmitAttempted(false);
    try {
      const result = await fetchBrandingSettings(controller.signal);
      if (isStaleLoad()) return;
      setDraft({ branding: result, baseline: result, values: toBrandingForm(result) });
      setHasLoaded(true);
    } catch (caught) {
      if (isSettingsAbortError(caught) || isStaleLoad()) return;
      setLoadFailure(classifySettingsFailure(caught));
      setDraft({ branding: null, baseline: null, values: EMPTY_FORM });
      setHasLoaded(true);
    } finally {
      if (!isStaleLoad()) setIsLoading(false);
    }
  }, [latestIntentFenceRef, mountedRef]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      loadAbortRef.current?.abort();
    };
  }, [intentFence, load]);

  const contrast = useMemo(() => {
    const color = values.primaryColor.trim();
    return color ? evaluateBrandColor(color) : null;
  }, [values.primaryColor]);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof BrandingFormValues, string>> = {};
    for (const [field, code] of Object.entries(validateBrandingForm(values))) {
      errors[field as keyof BrandingFormValues] =
        code === BRANDING_FORM_TEXT_ERROR
          ? t.coreBilling.brandingTextTooLong
          : t.coreBilling.brandingColorInvalid;
    }
    return errors;
  }, [values, t]);

  const isDenied = error?.status === 403;
  const loadErrorDescription = useMemo(
    () =>
      loadFailure?.kind === "invalid-response"
        ? t.coreSettings.invalidResponseDescription
        : error && !isDenied
          ? describeCoreError(error)
          : undefined,
    [describeCoreError, error, isDenied, loadFailure, t],
  );
  const isValid = Object.keys(fieldErrors).length === 0;
  const isDirty = useMemo(
    () => baseline !== null && hasBrandingMetadataChanges(values, baseline),
    [baseline, values],
  );
  const hasDraftEdits = useMemo(
    () => baseline !== null && hasBrandingDraftEdits(values, baseline),
    [baseline, values],
  );
  const isBusy = isSaving || assets.uploading !== null;
  const canSave = canManage && !isLoading && !isBusy && !hasLoadError && isDirty && isValid;
  const canDiscard =
    canManage && !isLoading && !isBusy && !hasLoadError && (hasDraftEdits || formError !== null);
  const { isDiscardOpen, requestDiscard, confirmDiscard, cancelDiscard } =
    useUnsavedChangesGuard(canManage && !hasLoadError && isDirty);

  const setValue = useCallback((patch: Partial<BrandingFormValues>) => {
    setDraft((current) => ({ ...current, values: { ...current.values, ...patch } }));
    setFormError(null);
  }, []);

  const resetDraft = useCallback(() => {
    if (!branding) return;
    setDraft({ branding, baseline: branding, values: toBrandingForm(branding) });
    setFormError(null);
    setSubmitAttempted(false);
  }, [branding]);

  const discard = useCallback(() => {
    if (!branding || hasActiveCurrentOperation() || isBusy || isLoading) return;
    requestDiscard(resetDraft);
  }, [branding, hasActiveCurrentOperation, isBusy, isLoading, requestDiscard, resetDraft]);

  const handleConfirmDiscard = useCallback(() => {
    if (hasActiveCurrentOperation() || isBusy) return;
    confirmDiscard();
  }, [confirmDiscard, hasActiveCurrentOperation, isBusy]);

  const reload = useCallback(() => {
    if (hasActiveCurrentOperation() || isBusy || isLoading) return;
    requestDiscard(() => {
      void load();
    });
  }, [hasActiveCurrentOperation, isBusy, isLoading, load, requestDiscard]);

  const save = useCallback(async (): Promise<void> => {
    const startedFence = latestIntentFenceRef.current;
    if (!mountedRef.current || startedFence !== intentFence || hasActiveCurrentOperation() || !canSave || !baseline) {
      return;
    }
    const request = buildUpdateBrandingRequest(values, baseline);
    const editedFields = Object.keys(request) as (keyof UpdateBrandingRequest)[];
    if (editedFields.length === 0) return;

    const operationToken = Symbol("save");
    activeOperationRef.current = { token: operationToken, kind: "save", intentFence: startedFence };
    const isStaleIntent = () => !mountedRef.current || latestIntentFenceRef.current !== startedFence;

    setIsSaving(true);
    setFormError(null);
    setSubmitAttempted(false);
    try {
      const fresh = await fetchBrandingSettings();
      if (isStaleIntent()) return;
      if (editedFields.some((field) => fresh[field] !== baseline[field])) {
        setFormError(t.tradeCommon.conflictDescription);
        toast.error(t.tradeCommon.conflictTitle, t.tradeCommon.conflictDescription);
        return;
      }
      const saved = await updateBrandingSettings(request);
      if (isStaleIntent()) return;
      setDraft({ branding: saved, baseline: saved, values: toBrandingForm(saved) });
      publishBranding(saved);
      toast.success(t.coreBilling.brandingSavedTitle, t.coreBilling.brandingSaved);
    } catch (caught) {
      if (isStaleIntent()) return;
      if (caught instanceof SettingsInvalidResponseError) {
        setFormError(t.coreSettings.invalidResponseDescription);
        toast.error(t.coreBilling.brandingSaveFailed, t.coreSettings.invalidResponseDescription);
        return;
      }
      const normalized = normalizeApiError(caught);
      if (normalized.status === 403) {
        setFormError(t.coreBilling.brandingReadOnlyNotice);
        return;
      }
      const outcome = describeApiOutcome(normalized, t);
      if (!toast.outcomeFromApi(normalized)) {
        toast.errorFromApi(t.coreBilling.brandingSaveFailed, normalized);
      }
      setFormError(outcome ? outcome.description : t.coreBilling.brandingSaveFailed);
    } finally {
      if (activeOperationRef.current?.token === operationToken) activeOperationRef.current = null;
      if (!isStaleIntent()) setIsSaving(false);
    }
  }, [
    activeOperationRef, baseline, canSave, hasActiveCurrentOperation, intentFence,
    latestIntentFenceRef, mountedRef, publishBranding, t, toast, values,
  ]);

  const attemptSave = useCallback(() => {
    if (!canManage || isLoading || isBusy || hasLoadError) return;
    if (!isValid) {
      setSubmitAttempted(true);
      focusErrorSummary();
      return;
    }
    void save();
  }, [canManage, focusErrorSummary, hasLoadError, isBusy, isLoading, isValid, save]);

  return {
    canManage, isDenied, isDirty, isValid, isBusy, canSave, canDiscard, isDiscardOpen,
    branding, values, contrast, error, hasLoadError, loadErrorDescription,
    formError, fieldErrors, submitAttempted,
    setErrorSummaryNode, setAppNameNode, setTabTitleNode, setPrimaryColorNode, setSecondaryColorNode,
    uploading: assets.uploading, uploadError: assets.uploadError,
    activeUploadKind: assets.activeUploadKind, assetVersion: assets.assetVersion,
    isPreviewOpen, isLoading: isLoading && !hasLoaded, isRefreshing: isLoading, isSaving,
    setValue, focusField, discard, confirmDiscard: handleConfirmDiscard, cancelDiscard,
    openUploadModal: assets.openUploadModal, closeUploadModal: assets.closeUploadModal,
    clearUploadError: assets.clearUploadError, setPreviewOpen: setIsPreviewOpen,
    save, attemptSave, upload: assets.upload, reload,
  };
}
