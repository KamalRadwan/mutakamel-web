"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nContext";

export function useRegisterTenant() {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingIdentity, setIsValidatingIdentity] = useState(false);
  const [identityResult, setIdentityResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isPreviewingPlan, setIsPreviewingPlan] = useState(false);
  const [provisioningDag, setProvisioningDag] = useState<{
    selectionDigest: string;
    components: string[];
    stepsCount: number;
  } | null>(null);

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

    // Step 3: Database Host Placement
    placementMode: "AUTO" as "AUTO" | "MANUAL",
    databaseServerId: "",

    // Step 4: Modules & Subscription Seed
    selectedModules: ["core", "crm", "trade", "worker"],
    billingCycle: "MONTHLY" as "MONTHLY" | "YEARLY",
    currencyCode: "EGP",
    trialDays: 14,
    allowedUsers: 25,
  });

  const handleValidateIdentity = async () => {
    setIsValidatingIdentity(true);
    setIdentityResult(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsValidatingIdentity(false);

    if (formData.name && formData.name.length >= 3) {
      setIdentityResult({
        valid: true,
        message:
          lang === "ar"
            ? `الاسم "${formData.name}" متاح، والنطاق ${formData.name}.mutakamel.ai جاهز للتثبيت!`
            : `Tenant code "${formData.name}" is available. FQDN ${formData.name}.mutakamel.ai is ready!`,
      });
    } else {
      setIdentityResult({
        valid: false,
        message:
          lang === "ar"
            ? "يرجى كتابة اسم كود للشركة يتكون من 3 أحرف على الأقل بالإنجليزية."
            : "Please enter a tenant code name of at least 3 English characters.",
      });
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
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSubmitting(false);
    router.push("/tenants");
  };

  const nextStep = () => setCurrentStep((s) => Math.min(5, s + 1));
  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1));

  return {
    t,
    currentStep,
    setCurrentStep,
    formData,
    setFormData,
    isValidatingIdentity,
    identityResult,
    isPreviewingPlan,
    provisioningDag,
    isSubmitting,
    handleValidateIdentity,
    handlePreviewPlan,
    handleSubmit,
    nextStep,
    prevStep,
    onCancel: () => router.push("/tenants"),
  };
}
