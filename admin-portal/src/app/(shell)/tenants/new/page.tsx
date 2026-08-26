"use client";

import {
  Building2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  User,
  ShieldCheck,
  Globe,
  MapPin,
} from "lucide-react";
import { useRegisterTenant } from "./hooks/useRegisterTenant";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApplicationsStep } from "./components/TenantApplicationsStep";
import { TenantAddressGeocoding } from "./components/TenantAddressGeocoding";
import { TenantInfrastructureStep } from "./components/TenantInfrastructureStep";
import { CountrySelect } from "@/components/shared/CountrySelect";

export default function RegisterTenantWizardPage() {
  const {
    t,
    currentStep,
    goToStep,
    formData,
    setFormData,
    selectCountry,
    countryTimezoneOptions,
    applicationCandidates,
    applicationSelections,
    applicationState,
    applicationError,
    selectedApplicationLines,
    showApplicationSelectionError,
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
    identityValidationEvidence,
    identityValidationError,
    hasValidIdentityEvidence,
    recoverTenantCreateStatus,
    handleValidateIdentity,
    handleSubmit,
    nextStep,
    prevStep,
    onCancel,
  } = useRegisterTenant();
  const { lang } = useI18n();
  const wizardLocked = isSubmitting || pendingCreateRecovery !== null;

  return (
    <div className="space-y-6 w-full">
        {/* Header Title with Back Button */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label={
                lang === "ar" ? "العودة إلى المستأجرين" : "Back to tenants"
              }
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lang === "ar" ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>{t.tenants.wizardTitle}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t.tenants.wizardSubtitle}
              </p>
            </div>
          </div>
        </div>

        {pendingCreateRecovery ? (
          <section
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <h2 className="font-semibold">
              {lang === "ar"
                ? "نتيجة إنشاء سابقة تحتاج فحص الحالة"
                : "A previous tenant create needs status recovery"}
            </h2>
            <p className="mt-2 text-sm leading-6">
              {lang === "ar"
                ? `يحتفظ هذا التبويب فقط باسم المستأجر العام (${pendingCreateRecovery.tenantName}) ومفتاح الأمر ووقت الإرسال. لا تُخزن بيانات الشركة أو المالك أو العرض أو الخوادم. افحص سجل Core قبل بدء إنشاء جديد.`
                : `This tab retains only the public tenant name (${pendingCreateRecovery.tenantName}), command key, and send time. Company, owner, quote, and placement data are not stored. Check Core status before starting another create.`}
            </p>
            <button
              type="button"
              onClick={() => void recoverTenantCreateStatus()}
              disabled={isRecoveringCreate || !canReadTenants}
              className="mt-4 min-h-11 rounded-xl bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRecoveringCreate
                ? lang === "ar"
                  ? "جارٍ فحص الحالة…"
                  : "Checking status…"
                : lang === "ar"
                  ? "فحص حالة المستأجر"
                  : "Check tenant status"}
            </button>
            {!canReadTenants ? (
              <p className="mt-3 text-xs font-semibold">
                {lang === "ar"
                  ? "يلزم تصريح admin.tenants.read للفحص؛ لم يتم تفعيل إعادة إرسال تلقائية."
                  : "admin.tenants.read is required for recovery; automatic replay is not enabled."}
              </p>
            ) : null}
            {createRecoveryError ? (
              <p
                role="alert"
                className="mt-3 whitespace-pre-line text-xs font-semibold"
              >
                {createRecoveryError}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Wizard Step Navigation Bar */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="grid grid-cols-5 gap-1 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => goToStep(1)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 1
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 1
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step1}</span>
            </button>

            <button
              type="button"
              onClick={() => goToStep(2)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 2
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 2
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step2}</span>
            </button>

            <button
              type="button"
              onClick={() => goToStep(3)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 3
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 3
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step3}</span>
            </button>

            <button
              type="button"
              onClick={() => goToStep(4)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 4
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : currentStep > 4
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step4}</span>
            </button>

            <button
              type="button"
              onClick={() => goToStep(5)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 5
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400"
              }`}
            >
              <span>{t.tenants.step5}</span>
            </button>
          </div>
        </div>

        {/* Wizard Form Sections */}
        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <fieldset
            disabled={wizardLocked}
            className="min-w-0 space-y-6 border-0 p-0"
          >
            {/* Step 1: Identity & Geocoding & Address */}
            {currentStep === 1 && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 end-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 relative z-10">
                  <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {lang === "ar"
                      ? "الخطوة 1: هويّة المستأجر والدومين الأساسي (Tenant Identity & Address)"
                      : "Step 1: Tenant Identity & FQDN"}
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar"
                        ? "رمز ورابط المستأجر (name) *"
                        : "Tenant Name Code (name) *"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            name: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          })
                        }
                        placeholder="e.g. acme-retail"
                        className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                        required
                        aria-describedby="tenant-name-validation"
                      />
                      <button
                        type="button"
                        onClick={handleValidateIdentity}
                        disabled={
                          isValidatingIdentity ||
                          !formData.name.trim() ||
                          !formData.companyName.trim()
                        }
                        className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        {isValidatingIdentity ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : lang === "ar" ? (
                          "فحص التوفر"
                        ) : (
                          "Check Availability"
                        )}
                      </button>
                    </div>
                    <p
                      id="tenant-name-validation"
                      className={`text-[11px] ${
                        identityValidationEvidence?.result.fields.name.available
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {identityValidationEvidence?.result.fields.name.message ??
                        ""}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {lang === "ar"
                        ? `النطاق المولد: ${formData.name ? `${formData.name}.mutakamel.ai` : "name.mutakamel.ai"}`
                        : `Derived FQDN: ${formData.name ? `${formData.name}.mutakamel.ai` : "name.mutakamel.ai"}`}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.tenants.detailsTab.companyName} *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="e.g. Acme Retail LLC"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                      aria-describedby="tenant-company-validation"
                    />
                    <p
                      id="tenant-company-validation"
                      className={`text-[11px] ${
                        identityValidationEvidence?.result.fields.companyName
                          .available
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {identityValidationEvidence?.result.fields.companyName
                        .message ?? ""}
                    </p>
                  </div>
                </div>

                {identityValidationEvidence ? (
                  <div
                    role="status"
                    className={`rounded-xl border px-4 py-3 text-xs ${
                      hasValidIdentityEvidence
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    }`}
                  >
                    {identityValidationEvidence.result.message}
                  </div>
                ) : identityValidationError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                  >
                    <p>{identityValidationError.message}</p>
                    {identityValidationError.correlationId ? (
                      <p className="mt-1 font-mono text-xs">
                        Correlation ID: {identityValidationError.correlationId}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.tenants.detailsTab.industry}
                    </label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) =>
                        setFormData({ ...formData, industry: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "الدولة" : "Country"}
                    </label>
                    <CountrySelect
                      value={formData.countryIsoCode}
                      onChange={selectCountry}
                      disabled={wizardLocked}
                      placeholder={
                        lang === "ar" ? "اختر دولة…" : "Choose a country…"
                      }
                      searchPlaceholder={
                        lang === "ar" ? "ابحث عن دولة…" : "Search countries…"
                      }
                      emptyLabel={
                        lang === "ar"
                          ? "لا توجد نتائج مطابقة"
                          : "No matching countries"
                      }
                      className="block w-full"
                    />
                    {formData.countryName ? (
                      <p
                        className="font-mono text-xs text-slate-500 dark:text-slate-400"
                        dir="ltr"
                      >
                        {formData.countryName} · {formData.countryIsoCode}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.tenants.detailsTab.timezone}
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) =>
                        setFormData({ ...formData, timezone: e.target.value })
                      }
                      disabled={
                        wizardLocked || countryTimezoneOptions.length === 0
                      }
                      required
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {lang === "ar"
                          ? "اختر المنطقة الزمنية"
                          : "Choose a timezone"}
                      </option>
                      {countryTimezoneOptions.map((timezone) => (
                        <option key={timezone} value={timezone}>
                          {timezone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Address & Tax Information */}
                <div className="pt-3 space-y-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t.tenants.detailsTab.addressSection}</span>
                  </span>

                  <TenantAddressGeocoding
                    lang={lang}
                    disabled={wizardLocked}
                    onApply={(suggestion) => {
                      if (!selectCountry(suggestion.countryIsoCode)) return;
                      setFormData((current) => ({
                        ...current,
                        ...(suggestion.street1
                          ? { street: suggestion.street1 }
                          : {}),
                        ...(suggestion.city ? { city: suggestion.city } : {}),
                        ...(suggestion.state
                          ? { state: suggestion.state }
                          : {}),
                        ...(suggestion.district
                          ? { district: suggestion.district }
                          : {}),
                        ...(suggestion.buildingNo
                          ? { buildingNo: suggestion.buildingNo }
                          : {}),
                        ...(suggestion.postalCode
                          ? { postalCode: suggestion.postalCode }
                          : {}),
                        ...(suggestion.landmark
                          ? { landmark: suggestion.landmark }
                          : {}),
                        ...(suggestion.formattedAddress
                          ? { formattedAddress: suggestion.formattedAddress }
                          : {}),
                      }));
                    }}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.street1}
                      maxLength={200}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.buildingNo}
                      onChange={(e) =>
                        setFormData({ ...formData, buildingNo: e.target.value })
                      }
                      placeholder={
                        lang === "ar" ? "رقم المبنى" : "Building number"
                      }
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.city}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder={
                        lang === "ar"
                          ? "الولاية / المحافظة"
                          : "State / province"
                      }
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) =>
                        setFormData({ ...formData, district: e.target.value })
                      }
                      placeholder={lang === "ar" ? "الحي" : "District"}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      placeholder={
                        lang === "ar" ? "الرمز البريدي" : "Postal code"
                      }
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.landmark}
                      onChange={(e) =>
                        setFormData({ ...formData, landmark: e.target.value })
                      }
                      placeholder={lang === "ar" ? "علامة مميزة" : "Landmark"}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, taxNumber: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.taxNumber}
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <textarea
                    value={formData.formattedAddress}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        formattedAddress: e.target.value,
                      })
                    }
                    placeholder={
                      lang === "ar"
                        ? "العنوان المنسق القابل للتعديل"
                        : "Editable formatted address"
                    }
                    maxLength={500}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Owner Contact Details */}
            {currentStep === 2 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {lang === "ar"
                      ? "الخطوة 2: اعتمادات مالك الشركة والمدير الأول (Owner Contact & Initial Admin)"
                      : "Step 2: Owner Contact & Admin User"}
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar"
                        ? "البريد الإلكتروني للمالك *"
                        : "Owner Email *"}
                    </label>
                    <input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerEmail: e.target.value })
                      }
                      placeholder="owner@company.com"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "الاسم الأول *" : "First Name *"}
                    </label>
                    <input
                      type="text"
                      value={formData.ownerFirstName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerFirstName: e.target.value,
                        })
                      }
                      placeholder="Mona"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "الاسم الأخير *" : "Last Name *"}
                    </label>
                    <input
                      type="text"
                      value={formData.ownerLastName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerLastName: e.target.value,
                        })
                      }
                      placeholder="Ali"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "المسمى الوظيفي" : "Job Title"}
                    </label>
                    <input
                      type="text"
                      value={formData.ownerJobTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerJobTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.tenants.detailsTab.phone}
                    </label>
                    <input
                      type="text"
                      value={formData.ownerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.sendInvitation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sendInvitation: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>
                      {lang === "ar"
                        ? "إرسال بريد دعوة رسمي للانضمام للمالك تلقائياً (sendInvitation)"
                        : "Automatically send email invitation to owner (sendInvitation)"}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Step 3: Applications and authoritative provisioning preview */}
            {currentStep === 3 && (
              <TenantApplicationsStep
                isArabic={lang === "ar"}
                candidates={applicationCandidates}
                selections={applicationSelections}
                state={applicationState}
                error={applicationError}
                selectedLines={selectedApplicationLines}
                billingCycle={formData.billingCycle}
                showSelectionError={showApplicationSelectionError}
                preview={provisioningPreview}
                previewState={provisioningPreviewState}
                previewError={provisioningPreviewError}
                onRetryCandidates={() => void loadApplicationCandidates()}
                onRetryPreview={() => void loadProvisioningPreview()}
                onToggle={toggleApplication}
                onUpdateSelection={updateApplicationSelection}
                onBillingCycleChange={(billingCycle) =>
                  setFormData((current) => ({ ...current, billingCycle }))
                }
              />
            )}

            {/* Step 4: Application-aware infrastructure placement */}
            {currentStep === 4 && (
              <TenantInfrastructureStep
                isArabic={lang === "ar"}
                databaseOptions={databasePlacementOptions}
                databaseState={databasePlacementState}
                databaseError={databasePlacementError}
                selectedDatabase={selectedDatabasePlacement}
                selectedDatabaseId={formData.databaseServerId}
                showDatabaseSelectionError={showDatabaseSelectionError}
                onDatabaseChange={(databaseServerId) => {
                  setFormData((current) => ({ ...current, databaseServerId }));
                  setShowDatabaseSelectionError(false);
                }}
                onRetryDatabase={() => void loadDatabasePlacementOptions()}
                storageOptions={storagePlacementOptions}
                storageState={storagePlacementState}
                storageError={storagePlacementError}
                selectedStorage={selectedStoragePlacement}
                selectedStorageId={formData.storageServerId}
                showStorageSelectionError={showStorageSelectionError}
                onStorageChange={(storageServerId) => {
                  setFormData((current) => ({ ...current, storageServerId }));
                  setShowStorageSelectionError(false);
                }}
                onRetryStorage={() => void loadStoragePlacementOptions()}
              />
            )}

            {/* Step 5: Final Review & Submit */}
            {currentStep === 5 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {lang === "ar"
                      ? "الخطوة 5: مراجعة البيانات وإرسال أمر التجهيز التلقائي"
                      : "Step 5: Review & Confirm Provisioning Order"}
                  </span>
                </h3>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {t.tenants.tenantName}:
                    </span>
                    <span className="font-semibold font-mono">
                      {formData.name} ({formData.companyName})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {t.tenants.primaryFqdn}:
                    </span>
                    <span className="font-semibold font-mono text-blue-600">
                      {formData.name}.mutakamel.ai
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {lang === "ar" ? "المالك الرئيسي:" : "Primary Owner:"}
                    </span>
                    <span className="font-semibold">
                      {formData.ownerFirstName} {formData.ownerLastName} (
                      {formData.ownerEmail})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {t.tenants.hostingServer}:
                    </span>
                    <span className="text-end font-mono font-semibold">
                      {selectedDatabasePlacement
                        ? `${selectedDatabasePlacement.name} (${selectedDatabasePlacement.id})`
                        : lang === "ar"
                          ? "لم يتم الاختيار"
                          : "Not selected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {lang === "ar" ? "سيرفر التخزين:" : "Storage Server:"}
                    </span>
                    <span className="font-semibold font-mono text-end">
                      {selectedStoragePlacement
                        ? `${selectedStoragePlacement.name} (${selectedStoragePlacement.id})`
                        : lang === "ar"
                          ? "لم يتم الاختيار"
                          : "Not selected"}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                    <span className="text-slate-500">
                      {lang === "ar"
                        ? "التطبيقات المختارة:"
                        : "Selected Applications:"}
                    </span>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedApplicationLines.map((line) => (
                        <li
                          key={line.applicationId}
                          className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900"
                        >
                          <span className="font-semibold">
                            {line.applicationName}
                          </span>
                          <span className="ms-2 font-mono text-xs text-slate-500">
                            {line.tierKey} · {line.seats}{" "}
                            {lang === "ar" ? "مقعد" : "seats"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {provisioningPreview ? (
                    <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                      <span className="text-slate-500">
                        {lang === "ar" ? "خطة التجهيز:" : "Provisioning plan:"}
                      </span>
                      <span className="text-end font-semibold">
                        {provisioningPreview.components.length}{" "}
                        {lang === "ar" ? "مكون" : "components"} ·{" "}
                        {provisioningPreview.steps.length}{" "}
                        {lang === "ar" ? "خطوة" : "steps"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Wizard Controls Footer */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
              >
                {lang === "ar" ? "السابق" : "Previous"}
              </button>

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "التالي" : "Next Step"}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !hasValidIdentityEvidence ||
                    !hasValidApplicationSelection ||
                    provisioningPreviewState !== "ready" ||
                    !hasValidDatabaseSelection ||
                    !hasValidStorageSelection
                  }
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {lang === "ar" ? "تأكيد الإنشاء" : "Confirm Creation"}
                  </span>
                </button>
              )}
            </div>
          </fieldset>
        </form>
    </div>
  );
}
