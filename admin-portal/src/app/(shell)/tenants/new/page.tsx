"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { useI18n } from "@/i18n/I18nContext";
import { TenantAddressGeocoding } from "./components/TenantAddressGeocoding";
import { TenantApplicationsStep } from "./components/TenantApplicationsStep";
import { TenantInfrastructureStep } from "./components/TenantInfrastructureStep";
import { TenantValidationSummary } from "./components/TenantValidationSummary";
import { TenantWizardProgress } from "./components/TenantWizardProgress";
import { useRegisterTenant } from "./hooks/useRegisterTenant";

export default function RegisterTenantWizardPage() {
  const {
    t,
    currentStep,
    goToStep,
    validationErrors,
    clearValidationError,
    focusValidationField,
    stepHeadingRef,
    validationSummaryRef,
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
    databasePlacementOptions,
    databasePlacementState,
    databasePlacementError,
    selectedDatabasePlacement,
    showDatabaseSelectionError,
    setShowDatabaseSelectionError,
    loadDatabasePlacementOptions,
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
  const labels = t.tenants.wizard.fieldLabels;
  const placeholders = t.tenants.wizard.placeholders;
  const wizardSteps = [
    { number: 1, label: t.tenants.step1 },
    { number: 2, label: t.tenants.step2 },
    { number: 3, label: t.tenants.step3 },
    { number: 4, label: t.tenants.step4 },
    { number: 5, label: t.tenants.step5 },
  ] as const;

  const validationError = (fieldId: string) =>
    validationErrors.find((error) => error.fieldId === fieldId)?.message;

  const updateField = <Key extends keyof typeof formData>(
    fieldId: string,
    key: Key,
    value: (typeof formData)[Key],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
    clearValidationError(fieldId);
  };

  const headingClassName =
    "flex items-center gap-2 border-b border-border pb-3 text-base font-semibold text-foreground outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="w-full space-y-6">
      <header className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label={t.tenants.wizard.backToTenants}
          >
            {lang === "ar" ? (
              <ArrowRight aria-hidden="true" className="size-4" />
            ) : (
              <ArrowLeft aria-hidden="true" className="size-4" />
            )}
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              <Building2 aria-hidden="true" className="size-5 text-primary" />
              <span>{t.tenants.wizardTitle}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.tenants.wizardSubtitle}
            </p>
          </div>
        </div>
      </header>

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
            canReadTenants ? () => void recoverTenantCreateStatus() : undefined
          }
          retrying={isRecoveringCreate}
        />
      ) : null}

      <TenantWizardProgress
        steps={wizardSteps}
        currentStep={currentStep}
        navigationLabel={t.tenants.wizard.stepNavigationLabel}
        currentLabel={t.tenants.wizard.currentStepStatus}
        completedLabel={t.tenants.wizard.completedStepStatus}
        disabled={wizardLocked}
        onStepChange={goToStep}
      />

      <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
        <div className="mb-6">
          <TenantValidationSummary
            ref={validationSummaryRef}
            errors={validationErrors}
            title={t.tenants.wizard.validationSummaryTitle}
            description={t.tenants.wizard.validationSummaryDescription}
            onFieldFocus={focusValidationField}
          />
        </div>

        <fieldset disabled={wizardLocked} className="min-w-0 space-y-6 border-0 p-0">
          {currentStep === 1 ? (
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className={headingClassName}>
                <Globe aria-hidden="true" className="size-4 text-primary" />
                {t.tenants.wizard.step1Heading}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="tenant-name"
                  label={labels.tenantName}
                  required
                  error={validationError("tenant-name")}
                >
                  {(field) => (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          {...field}
                          name="name"
                          type="text"
                          value={formData.name}
                          onChange={(event) =>
                            updateField(
                              "tenant-name",
                              "name",
                              event.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, ""),
                            )
                          }
                          placeholder={placeholders.tenantName}
                          className="flex-1 font-mono"
                          aria-describedby={[
                            field["aria-describedby"],
                            identityValidationEvidence
                              ? "tenant-name-identity"
                              : undefined,
                            "tenant-derived-fqdn",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleValidateIdentity()}
                          disabled={
                            isValidatingIdentity ||
                            !formData.name.trim() ||
                            !formData.companyName.trim()
                          }
                        >
                          {isValidatingIdentity ? (
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin motion-reduce:animate-none"
                            />
                          ) : null}
                          {t.tenants.wizard.checkAvailability}
                        </Button>
                      </div>
                      {identityValidationEvidence ? (
                        <p
                          id="tenant-name-identity"
                          className={`mt-1 text-sm ${
                            identityValidationEvidence.result.fields.name.available
                              ? "text-success-subtle-foreground"
                              : "text-destructive-subtle-foreground"
                          }`}
                        >
                          {identityValidationEvidence.result.fields.name.message}
                        </p>
                      ) : null}
                      <p
                        id="tenant-derived-fqdn"
                        className="mt-1 font-mono text-sm text-muted-foreground"
                        dir="ltr"
                      >
                        {t.tenants.wizard.derivedFqdn(
                          formData.name
                            ? `${formData.name}.mutakamel.ai`
                            : "name.mutakamel.ai",
                        )}
                      </p>
                    </>
                  )}
                </Field>

                <Field
                  id="tenant-company-name"
                  label={labels.companyName}
                  required
                  error={validationError("tenant-company-name")}
                >
                  {(field) => (
                    <>
                      <Input
                        {...field}
                        name="companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={(event) =>
                          updateField(
                            "tenant-company-name",
                            "companyName",
                            event.target.value,
                          )
                        }
                        placeholder={placeholders.companyName}
                        aria-describedby={[
                          field["aria-describedby"],
                          identityValidationEvidence
                            ? "tenant-company-identity"
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined}
                      />
                      {identityValidationEvidence ? (
                        <p
                          id="tenant-company-identity"
                          className={`mt-1 text-sm ${
                            identityValidationEvidence.result.fields.companyName
                              .available
                              ? "text-success-subtle-foreground"
                              : "text-destructive-subtle-foreground"
                          }`}
                        >
                          {
                            identityValidationEvidence.result.fields.companyName
                              .message
                          }
                        </p>
                      ) : null}
                    </>
                  )}
                </Field>
              </div>

              {identityValidationEvidence ? (
                <div
                  role="status"
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    hasValidIdentityEvidence
                      ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                      : "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
                  }`}
                >
                  {identityValidationEvidence.result.message}
                </div>
              ) : identityValidationError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-subtle-foreground"
                >
                  <p>{identityValidationError.message}</p>
                  {identityValidationError.correlationId ? (
                    <p className="mt-1 font-mono text-sm">
                      Correlation ID: {identityValidationError.correlationId}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  id="tenant-industry"
                  label={labels.industry}
                  required
                  error={validationError("tenant-industry")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="industry"
                      type="text"
                      value={formData.industry}
                      onChange={(event) =>
                        updateField("tenant-industry", "industry", event.target.value)
                      }
                    />
                  )}
                </Field>

                <Field
                  id="tenant-country"
                  label={labels.country}
                  required
                  error={validationError("tenant-country")}
                  className="lg:col-span-2"
                >
                  {(field) => (
                    <>
                      <CountrySelect
                        id={field.id}
                        label={labels.country}
                        value={formData.countryIsoCode}
                        onChange={(countryIsoCode) => {
                          const selected = selectCountry(countryIsoCode);
                          if (selected) {
                            clearValidationError("tenant-country");
                            clearValidationError("tenant-timezone");
                            clearValidationError("tenant-phone-country-code");
                          }
                          return selected;
                        }}
                        disabled={wizardLocked}
                        placeholder={t.tenants.wizard.chooseCountryPlaceholder}
                        searchPlaceholder={
                          t.tenants.wizard.searchCountriesPlaceholder
                        }
                        emptyLabel={t.tenants.wizard.noMatchingCountries}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        className="block w-full"
                      />
                      <Input
                        type="hidden"
                        name="countryIsoCode"
                        value={formData.countryIsoCode}
                      />
                      {formData.countryName ? (
                        <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                          {formData.countryName} · {formData.countryIsoCode}
                        </p>
                      ) : null}
                    </>
                  )}
                </Field>

                <Field
                  id="tenant-timezone"
                  label={labels.timezone}
                  required
                  error={validationError("tenant-timezone")}
                >
                  {(field) => (
                    <Select
                      name="timezone"
                      value={formData.timezone}
                      onValueChange={(timezone) =>
                        updateField("tenant-timezone", "timezone", timezone)
                      }
                      disabled={wizardLocked || countryTimezoneOptions.length === 0}
                      required
                    >
                      <SelectTrigger
                        id={field.id}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                      >
                        <SelectValue placeholder={t.tenants.wizard.chooseTimezone} />
                      </SelectTrigger>
                      <SelectContent>
                        {countryTimezoneOptions.map((timezone) => (
                          <SelectItem key={timezone} value={timezone}>
                            {timezone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="tenant-phone-country-code"
                  label={labels.tenantPhoneCountryCode}
                  required
                  error={validationError("tenant-phone-country-code")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="phoneCountryCode"
                      type="tel"
                      dir="ltr"
                      value={formData.phoneCountryCode}
                      onChange={(event) =>
                        updateField(
                          "tenant-phone-country-code",
                          "phoneCountryCode",
                          event.target.value,
                        )
                      }
                      placeholder={placeholders.callingCode}
                    />
                  )}
                </Field>
                <Field
                  id="tenant-phone"
                  label={labels.tenantPhone}
                  labelAction={
                    <span className="text-xs text-muted-foreground">
                      {t.tenants.wizard.optionalLabel}
                    </span>
                  }
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="phone"
                      type="tel"
                      dir="ltr"
                      value={formData.phone}
                      onChange={(event) =>
                        updateField("tenant-phone", "phone", event.target.value)
                      }
                      placeholder={placeholders.phone}
                    />
                  )}
                </Field>
              </div>

              <section aria-labelledby="tenant-address-heading" className="space-y-4 pt-2">
                <h3
                  id="tenant-address-heading"
                  className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  <MapPin aria-hidden="true" className="size-4 text-info" />
                  {t.tenants.detailsTab.addressSection}
                </h3>

                <TenantAddressGeocoding
                  lang={lang}
                  disabled={wizardLocked}
                  onApply={(suggestion) => {
                    if (!selectCountry(suggestion.countryIsoCode)) return;
                    clearValidationError("tenant-country");
                    clearValidationError("tenant-timezone");
                    clearValidationError("tenant-phone-country-code");
                    setFormData((current) => ({
                      ...current,
                      ...(suggestion.street1 ? { street: suggestion.street1 } : {}),
                      ...(suggestion.city ? { city: suggestion.city } : {}),
                      ...(suggestion.state ? { state: suggestion.state } : {}),
                      ...(suggestion.district ? { district: suggestion.district } : {}),
                      ...(suggestion.buildingNo
                        ? { buildingNo: suggestion.buildingNo }
                        : {}),
                      ...(suggestion.postalCode
                        ? { postalCode: suggestion.postalCode }
                        : {}),
                      ...(suggestion.landmark ? { landmark: suggestion.landmark } : {}),
                      ...(suggestion.formattedAddress
                        ? { formattedAddress: suggestion.formattedAddress }
                        : {}),
                    }));
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <AddressInput
                    id="tenant-address-street"
                    name="street"
                    label={labels.street}
                    value={formData.street}
                    maxLength={200}
                    onChange={(value) => updateField("tenant-address-street", "street", value)}
                  />
                  <AddressInput
                    id="tenant-address-building-number"
                    name="buildingNo"
                    label={labels.buildingNumber}
                    value={formData.buildingNo}
                    maxLength={100}
                    onChange={(value) =>
                      updateField("tenant-address-building-number", "buildingNo", value)
                    }
                  />
                  <AddressInput
                    id="tenant-address-city"
                    name="city"
                    label={labels.city}
                    value={formData.city}
                    maxLength={100}
                    onChange={(value) => updateField("tenant-address-city", "city", value)}
                  />
                  <AddressInput
                    id="tenant-address-state"
                    name="state"
                    label={labels.stateProvince}
                    value={formData.state}
                    maxLength={100}
                    onChange={(value) => updateField("tenant-address-state", "state", value)}
                  />
                  <AddressInput
                    id="tenant-address-district"
                    name="district"
                    label={labels.district}
                    value={formData.district}
                    maxLength={100}
                    onChange={(value) =>
                      updateField("tenant-address-district", "district", value)
                    }
                  />
                  <AddressInput
                    id="tenant-address-postal-code"
                    name="postalCode"
                    label={labels.postalCode}
                    value={formData.postalCode}
                    maxLength={100}
                    onChange={(value) =>
                      updateField("tenant-address-postal-code", "postalCode", value)
                    }
                  />
                  <AddressInput
                    id="tenant-address-landmark"
                    name="landmark"
                    label={labels.landmark}
                    value={formData.landmark}
                    maxLength={100}
                    onChange={(value) =>
                      updateField("tenant-address-landmark", "landmark", value)
                    }
                  />
                  <AddressInput
                    id="tenant-tax-number"
                    name="taxNumber"
                    label={labels.taxNumber}
                    value={formData.taxNumber}
                    onChange={(value) => updateField("tenant-tax-number", "taxNumber", value)}
                  />
                  <AddressInput
                    id="tenant-commercial-registration-number"
                    name="commercialRegistrationNumber"
                    label={labels.commercialRegistrationNumber}
                    value={formData.commercialRegistrationNumber}
                    onChange={(value) =>
                      updateField(
                        "tenant-commercial-registration-number",
                        "commercialRegistrationNumber",
                        value,
                      )
                    }
                  />
                </div>
                <Field id="tenant-formatted-address" label={labels.formattedAddress}>
                  {(field) => (
                    <Textarea
                      {...field}
                      name="formattedAddress"
                      value={formData.formattedAddress}
                      onChange={(event) =>
                        updateField(
                          "tenant-formatted-address",
                          "formattedAddress",
                          event.target.value,
                        )
                      }
                      maxLength={500}
                      rows={3}
                      className="resize-y"
                    />
                  )}
                </Field>
              </section>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className={headingClassName}>
                <User aria-hidden="true" className="size-4 text-primary" />
                {t.tenants.wizard.step2Heading}
              </h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="tenant-owner-email"
                  label={labels.ownerEmail}
                  required
                  error={validationError("tenant-owner-email")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerEmail"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={formData.ownerEmail}
                      onChange={(event) =>
                        updateField("tenant-owner-email", "ownerEmail", event.target.value)
                      }
                      placeholder={placeholders.ownerEmail}
                    />
                  )}
                </Field>
                <Field
                  id="tenant-owner-first-name"
                  label={labels.firstName}
                  required
                  error={validationError("tenant-owner-first-name")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerFirstName"
                      type="text"
                      autoComplete="given-name"
                      value={formData.ownerFirstName}
                      onChange={(event) =>
                        updateField(
                          "tenant-owner-first-name",
                          "ownerFirstName",
                          event.target.value,
                        )
                      }
                      placeholder={placeholders.firstName}
                    />
                  )}
                </Field>
                <Field
                  id="tenant-owner-last-name"
                  label={labels.lastName}
                  required
                  error={validationError("tenant-owner-last-name")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerLastName"
                      type="text"
                      autoComplete="family-name"
                      value={formData.ownerLastName}
                      onChange={(event) =>
                        updateField(
                          "tenant-owner-last-name",
                          "ownerLastName",
                          event.target.value,
                        )
                      }
                      placeholder={placeholders.lastName}
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="tenant-owner-job-title"
                  label={labels.jobTitle}
                  required
                  error={validationError("tenant-owner-job-title")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerJobTitle"
                      type="text"
                      autoComplete="organization-title"
                      value={formData.ownerJobTitle}
                      onChange={(event) =>
                        updateField(
                          "tenant-owner-job-title",
                          "ownerJobTitle",
                          event.target.value,
                        )
                      }
                    />
                  )}
                </Field>
                <Field
                  id="tenant-owner-phone-country-code"
                  label={labels.ownerPhoneCountryCode}
                  required
                  error={validationError("tenant-owner-phone-country-code")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerPhoneCountryCode"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel-country-code"
                      value={formData.ownerPhoneCountryCode}
                      onChange={(event) =>
                        updateField(
                          "tenant-owner-phone-country-code",
                          "ownerPhoneCountryCode",
                          event.target.value,
                        )
                      }
                      placeholder={placeholders.callingCode}
                    />
                  )}
                </Field>
                <Field
                  id="tenant-owner-phone"
                  label={labels.ownerPhone}
                  required
                  error={validationError("tenant-owner-phone")}
                >
                  {(field) => (
                    <Input
                      {...field}
                      name="ownerPhone"
                      type="tel"
                      dir="ltr"
                      autoComplete="tel-national"
                      value={formData.ownerPhone}
                      onChange={(event) =>
                        updateField("tenant-owner-phone", "ownerPhone", event.target.value)
                      }
                      placeholder={placeholders.phone}
                    />
                  )}
                </Field>
              </div>

              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id="tenant-send-invitation"
                  name="sendInvitation"
                  checked={formData.sendInvitation}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({
                      ...current,
                      sendInvitation: checked === true,
                    }))
                  }
                />
                <label
                  htmlFor="tenant-send-invitation"
                  className="cursor-pointer select-none text-sm font-medium text-foreground"
                >
                  {t.tenants.wizard.sendInvitationLabel}
                </label>
              </div>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <TenantApplicationsStep
              headingRef={stepHeadingRef}
              candidates={applicationCandidates}
              selections={applicationSelections}
              state={applicationState}
              error={applicationError}
              selectedLines={selectedApplicationLines}
              billingCycle={formData.billingCycle}
              showSelectionError={showApplicationSelectionError}
              selectionError={validationError("tenant-applications-selection")}
              preview={provisioningPreview}
              previewState={provisioningPreviewState}
              previewError={provisioningPreviewError}
              onRetryCandidates={() => void loadApplicationCandidates()}
              onRetryPreview={() => void loadProvisioningPreview()}
              onToggle={(applicationKey, selected) => {
                toggleApplication(applicationKey, selected);
                clearValidationError("tenant-applications-selection");
              }}
              onUpdateSelection={updateApplicationSelection}
              onBillingCycleChange={(billingCycle) =>
                setFormData((current) => ({ ...current, billingCycle }))
              }
            />
          ) : null}

          {currentStep === 4 ? (
            <TenantInfrastructureStep
              headingRef={stepHeadingRef}
              databaseOptions={databasePlacementOptions}
              databaseState={databasePlacementState}
              databaseError={databasePlacementError}
              selectedDatabase={selectedDatabasePlacement}
              selectedDatabaseId={formData.databaseServerId}
              showDatabaseSelectionError={showDatabaseSelectionError}
              databaseSelectionError={validationError("tenant-database-server")}
              onDatabaseChange={(databaseServerId) => {
                setFormData((current) => ({ ...current, databaseServerId }));
                setShowDatabaseSelectionError(false);
                clearValidationError("tenant-database-server");
              }}
              onRetryDatabase={() => void loadDatabasePlacementOptions()}
              storageOptions={storagePlacementOptions}
              storageState={storagePlacementState}
              storageError={storagePlacementError}
              selectedStorage={selectedStoragePlacement}
              selectedStorageId={formData.storageServerId}
              showStorageSelectionError={showStorageSelectionError}
              storageSelectionError={validationError("tenant-storage-server")}
              onStorageChange={(storageServerId) => {
                setFormData((current) => ({ ...current, storageServerId }));
                setShowStorageSelectionError(false);
                clearValidationError("tenant-storage-server");
              }}
              onRetryStorage={() => void loadStoragePlacementOptions()}
            />
          ) : null}

          {currentStep === 5 ? (
            <section className="space-y-5 rounded-lg border border-border bg-card p-5">
              <h2 ref={stepHeadingRef} tabIndex={-1} className={headingClassName}>
                <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                {t.tenants.wizard.step5Heading}
              </h2>

              <dl className="divide-y divide-border rounded-lg border border-border bg-muted/50 px-4 text-sm">
                <ReviewRow
                  label={t.tenants.tenantName}
                  value={`${formData.name} (${formData.companyName})`}
                  mono
                />
                <ReviewRow
                  label={t.tenants.primaryFqdn}
                  value={`${formData.name}.mutakamel.ai`}
                  mono
                />
                <ReviewRow
                  label={t.tenants.wizard.primaryOwnerLabel}
                  value={`${formData.ownerFirstName} ${formData.ownerLastName} (${formData.ownerEmail})`}
                />
                <ReviewRow
                  label={t.tenants.hostingServer}
                  value={
                    selectedDatabasePlacement
                      ? `${selectedDatabasePlacement.name} (${selectedDatabasePlacement.id})`
                      : t.tenants.wizard.notSelected
                  }
                  mono
                />
                <ReviewRow
                  label={t.tenants.wizard.storageServerLabel}
                  value={
                    selectedStoragePlacement
                      ? `${selectedStoragePlacement.name} (${selectedStoragePlacement.id})`
                      : t.tenants.wizard.notSelected
                  }
                  mono
                />
                <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">
                    {t.tenants.wizard.selectedApplicationsLabel}
                  </dt>
                  <dd>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {selectedApplicationLines.map((line) => (
                        <li
                          key={line.applicationId}
                          className="rounded-md border border-border bg-card px-3 py-2"
                        >
                          <span className="font-semibold text-foreground">
                            {line.applicationName}
                          </span>
                          <span className="ms-2 font-mono text-sm text-muted-foreground">
                            {line.tierKey} · {line.seats} {t.tenants.wizard.seatsSuffix}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                {provisioningPreview ? (
                  <ReviewRow
                    label={t.tenants.wizard.provisioningPlanLabel}
                    value={`${provisioningPreview.components.length} ${t.tenants.wizard.componentsSuffix} · ${provisioningPreview.steps.length} ${t.tenants.wizard.stepsSuffix}`}
                  />
                ) : null}
              </dl>
            </section>
          ) : null}

          <footer className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
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
                disabled={wizardLocked}
              >
                {!isSubmitting ? (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                ) : null}
                {t.tenants.wizard.confirmCreation}
              </Button>
            )}
          </footer>
        </fieldset>
      </form>
    </div>
  );
}

function AddressInput({
  id,
  name,
  label,
  value,
  maxLength,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      {(field) => (
        <Input
          {...field}
          name={name}
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 break-words font-semibold text-foreground sm:text-end ${
          mono ? "font-mono" : ""
        }`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
