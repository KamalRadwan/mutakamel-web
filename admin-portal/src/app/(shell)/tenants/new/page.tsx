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
import {
  AmbiguousOutcomePanel,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
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
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              aria-label={t.tenants.wizard.backToTenants}
              className="p-2"
            >
              {lang === "ar" ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
            </Button>
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
          <AmbiguousOutcomePanel
            idempotencyKey={pendingCreateRecovery.idempotencyKey}
            message={[
              t.tenants.wizard.recoveryBannerDesc(pendingCreateRecovery.tenantName),
              !canReadTenants ? t.tenants.wizard.recoveryPermissionNote : null,
              createRecoveryError,
            ]
              .filter(Boolean)
              .join(" ")}
            onRetryExact={
              canReadTenants
                ? () => void recoverTenantCreateStatus()
                : undefined
            }
            retrying={isRecoveringCreate}
          />
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
                      <Input
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
                        className="flex-1 font-mono"
                        required
                        aria-describedby="tenant-name-validation"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleValidateIdentity}
                        disabled={
                          isValidatingIdentity ||
                          !formData.name.trim() ||
                          !formData.companyName.trim()
                        }
                      >
                        {isValidatingIdentity ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t.tenants.wizard.checkAvailability
                        )}
                      </Button>
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
                    <Input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="e.g. Acme Retail LLC"
                      className="w-full"
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
                    <Input
                      type="text"
                      value={formData.industry}
                      onChange={(e) =>
                        setFormData({ ...formData, industry: e.target.value })
                      }
                      className="w-full"
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
                    <Select
                      value={formData.timezone}
                      onValueChange={(timezone) =>
                        setFormData({ ...formData, timezone })
                      }
                      disabled={
                        wizardLocked || countryTimezoneOptions.length === 0
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t.tenants.wizard.chooseTimezone}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {countryTimezoneOptions.map((timezone) => (
                          <SelectItem key={timezone} value={timezone}>
                            {timezone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Input
                      type="text"
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.street1}
                      maxLength={200}
                    />
                    <Input
                      type="text"
                      value={formData.buildingNo}
                      onChange={(e) =>
                        setFormData({ ...formData, buildingNo: e.target.value })
                      }
                      placeholder={t.tenants.wizard.buildingNumberPlaceholder}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.city}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder={t.tenants.wizard.stateProvincePlaceholder}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.district}
                      onChange={(e) =>
                        setFormData({ ...formData, district: e.target.value })
                      }
                      placeholder={t.tenants.wizard.districtPlaceholder}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      placeholder={t.tenants.wizard.postalCodePlaceholder}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.landmark}
                      onChange={(e) =>
                        setFormData({ ...formData, landmark: e.target.value })
                      }
                      placeholder={t.tenants.wizard.landmarkPlaceholder}
                      maxLength={100}
                    />
                    <Input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, taxNumber: e.target.value })
                      }
                      placeholder={t.tenants.detailsTab.taxNumber}
                    />
                  </div>
                  <Textarea
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
                    className="w-full resize-y"
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
                    <Input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerEmail: e.target.value })
                      }
                      placeholder="owner@company.com"
                      className="w-full"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.firstNameRequiredLabel}
                    </label>
                    <Input
                      type="text"
                      value={formData.ownerFirstName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerFirstName: e.target.value,
                        })
                      }
                      placeholder="Mona"
                      className="w-full"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.lastNameRequiredLabel}
                    </label>
                    <Input
                      type="text"
                      value={formData.ownerLastName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerLastName: e.target.value,
                        })
                      }
                      placeholder="Ali"
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.wizard.jobTitleLabel}
                    </label>
                    <Input
                      type="text"
                      value={formData.ownerJobTitle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ownerJobTitle: e.target.value,
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t.tenants.detailsTab.phone}
                    </label>
                    <Input
                      type="text"
                      value={formData.ownerPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, ownerPhone: e.target.value })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="tenant-send-invitation"
                      checked={formData.sendInvitation}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          sendInvitation: checked === true,
                        })
                      }
                    />
                    <label
                      htmlFor="tenant-send-invitation"
                      className="cursor-pointer select-none text-xs font-semibold text-foreground"
                    >
                      {t.tenants.wizard.sendInvitationLabel}
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Applications and authoritative provisioning preview */}
            {currentStep === 3 && (
              <TenantApplicationsStep
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
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                {t.tenants.wizard.previousStep}
              </Button>

              {currentStep < 5 ? (
                <Button type="button" variant="primary" onClick={nextStep}>
                  {t.tenants.wizard.nextStepLabel}
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={
                    isSubmitting ||
                    !hasValidIdentityEvidence ||
                    !hasValidApplicationSelection ||
                    provisioningPreviewState !== "ready" ||
                    !hasValidDatabaseSelection ||
                    !hasValidStorageSelection
                  }
                >
                  {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                  <span>
                    {t.tenants.wizard.confirmCreation}
                  </span>
                </Button>
              )}
            </div>
          </fieldset>
        </form>
    </div>
  );
}
