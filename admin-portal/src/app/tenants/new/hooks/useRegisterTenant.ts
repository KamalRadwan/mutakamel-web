"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { adminCan } from "@/lib/auth/rbac";
import { useToast } from "@/components/ui/ToastContext";
import {
  getStoragePlacementState,
  readStoragePlacementOptions,
  TENANT_CREATE_PERMISSION,
  type TenantStoragePlacementOption,
} from "../../lib/storage-placement";

export function useRegisterTenant() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const canCreateTenant = adminCan(user, TENANT_CREATE_PERMISSION);

  const [currentStep, setCurrentStep] = useState(1);
  const [isValidatingIdentity, setIsValidatingIdentity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewingPlan, setIsPreviewingPlan] = useState(false);
  const [provisioningDag, setProvisioningDag] = useState<{
    selectionDigest: string;
    components: string[];
    stepsCount: number;
  } | null>(null);
  const [storagePlacementOptions, setStoragePlacementOptions] = useState<
    TenantStoragePlacementOption[]
  >([]);
  const [isLoadingStoragePlacement, setIsLoadingStoragePlacement] =
    useState(true);
  const [storagePlacementError, setStoragePlacementError] = useState<{
    message: string;
    correlationId?: string;
  } | null>(null);
  const [showStorageSelectionError, setShowStorageSelectionError] =
    useState(false);

  // Form State (matching CreateTenantDto)
  const [formData, setFormData] = useState({
    // Step 1: Identity & Geocoding & Address
    name: "",
    companyName: "",
    industry: "Retail & E-commerce",
    countryName: "مصر (Egypt)",
    countryIsoCode: "EG",
    timezone: "Africa/Cairo",
    phoneCountryCode: "+20",
    phone: "1001234567",
    taxNumber: "123-456-789",
    commercialRegistrationNumber: "CR-998877",
    street: "123 Nile Corniche",
    city: "Cairo",
    state: "Cairo Governorate",
    postalCode: "11511",

    // Step 2: Owner Contact Details
    ownerEmail: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerPhoneCountryCode: "+20",
    ownerPhone: "1001234567",
    ownerJobTitle: "Chief Executive Officer (CEO)",
    ownerLanguage: "ar",
    sendInvitation: true,
    ownerActive: true,

    // Step 3: Infrastructure Placement
    placementMode: "AUTO" as "AUTO" | "MANUAL",
    databaseServerId: "",
    storageServerId: "",

    // Step 4: Modules & Subscription Seed
    selectedModules: ["core", "crm", "trade", "worker"],
    billingCycle: "MONTHLY" as "MONTHLY" | "YEARLY",
    currencyCode: "EGP",
    trialDays: 14,
    allowedUsers: 25,
  });

  const loadStoragePlacementOptions = useCallback(async () => {
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
      );
      const options = readStoragePlacementOptions(response.data);
      setStoragePlacementOptions(options);
      setFormData((current) =>
        current.storageServerId &&
        !options.some((option) => option.id === current.storageServerId)
          ? { ...current, storageServerId: "" }
          : current,
      );
    } catch (error: unknown) {
      const apiError = readApiError(error);
      setStoragePlacementOptions([]);
      setFormData((current) => ({ ...current, storageServerId: "" }));
      setStoragePlacementError({
        message:
          apiError.message ||
          (lang === "ar"
            ? "تعذر تحميل أهداف التخزين المؤهلة."
            : "Storage placement targets could not be loaded."),
        correlationId: apiError.correlationId,
      });
    } finally {
      setIsLoadingStoragePlacement(false);
    }
  }, [canCreateTenant, isAuthLoading, lang]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStoragePlacementOptions();
    }, 0);
    return () => window.clearTimeout(timeoutId);
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

  const handleValidateIdentity = async () => {
    setIsValidatingIdentity(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsValidatingIdentity(false);

    if (formData.name && formData.name.length >= 3) {
      toast.success(
        lang === "ar" ? "الهوية متاحة" : "Identity Available",
        lang === "ar"
          ? `الاسم "${formData.name}" متاح، والنطاق ${formData.name}.mutakamel.ai جاهز للتثبيت!`
          : `Tenant code "${formData.name}" is available. FQDN ${formData.name}.mutakamel.ai is ready!`,
      );
    } else {
      toast.error(
        lang === "ar" ? "هوية غير صالحة" : "Invalid Identity",
        lang === "ar"
          ? "يرجى كتابة اسم كود للشركة يتكون من 3 أحرف على الأقل بالإنجليزية."
          : "Please enter a tenant code name of at least 3 English characters.",
      );
    }
  };

  const handlePreviewPlan = async () => {
    setIsPreviewingPlan(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setIsPreviewingPlan(false);
    setProvisioningDag({
      selectionDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      components: [
        "core.foundation.seed.organization",
        "core.identity.tenant.owner",
        "crm.database.schema.migrations",
        "trade.database.schema.migrations",
        "worker.queue.subscribers",
      ],
      stepsCount: 12,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidStorageSelection) {
      setShowStorageSelectionError(true);
      setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Fetch Subscription Quote
      const quotePayload = {
        modules: formData.selectedModules.map((moduleKey) => ({
          moduleKey,
          tierKey: "business",
          seats: formData.allowedUsers,
        })),
        billingCycle: formData.billingCycle,
        currencyCode: "USD",
      };
      const quoteRes = await axiosClient.post("/api/admin/core/v1/subscriptions/quote", quotePayload);
      const quoteId = quoteRes.data?.data?.quoteId || quoteRes.data?.quoteId;
      if (!quoteId) {
        throw new Error("Failed to obtain a valid subscription quote from the catalogue.");
      }

      // 2. Submit Tenant Creation
      const payload = {
        quoteId,
        name: formData.name,
        companyName: formData.companyName,
        countryName: formData.countryName,
        countryIsoCode: formData.countryIsoCode,
        industry: formData.industry,
        timezone: formData.timezone,
        phoneCountryCode: formData.phoneCountryCode,
        phone: formData.phone,
        address: {
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          street1: formData.street,
        },
        taxNumber: formData.taxNumber,
        commercialRegistrationNumber: formData.commercialRegistrationNumber,
        databaseServerId: formData.databaseServerId || undefined,
        storageServerId: formData.storageServerId,
        ownerEmail: formData.ownerEmail,
        ownerFirstName: formData.ownerFirstName,
        ownerLastName: formData.ownerLastName,
        ownerPhoneCountryCode: formData.ownerPhoneCountryCode,
        ownerPhone: formData.ownerPhone,
        ownerJobTitle: formData.ownerJobTitle,
        ownerLanguage: formData.ownerLanguage,
        sendInvitation: formData.sendInvitation,
        ownerActive: formData.ownerActive,
        billingCycle: formData.billingCycle,
        currencyCode: "USD",
        trialDays: formData.trialDays,
        modules: formData.selectedModules.map((moduleKey) => ({
          moduleKey,
          tierKey: "business",
          seats: formData.allowedUsers,
        })),
      };

      await axiosClient.post("/api/admin/core/v1/tenants", payload);

      toast.success(
        lang === "ar" ? "تم الإنشاء" : "Created",
        lang === "ar"
          ? "تم إنشاء بيئة العمل بنجاح."
          : "Tenant created successfully.",
      );
      router.push("/tenants");
    } catch (error: unknown) {
      const apiError = readApiError(error);
      const message =
        apiError.message ||
        (lang === "ar"
          ? "حدث خطأ أثناء إنشاء المستأجر."
          : "An error occurred while creating the tenant.");
      toast.error(
        lang === "ar" ? "فشل إنشاء المستأجر" : "Tenant Creation Failed",
        apiError.correlationId
          ? `${message}\nCorrelation ID: ${apiError.correlationId}`
          : message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToStep = (step: number) => {
    const next = Math.max(1, Math.min(5, step));
    if (next > 3 && !hasValidStorageSelection) {
      setShowStorageSelectionError(true);
      setCurrentStep(3);
      return;
    }
    setCurrentStep(next);
  };
  const nextStep = () => goToStep(currentStep + 1);
  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1));

  return {
    t,
    currentStep,
    goToStep,
    formData,
    setFormData,
    canCreateTenant,
    storagePlacementOptions,
    storagePlacementState,
    storagePlacementError,
    selectedStoragePlacement,
    showStorageSelectionError,
    setShowStorageSelectionError,
    loadStoragePlacementOptions,
    hasValidStorageSelection,
    isSubmitting,
    isValidatingIdentity,
    isPreviewingPlan,
    provisioningDag,
    handleValidateIdentity,
    handlePreviewPlan,
    handleSubmit,
    nextStep,
    prevStep,
    onCancel: () => router.push("/tenants"),
  };
}

function readApiError(error: unknown): {
  message?: string;
  correlationId?: string;
} {
  if (!error || typeof error !== "object") return {};
  const response = "response" in error ? error.response : null;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return {};
  }
  const data = response.data;
  if (!data || typeof data !== "object") return {};
  return {
    message:
      "message" in data && typeof data.message === "string"
        ? data.message
        : undefined,
    correlationId:
      "correlationId" in data && typeof data.correlationId === "string"
        ? data.correlationId
        : undefined,
  };
}
