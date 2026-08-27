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
        <div className="flex items-center justify-between bg-card p-5 rounded-xl border border-border shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label={t.tenants.wizard.backToTenants}
              className="p-2 rounded-xl border border-border hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors cursor-pointer text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lang === "ar" ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span>{t.tenants.wizardTitle}</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.tenants.wizardSubtitle}
              </p>
            </div>
          </div>
        </div>

        {pendingCreateRecovery ? (
          <section
            role="status"
            className="rounded-xl border border-warn-300 bg-warn-50 p-5 text-warn-950 dark:border-warn-900 dark:bg-warn-950/40 dark:text-warn-100"
          >
            <h2 className="font-semibold">
              {t.tenants.wizard.recoveryBannerTitle}
            </h2>
            <p className="mt-2 text-sm leading-6">
              {t.tenants.wizard.recoveryBannerDesc(pendingCreateRecovery.tenantName)}
            </p>
            <button
              type="button"
              onClick={() => void recoverTenantCreateStatus()}
              disabled={isRecoveringCreate || !canReadTenants}
              className="mt-4 min-h-11 rounded-xl bg-warn-800 px-4 text-sm font-semibold text-white hover:bg-warn-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRecoveringCreate ? t.tenants.wizard.checkingStatus : t.tenants.wizard.checkTenantStatus}
            </button>
            {!canReadTenants ? (
              <p className="mt-3 text-xs font-semibold">
                {t.tenants.wizard.recoveryPermissionNote}
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
        <div className="bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="grid grid-cols-5 gap-1 text-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => goToStep(1)}
              disabled={wizardLocked}
              className={`py-2 px-1 rounded-xl transition-all ${
                currentStep === 1
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : currentStep > 1
                    ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
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
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : currentStep > 2
                    ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
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
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : currentStep > 3
                    ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
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
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : currentStep > 4
                    ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
                    : "text-muted-foreground"
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
                  ? "bg-brand-500 text-ink-950 dark:bg-brand-400"
                  : "text-muted-foreground"
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
              <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>
                    {t.tenants.wizard.step1Heading}
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.tenantNameCodeLabel}
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
                        className="flex-1 px-3 py-2 text-xs font-mono bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
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
                        className="px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-100 transition-colors cursor-pointer"
                      >
                        {isValidatingIdentity ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t.tenants.wizard.checkAvailability
                        )}
                      </button>
                    </div>
                    <p
                      id="tenant-name-validation"
                      className={`text-2xs ${
                        identityValidationEvidence?.result.fields.name.available
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-danger-600 dark:text-danger-400"
                      }`}
                    >
                      {identityValidationEvidence?.result.fields.name.message ??
                        ""}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {t.tenants.wizard.derivedFqdn(
                        formData.name ? `${formData.name}.mutakamel.ai` : "name.mutakamel.ai",
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
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
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                      required
                      aria-describedby="tenant-company-validation"
                    />
                    <p
                      id="tenant-company-validation"
                      className={`text-2xs ${
                        identityValidationEvidence?.result.fields.companyName
                          .available
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-danger-600 dark:text-danger-400"
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
                        ? "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"
                        : "border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
                    }`}
                  >
                    {identityValidationEvidence.result.message}
                  </div>
                ) : identityValidationError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-xs text-danger-900 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200"
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
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.detailsTab.industry}
                    </label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) =>
                        setFormData({ ...formData, industry: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                    />
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.countryLabel}
                    </label>
                    <CountrySelect
                      value={formData.countryIsoCode}
                      onChange={selectCountry}
                      disabled={wizardLocked}
                      placeholder={t.tenants.wizard.chooseCountryPlaceholder}
                      searchPlaceholder={t.tenants.wizard.searchCountriesPlaceholder}
                      emptyLabel={t.tenants.wizard.noMatchingCountries}
                      className="block w-full"
                    />
                    {formData.countryName ? (
                      <p
                        className="font-mono text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {formData.countryName} · {formData.countryIsoCode}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
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
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {t.tenants.wizard.chooseTimezone}
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
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-danger-500" />
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
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.buildingNo}
                      onChange={(e) =>
                        setFormData({ ...formData, buildingNo: e.target.value })
                      }
                      placeholder={t.tenants.wizard.buildingNumberPlaceholder}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.city}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder={t.tenants.wizard.stateProvincePlaceholder}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) =>
                        setFormData({ ...formData, district: e.target.value })
                      }
                      placeholder={t.tenants.wizard.districtPlaceholder}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      placeholder={t.tenants.wizard.postalCodePlaceholder}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.landmark}
                      onChange={(e) =>
                        setFormData({ ...formData, landmark: e.target.value })
                      }
                      placeholder={t.tenants.wizard.landmarkPlaceholder}
                      maxLength={100}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
                    />
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, taxNumber: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.taxNumber}
                      className="px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl"
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
                    placeholder={t.tenants.wizard.formattedAddressPlaceholder}
                    maxLength={500}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-border bg-ink-100 px-3 py-2 text-xs dark:border-border dark:bg-ink-800/60"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Owner Contact Details */}
            {currentStep === 2 && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>
                    {t.tenants.wizard.step2Heading}
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.ownerEmailLabel}
                    </label>
                    <input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerEmail: e.target.value })
                      }
                      placeholder="owner@company.com"
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.firstNameRequiredLabel}
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
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.lastNameRequiredLabel}
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
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.jobTitleLabel}
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
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.detailsTab.phone}
                    </label>
                    <input
                      type="text"
                      value={formData.ownerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-ink-100 dark:bg-ink-800/60 border border-border rounded-xl text-foreground"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={formData.sendInvitation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sendInvitation: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-brand-600"
                    />
                    <span>
                      {t.tenants.wizard.sendInvitationLabel}
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
              <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-2xs">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>
                    {t.tenants.wizard.step5Heading}
                  </span>
                </h3>

                <div className="p-4 bg-ink-100 dark:bg-ink-800/50 rounded-xl border border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.tenants.tenantName}:
                    </span>
                    <span className="font-semibold font-mono">
                      {formData.name} ({formData.companyName})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.tenants.primaryFqdn}:
                    </span>
                    <span className="font-semibold font-mono text-brand-700 dark:text-brand-400">
                      {formData.name}.mutakamel.ai
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.tenants.wizard.primaryOwnerLabel}
                    </span>
                    <span className="font-semibold">
                      {formData.ownerFirstName} {formData.ownerLastName} (
                      {formData.ownerEmail})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.tenants.hostingServer}:
                    </span>
                    <span className="text-end font-mono font-semibold">
                      {selectedDatabasePlacement
                        ? `${selectedDatabasePlacement.name} (${selectedDatabasePlacement.id})`
                        : t.tenants.wizard.notSelected}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.tenants.wizard.storageServerLabel}
                    </span>
                    <span className="font-semibold font-mono text-end">
                      {selectedStoragePlacement
                        ? `${selectedStoragePlacement.name} (${selectedStoragePlacement.id})`
                        : t.tenants.wizard.notSelected}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 dark:border-border">
                    <span className="text-muted-foreground">
                      {t.tenants.wizard.selectedApplicationsLabel}
                    </span>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedApplicationLines.map((line) => (
                        <li
                          key={line.applicationId}
                          className="rounded-lg bg-white px-3 py-2 dark:bg-ink-900"
                        >
                          <span className="font-semibold">
                            {line.applicationName}
                          </span>
                          <span className="ms-2 font-mono text-xs text-muted-foreground">
                            {line.tierKey} · {line.seats}{" "}
                            {t.tenants.wizard.seatsSuffix}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {provisioningPreview ? (
                    <div className="flex justify-between border-t border-border pt-3 dark:border-border">
                      <span className="text-muted-foreground">
                        {t.tenants.wizard.provisioningPlanLabel}
                      </span>
                      <span className="text-end font-semibold">
                        {provisioningPreview.components.length}{" "}
                        {t.tenants.wizard.componentsSuffix} ·{" "}
                        {provisioningPreview.steps.length}{" "}
                        {t.tenants.wizard.stepsSuffix}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Wizard Controls Footer */}
            <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-2xs">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-4 py-2.5 text-xs font-semibold text-foreground bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                {t.tenants.wizard.previousStep}
              </button>

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-5 py-2.5 text-xs font-semibold text-ink-950 bg-brand-500 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500 rounded-lg transition-colors cursor-pointer"
                >
                  {t.tenants.wizard.nextStepLabel}
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
                  className="px-6 py-2.5 text-xs font-semibold text-ink-950 bg-brand-500 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500 rounded-lg shadow-lg shadow-brand-600/20 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {t.tenants.wizard.confirmCreation}
                  </span>
                </button>
              )}
            </div>
          </fieldset>
        </form>
    </div>
  );
}
