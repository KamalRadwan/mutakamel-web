"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { adminCan } from "@/lib/auth/rbac";
import { useToast } from "@/components/ui/ToastContext";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  getStoragePlacementState,
  readStoragePlacementOptions,
  TENANT_CREATE_PERMISSION,
  type TenantStoragePlacementOption,
} from "../../lib/storage-placement";
import { axiosClient } from "@/lib/api/axiosClient";
import { tenantRegistrationApi } from "../api/tenant-registration.api";
import {
  buildTenantSubscriptionLines,
  getTenantRegistrationLoadState,
  isTenantIdentityEvidenceCurrent,
  shouldRetainTenantCreateIntent,
  tenantIdentityFingerprint,
} from "../lib/tenant-registration";
import {
  clearPendingTenantCreateStatusAttempt,
  isTenantCreateDraftCurrent,
  persistPendingTenantCreateStatusAttempt,
  readPendingTenantCreateStatusAttempt,
  type PendingTenantCreateStatusAttempt,
} from "../lib/tenant-create-recovery";
import type {
  TenantApplicationCandidate,
  TenantApplicationSelection,
  TenantBillingCycle,
  TenantCreateCommand,
  TenantDatabasePlacementOption,
  TenantIdentityValidationEvidence,
  TenantProvisioningPlanPreview,
} from "../types";

export function useRegisterTenant() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getIdempotencyKey, resetKey } = useIdempotency();
  const canCreateTenant = adminCan(user, TENANT_CREATE_PERMISSION);
  const canReadTenants = adminCan(user, "admin.tenants.read");
  const canConfigureApplications = canCreateTenant;

  const [currentStep, setCurrentStep] = useState(1);
  const [isValidatingIdentity, setIsValidatingIdentity] = useState(false);
  const [identityValidationEvidence, setIdentityValidationEvidence] =
    useState<TenantIdentityValidationEvidence | null>(null);
  const [identityValidationError, setIdentityValidationError] =
    useState<NormalizedApiError | null>(null);
  const identityRequestGeneration = useRef(0);
  const identityRequestAbort = useRef<AbortController | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCreateRecovery, setPendingCreateRecovery] =
    useState<PendingTenantCreateStatusAttempt | null>(() =>
      readPendingTenantCreateStatusAttempt(),
    );
  const [isRecoveringCreate, setIsRecoveringCreate] = useState(false);
  const [createRecoveryError, setCreateRecoveryError] = useState<string | null>(
    null,
  );
  const submissionLockRef = useRef(false);
  const createRecoveryAbort = useRef<AbortController | null>(null);

  const [applicationCandidates, setApplicationCandidates] = useState<
    TenantApplicationCandidate[]
  >([]);
  const [applicationSelections, setApplicationSelections] = useState<
    Record<string, TenantApplicationSelection>
  >({});
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const [applicationError, setApplicationError] =
    useState<NormalizedApiError | null>(null);
  const [showApplicationSelectionError, setShowApplicationSelectionError] =
    useState(false);
  const applicationRequestGeneration = useRef(0);
  const applicationRequestAbort = useRef<AbortController | null>(null);

  const [databasePlacementOptions, setDatabasePlacementOptions] = useState<
    TenantDatabasePlacementOption[]
  >([]);
  const [isLoadingDatabasePlacement, setIsLoadingDatabasePlacement] =
    useState(false);
  const [databasePlacementError, setDatabasePlacementError] =
    useState<NormalizedApiError | null>(null);
  const [showDatabaseSelectionError, setShowDatabaseSelectionError] =
    useState(false);
  const databaseRequestGeneration = useRef(0);

  const [provisioningPreview, setProvisioningPreview] =
    useState<TenantProvisioningPlanPreview | null>(null);
  const [isLoadingProvisioningPreview, setIsLoadingProvisioningPreview] =
    useState(false);
  const [provisioningPreviewError, setProvisioningPreviewError] =
    useState<NormalizedApiError | null>(null);
  const provisioningRequestGeneration = useRef(0);

  const [storagePlacementOptions, setStoragePlacementOptions] = useState<
    TenantStoragePlacementOption[]
  >([]);
  const [isLoadingStoragePlacement, setIsLoadingStoragePlacement] =
    useState(true);
  const [storagePlacementError, setStoragePlacementError] =
    useState<NormalizedApiError | null>(null);
  const [showStorageSelectionError, setShowStorageSelectionError] =
    useState(false);
  const storageRequestGeneration = useRef(0);
  const storageRequestAbort = useRef<AbortController | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    industry: "Retail & E-commerce",
    countryName: "مصر (Egypt)",
    countryIsoCode: "EG",
    timezone: "Africa/Cairo",
    phoneCountryCode: "+20",
    phone: "",
    taxNumber: "",
    commercialRegistrationNumber: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    ownerEmail: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerPhoneCountryCode: "+20",
    ownerPhone: "",
    ownerJobTitle: "",
    ownerLanguage: "ar",
    sendInvitation: true,
    ownerActive: true,
    databaseServerId: "",
    storageServerId: "",
    billingCycle: "MONTHLY" as TenantBillingCycle,
    trialDays: 14,
  });

  const loadApplicationCandidates = useCallback(async () => {
    const generation = ++applicationRequestGeneration.current;
    applicationRequestAbort.current?.abort();
    if (isAuthLoading) {
      setIsLoadingApplications(true);
      return;
    }
    if (!canConfigureApplications) {
      setApplicationCandidates([]);
      setApplicationSelections({});
      setApplicationError(null);
      setIsLoadingApplications(false);
      return;
    }

    const controller = new AbortController();
    applicationRequestAbort.current = controller;
    setIsLoadingApplications(true);
    setApplicationError(null);
    try {
      const candidates = await tenantRegistrationApi.listCandidateApplications(
        controller.signal,
      );
      if (
        generation !== applicationRequestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setApplicationCandidates(candidates);
      setApplicationSelections((current) => {
        const retained: Record<string, TenantApplicationSelection> = {};
        for (const candidate of candidates) {
          const selection = current[candidate.key];
          if (
            selection &&
            candidate.selectionAllowed &&
            candidate.tiers.some((tier) => tier.id === selection.tierId)
          ) {
            retained[candidate.key] = selection;
          }
        }
        return retained;
      });
    } catch (caught) {
      if (
        generation !== applicationRequestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setApplicationCandidates([]);
      setApplicationSelections({});
      setApplicationError(normalizeApiError(caught));
    } finally {
      if (generation === applicationRequestGeneration.current) {
        setIsLoadingApplications(false);
      }
    }
  }, [canConfigureApplications, isAuthLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplicationCandidates();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadApplicationCandidates]);

  useEffect(
    () => () => {
      applicationRequestGeneration.current += 1;
      applicationRequestAbort.current?.abort();
      createRecoveryAbort.current?.abort();
    },
    [],
  );

  const selectedApplicationLines = useMemo(
    () =>
      buildTenantSubscriptionLines(
        applicationCandidates,
        applicationSelections,
      ),
    [applicationCandidates, applicationSelections],
  );
  const selectedApplicationKeys = useMemo(
    () => Object.keys(applicationSelections).sort(),
    [applicationSelections],
  );
  const hasValidApplicationSelection =
    selectedApplicationKeys.length > 0 &&
    selectedApplicationLines.length === selectedApplicationKeys.length;
  const selectedApplicationEvidenceFingerprint = selectedApplicationKeys
    .map((applicationKey) => {
      const candidate = applicationCandidates.find(
        (item) => item.key === applicationKey,
      );
      return candidate
        ? `${candidate.key}:${candidate.technicalDefinitionRevision}:${candidate.selectionAllowed}`
        : `${applicationKey}:missing`;
    })
    .join("|");

  const applicationState = getTenantRegistrationLoadState({
    permitted: canConfigureApplications,
    isLoading: isAuthLoading || isLoadingApplications,
    hasError: applicationError !== null,
    itemCount: applicationCandidates.length,
  });

  const toggleApplication = useCallback(
    (applicationKey: string, selected: boolean) => {
      const candidate = applicationCandidates.find(
        (item) => item.key === applicationKey,
      );
      if (
        selected &&
        (!candidate || !candidate.selectionAllowed || !candidate.tiers[0])
      ) {
        return;
      }
      setApplicationSelections((current) => {
        const next = { ...current };
        if (!selected) {
          delete next[applicationKey];
        } else if (candidate) {
          next[applicationKey] = {
            tierId: candidate.tiers[0].id,
            seats: 1,
          };
        }
        return next;
      });
      setShowApplicationSelectionError(false);
    },
    [applicationCandidates],
  );

  const updateApplicationSelection = useCallback(
    (applicationKey: string, patch: Partial<TenantApplicationSelection>) => {
      setApplicationSelections((current) => {
        const selection = current[applicationKey];
        if (!selection) return current;
        return {
          ...current,
          [applicationKey]: { ...selection, ...patch },
        };
      });
      setShowApplicationSelectionError(false);
    },
    [],
  );

  const loadDatabasePlacementOptions = useCallback(async () => {
    const generation = ++databaseRequestGeneration.current;
    setFormData((current) => ({ ...current, databaseServerId: "" }));
    setShowDatabaseSelectionError(false);
    setDatabasePlacementOptions([]);
    setDatabasePlacementError(null);
    if (
      !canCreateTenant ||
      !hasValidApplicationSelection ||
      !selectedApplicationEvidenceFingerprint
    ) {
      setIsLoadingDatabasePlacement(false);
      return;
    }

    setIsLoadingDatabasePlacement(true);
    try {
      const options =
        await tenantRegistrationApi.listDatabasePlacementOptions(
          selectedApplicationKeys,
        );
      if (generation !== databaseRequestGeneration.current) return;
      setDatabasePlacementOptions(options);
    } catch (caught) {
      if (generation !== databaseRequestGeneration.current) return;
      setDatabasePlacementError(normalizeApiError(caught));
    } finally {
      if (generation === databaseRequestGeneration.current) {
        setIsLoadingDatabasePlacement(false);
      }
    }
  }, [
    canCreateTenant,
    hasValidApplicationSelection,
    selectedApplicationEvidenceFingerprint,
    selectedApplicationKeys,
  ]);

  const loadProvisioningPreview = useCallback(async () => {
    const generation = ++provisioningRequestGeneration.current;
    setProvisioningPreview(null);
    setProvisioningPreviewError(null);
    if (
      !canCreateTenant ||
      !hasValidApplicationSelection ||
      !selectedApplicationEvidenceFingerprint
    ) {
      setIsLoadingProvisioningPreview(false);
      return;
    }

    setIsLoadingProvisioningPreview(true);
    try {
      const preview = await tenantRegistrationApi.previewProvisioningPlan(
        selectedApplicationKeys,
      );
      if (generation !== provisioningRequestGeneration.current) return;
      setProvisioningPreview(preview);
    } catch (caught) {
      if (generation !== provisioningRequestGeneration.current) return;
      setProvisioningPreviewError(normalizeApiError(caught));
    } finally {
      if (generation === provisioningRequestGeneration.current) {
        setIsLoadingProvisioningPreview(false);
      }
    }
  }, [
    canCreateTenant,
    hasValidApplicationSelection,
    selectedApplicationEvidenceFingerprint,
    selectedApplicationKeys,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        loadDatabasePlacementOptions(),
        loadProvisioningPreview(),
      ]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDatabasePlacementOptions, loadProvisioningPreview]);

  const databasePlacementState = getTenantRegistrationLoadState({
    permitted: canCreateTenant,
    isLoading: isLoadingDatabasePlacement,
    hasError: databasePlacementError !== null,
    itemCount: databasePlacementOptions.length,
    idle: selectedApplicationKeys.length === 0,
  });
  const provisioningPreviewState = getTenantRegistrationLoadState({
    permitted: canCreateTenant,
    isLoading: isLoadingProvisioningPreview,
    hasError: provisioningPreviewError !== null,
    itemCount: provisioningPreview ? 1 : 0,
    idle: selectedApplicationKeys.length === 0,
  });

  const selectedDatabasePlacement = useMemo(
    () =>
      databasePlacementOptions.find(
        (option) => option.id === formData.databaseServerId,
      ) ?? null,
    [databasePlacementOptions, formData.databaseServerId],
  );
  const hasValidDatabaseSelection =
    databasePlacementState === "ready" &&
    selectedDatabasePlacement !== null;

  const loadStoragePlacementOptions = useCallback(async () => {
    const generation = ++storageRequestGeneration.current;
    storageRequestAbort.current?.abort();
    const controller = new AbortController();
    storageRequestAbort.current = controller;
    if (isAuthLoading) {
      setIsLoadingStoragePlacement(true);
      return;
    }
    if (!canCreateTenant) {
      setStoragePlacementOptions([]);
      setStoragePlacementError(null);
      setIsLoadingStoragePlacement(false);
      return;
    }

    setIsLoadingStoragePlacement(true);
    setStoragePlacementError(null);
    try {
      const response = await axiosClient.get(
        "/api/admin/core/v1/tenants/storage-placement-options",
        { signal: controller.signal },
      );
      if (
        generation !== storageRequestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      const options = readStoragePlacementOptions(response.data);
      setStoragePlacementOptions(options);
      setFormData((current) =>
        current.storageServerId &&
        !options.some((option) => option.id === current.storageServerId)
          ? { ...current, storageServerId: "" }
          : current,
      );
    } catch (caught) {
      if (
        generation !== storageRequestGeneration.current ||
        controller.signal.aborted
      ) {
        return;
      }
      setStoragePlacementOptions([]);
      setFormData((current) => ({ ...current, storageServerId: "" }));
      setStoragePlacementError(normalizeApiError(caught));
    } finally {
      if (generation === storageRequestGeneration.current) {
        setIsLoadingStoragePlacement(false);
      }
    }
  }, [canCreateTenant, isAuthLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStoragePlacementOptions();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      storageRequestAbort.current?.abort();
    };
  }, [loadStoragePlacementOptions]);

  const storagePlacementState = getStoragePlacementState({
    canCreateTenant,
    isLoading: isAuthLoading || isLoadingStoragePlacement,
    hasError: storagePlacementError !== null,
    optionCount: storagePlacementOptions.length,
  });
  const selectedStoragePlacement = useMemo(
    () =>
      storagePlacementOptions.find(
        (option) => option.id === formData.storageServerId,
      ) ?? null,
    [formData.storageServerId, storagePlacementOptions],
  );
  const hasValidStorageSelection =
    storagePlacementState === "ready" &&
    selectedStoragePlacement !== null;

  const draftFingerprint = useMemo(
    () =>
      JSON.stringify({
        formData,
        selectedApplicationLines,
      }),
    [formData, selectedApplicationLines],
  );
  const draftFingerprintRef = useRef(draftFingerprint);
  useLayoutEffect(() => {
    draftFingerprintRef.current = draftFingerprint;
  }, [draftFingerprint]);

  const identityFingerprint = useMemo(
    () => tenantIdentityFingerprint(formData.name, formData.companyName),
    [formData.companyName, formData.name],
  );
  const identityFingerprintRef = useRef(identityFingerprint);
  const hasValidIdentityEvidence = isTenantIdentityEvidenceCurrent(
    identityValidationEvidence,
    formData.name,
    formData.companyName,
  );
  const currentIdentityValidationEvidence =
    identityValidationEvidence?.fingerprint === identityFingerprint
      ? identityValidationEvidence
      : null;

  useEffect(() => {
    if (identityFingerprintRef.current === identityFingerprint) return;
    identityFingerprintRef.current = identityFingerprint;
    identityRequestGeneration.current += 1;
    identityRequestAbort.current?.abort();
    queueMicrotask(() => {
      setIdentityValidationEvidence(null);
      setIdentityValidationError(null);
      setIsValidatingIdentity(false);
    });
  }, [identityFingerprint]);

  const handleValidateIdentity = async () => {
    const fingerprint = identityFingerprint;
    const generation = ++identityRequestGeneration.current;
    identityRequestAbort.current?.abort();
    const controller = new AbortController();
    identityRequestAbort.current = controller;
    setIsValidatingIdentity(true);
    setIdentityValidationError(null);
    setIdentityValidationEvidence(null);
    try {
      const result = await tenantRegistrationApi.validateIdentity({
        name: formData.name,
        companyName: formData.companyName,
      }, controller.signal);
      if (
        generation !== identityRequestGeneration.current ||
        controller.signal.aborted ||
        fingerprint !== tenantIdentityFingerprint(formData.name, formData.companyName)
      ) {
        return;
      }
      setIdentityValidationEvidence({ fingerprint, result });
      if (result.valid) {
        toast.success(
          lang === "ar" ? "الهوية متاحة" : "Identity available",
          result.message,
        );
      } else {
        toast.error(
          lang === "ar" ? "الهوية غير متاحة" : "Identity unavailable",
          result.message,
        );
      }
    } catch (caught) {
      if (generation !== identityRequestGeneration.current || controller.signal.aborted) {
        return;
      }
      const error = normalizeApiError(caught);
      setIdentityValidationError(error);
      toast.error(
        lang === "ar" ? "تعذر فحص الهوية" : "Identity check failed",
        error.message,
      );
    } finally {
      if (generation === identityRequestGeneration.current) {
        setIsValidatingIdentity(false);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionLockRef.current || isSubmitting) return;
    if (pendingCreateRecovery) {
      toast.warning(
        lang === "ar" ? "احسم أمر الإنشاء السابق" : "Resolve the previous create command",
        lang === "ar"
          ? "افحص حالة المستأجر المحفوظة قبل إرسال أمر إنشاء جديد."
          : "Check the retained tenant status before sending another create command.",
      );
      return;
    }
    if (!hasValidIdentityEvidence) {
      toast.error(
        lang === "ar" ? "فحص الهوية مطلوب" : "Identity check required",
        lang === "ar"
          ? "افحص اسم المستأجر واسم الشركة الحاليين قبل المتابعة."
          : "Validate the current tenant name and company name before continuing.",
      );
      setCurrentStep(1);
      return;
    }
    if (
      !formData.companyName ||
      !formData.industry ||
      !formData.timezone ||
      !formData.name
    ) {
      toast.error(
        lang === "ar" ? "بيانات ناقصة" : "Missing fields",
        lang === "ar"
          ? "يرجى استكمال البيانات الأساسية قبل المتابعة."
          : "Complete the required identity fields before proceeding.",
      );
      setCurrentStep(1);
      return;
    }
    if (
      !formData.ownerEmail.trim() ||
      !formData.ownerFirstName.trim() ||
      !formData.ownerLastName.trim() ||
      !formData.ownerPhoneCountryCode.trim() ||
      !formData.ownerPhone.trim() ||
      !formData.ownerJobTitle.trim()
    ) {
      toast.error(
        lang === "ar"
          ? "بيانات المالك ناقصة"
          : "Owner details are incomplete",
        lang === "ar"
          ? "أكمل بيانات المالك المطلوبة قبل المتابعة."
          : "Complete all required owner fields before continuing.",
      );
      setCurrentStep(2);
      return;
    }
    if (!hasValidApplicationSelection || provisioningPreviewState !== "ready") {
      setShowApplicationSelectionError(true);
      setCurrentStep(3);
      return;
    }
    if (!hasValidDatabaseSelection || !hasValidStorageSelection) {
      setShowDatabaseSelectionError(!hasValidDatabaseSelection);
      setShowStorageSelectionError(!hasValidStorageSelection);
      setCurrentStep(4);
      return;
    }

    const submittedFingerprint = draftFingerprint;
    let commandWasSent = false;
    submissionLockRef.current = true;
    setIsSubmitting(true);
    setCreateRecoveryError(null);
    try {
      const quote = await tenantRegistrationApi.quote(
        selectedApplicationLines,
        formData.billingCycle,
      );
      if (
        !isTenantCreateDraftCurrent(
          submittedFingerprint,
          draftFingerprintRef.current,
        )
      ) {
        throw new Error("TENANT_CREATE_DRAFT_CHANGED");
      }
      if (Date.parse(quote.expiresAt) <= Date.now()) {
        throw new Error("The subscription quote expired before tenant creation.");
      }
      const command: TenantCreateCommand = {
        quoteId: quote.quoteId,
        name: formData.name,
        companyName: formData.companyName,
        countryName: formData.countryName,
        countryIsoCode: formData.countryIsoCode,
        industry: formData.industry,
        timezone: formData.timezone,
        phoneCountryCode: formData.phoneCountryCode,
        ...(formData.phone.trim() ? { phone: formData.phone } : {}),
        address: {
          ...(formData.city.trim() ? { city: formData.city } : {}),
          ...(formData.state.trim() ? { state: formData.state } : {}),
          ...(formData.postalCode.trim()
            ? { postalCode: formData.postalCode }
            : {}),
          ...(formData.street.trim() ? { street1: formData.street } : {}),
        },
        ...(formData.taxNumber.trim()
          ? { taxNumber: formData.taxNumber }
          : {}),
        ...(formData.commercialRegistrationNumber.trim()
          ? {
              commercialRegistrationNumber:
                formData.commercialRegistrationNumber,
            }
          : {}),
        databaseServerId: selectedDatabasePlacement.id,
        storageServerId: selectedStoragePlacement.id,
        ownerEmail: formData.ownerEmail,
        ownerFirstName: formData.ownerFirstName,
        ownerLastName: formData.ownerLastName,
        ownerPhoneCountryCode: formData.ownerPhoneCountryCode,
        ownerPhone: formData.ownerPhone,
        ownerJobTitle: formData.ownerJobTitle,
        ownerLanguage: formData.ownerLanguage,
        sendInvitation: formData.sendInvitation,
        ownerActive: formData.ownerActive,
        subscription: {
          billingCycle: formData.billingCycle,
          currencyCode: "USD",
          trialDays: formData.trialDays,
          items: selectedApplicationLines.map((line) => ({
            moduleKey: line.applicationKey,
            tierKey: line.tierKey,
            seats: line.seats,
          })),
        },
      };
      if (
        !isTenantCreateDraftCurrent(
          submittedFingerprint,
          draftFingerprintRef.current,
        )
      ) {
        throw new Error("TENANT_CREATE_DRAFT_CHANGED");
      }
      const idempotencyKey = getIdempotencyKey({
        action: "tenant.create",
        path: "/api/admin/core/v1/tenants",
        command,
      });
      const statusAttempt: PendingTenantCreateStatusAttempt = {
        version: 1,
        idempotencyKey,
        tenantName: formData.name.trim().toLowerCase(),
        savedAt: new Date().toISOString(),
      };
      persistPendingTenantCreateStatusAttempt(statusAttempt);
      setPendingCreateRecovery(statusAttempt);
      commandWasSent = true;
      const createdTenant = await tenantRegistrationApi.create(
        command,
        idempotencyKey,
      );
      clearPendingTenantCreateStatusAttempt();
      setPendingCreateRecovery(null);
      setCreateRecoveryError(null);
      resetKey();
      toast.success(
        lang === "ar" ? "تم الإنشاء" : "Created",
        lang === "ar"
          ? "تم إنشاء بيئة العمل وبدأ التجهيز."
          : "Tenant created and provisioning has started.",
      );
      router.push(`/tenants/${createdTenant.id}`);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "TENANT_CREATE_DRAFT_CHANGED") {
        resetKey();
        toast.warning(
          lang === "ar" ? "تغيرت بيانات الإنشاء" : "Create draft changed",
          lang === "ar"
            ? "لم يُرسل أمر الإنشاء. راجع القيم الحالية واطلب عرض سعر جديدًا."
            : "No create command was sent. Review the current values and request a new quote.",
        );
        return;
      }
      const error = normalizeApiError(caught);
      const retainStatusEvidence =
        commandWasSent && shouldRetainTenantCreateIntent(error);
      if (!retainStatusEvidence) {
        clearPendingTenantCreateStatusAttempt();
        setPendingCreateRecovery(null);
        resetKey();
      }
      toast.error(
        lang === "ar" ? "فشل إنشاء المستأجر" : "Tenant creation failed",
        [
          error.message,
          error.errorCode ? `Code: ${error.errorCode}` : null,
          error.correlationId
            ? `Correlation ID: ${error.correlationId}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const recoverTenantCreateStatus = async () => {
    const attempt = pendingCreateRecovery;
    if (!attempt || isRecoveringCreate) return;
    if (!canReadTenants) {
      setCreateRecoveryError(
        lang === "ar"
          ? "يلزم تصريح admin.tenants.read لفحص الحالة. لم تُخزن بيانات الطلب أو بيانات المالك في المتصفح."
          : "admin.tenants.read is required to check status. No request DTO or owner data was stored in the browser.",
      );
      return;
    }

    createRecoveryAbort.current?.abort();
    const controller = new AbortController();
    createRecoveryAbort.current = controller;
    setIsRecoveringCreate(true);
    setCreateRecoveryError(null);
    try {
      const status = await tenantRegistrationApi.findCreateStatus(
        attempt.tenantName,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!status) {
        setCreateRecoveryError(
          lang === "ar"
            ? "لا يوجد سجل مستأجر مؤكد حتى الآن. احتفظ بعلامة الاسترداد وافحص الحالة مرة أخرى؛ لا ترسل أمر إنشاء جديدًا."
            : "No authoritative tenant record is visible yet. Keep the recovery marker and check again; do not send a new create command.",
        );
        return;
      }

      clearPendingTenantCreateStatusAttempt();
      setPendingCreateRecovery(null);
      resetKey();
      toast.success(
        lang === "ar" ? "تم استرداد نتيجة الإنشاء" : "Create outcome recovered",
        lang === "ar"
          ? `تم العثور على المستأجر بالحالة ${status.status}.`
          : `The tenant was found with status ${status.status}.`,
      );
      router.push(`/tenants/${status.id}`);
    } catch (caught) {
      if (controller.signal.aborted) return;
      const error = normalizeApiError(caught);
      setCreateRecoveryError(
        [
          error.message,
          error.correlationId
            ? `Correlation ID: ${error.correlationId}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } finally {
      if (!controller.signal.aborted) setIsRecoveringCreate(false);
    }
  };

  const goToStep = (step: number) => {
    if (isSubmitting || pendingCreateRecovery) return;
    const next = Math.max(1, Math.min(5, step));
    if (next > 1 && !hasValidIdentityEvidence) {
      toast.error(
        lang === "ar" ? "فحص الهوية مطلوب" : "Identity check required",
        lang === "ar"
          ? "افحص اسم المستأجر واسم الشركة الحاليين قبل المتابعة."
          : "Validate the current tenant name and company name before continuing.",
      );
      setCurrentStep(1);
      return;
    }
    if (
      next > 3 &&
      (!hasValidApplicationSelection || provisioningPreviewState !== "ready")
    ) {
      setShowApplicationSelectionError(true);
      setCurrentStep(3);
      return;
    }
    if (
      next > 4 &&
      (!hasValidDatabaseSelection || !hasValidStorageSelection)
    ) {
      setShowDatabaseSelectionError(!hasValidDatabaseSelection);
      setShowStorageSelectionError(!hasValidStorageSelection);
      setCurrentStep(4);
      return;
    }
    setCurrentStep(next);
  };

  return {
    t,
    currentStep,
    goToStep,
    formData,
    setFormData,
    canCreateTenant,
    applicationCandidates,
    applicationSelections,
    applicationState,
    applicationError,
    selectedApplicationLines,
    showApplicationSelectionError,
    setShowApplicationSelectionError,
    loadApplicationCandidates,
    toggleApplication,
    updateApplicationSelection,
    hasValidApplicationSelection,
    databasePlacementOptions,
    databasePlacementState,
    databasePlacementError,
    selectedDatabasePlacement,
    showDatabaseSelectionError,
    setShowDatabaseSelectionError,
    loadDatabasePlacementOptions,
    hasValidDatabaseSelection,
    provisioningPreview,
    provisioningPreviewState,
    provisioningPreviewError,
    loadProvisioningPreview,
    storagePlacementOptions,
    storagePlacementState,
    storagePlacementError,
    selectedStoragePlacement,
    showStorageSelectionError,
    setShowStorageSelectionError,
    loadStoragePlacementOptions,
    hasValidStorageSelection,
    isSubmitting,
    pendingCreateRecovery,
    isRecoveringCreate,
    createRecoveryError,
    canReadTenants,
    isValidatingIdentity,
    identityValidationEvidence: currentIdentityValidationEvidence,
    identityValidationError,
    hasValidIdentityEvidence,
    createOutcomeUnknown: pendingCreateRecovery !== null,
    recoverTenantCreateStatus,
    handleValidateIdentity,
    handleSubmit,
    nextStep: () => goToStep(currentStep + 1),
    prevStep: () => {
      if (!isSubmitting && !pendingCreateRecovery) {
        setCurrentStep((step) => Math.max(1, step - 1));
      }
    },
    onCancel: () => router.push("/tenants"),
  };
}
