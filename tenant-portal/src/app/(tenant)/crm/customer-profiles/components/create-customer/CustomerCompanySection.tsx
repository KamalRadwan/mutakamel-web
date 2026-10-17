"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Globe,
  Link2,
  Lock,
  Mail,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import {
  Button,
  Combobox,
  DegradedBanner,
  Field,
  Input,
  cn,
  type ComboboxOption,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { LeadFieldGuide } from "../../../leads/components/create-lead/LeadFieldGuide";
import type { useLeadCompanyOptions } from "../../../leads/hooks/useLeadCompanyOptions";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  type CreateCustomerProfileForm,
} from "../../customer-profile-create-contract";

const NEW_COMPANY_VALUE = "__new_company__";

export type CompanyField =
  | "companyName"
  | "legalName"
  | "taxNumber"
  | "commercialRegistrationNumber"
  | "companyEmail"
  | "companyWebsite";

export interface CustomerCompanySectionProps {
  form: CreateCustomerProfileForm;
  errors: CrmFormErrors;
  options?: ReturnType<typeof useLeadCompanyOptions>;
  disabled: boolean;
  onSelectCompany?: (companyPartyId: string, companyName: string) => void;
  onFieldChange: (key: CompanyField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * Section 02 (Corporate) — Organization Identity & Directory Linking (Violet Theme).
 *
 * Matches `LeadCompanySection` 100%:
 * 1. Create a New Company: 12-column grid for Company Name, Legal Name, Tax Number,
 *    Commercial Registration Number, Company Website, Company Official Email, and Company Phones.
 * 2. Existing Directory Company: Searchable Combobox over branch organizations (by display
 *    or legal name) + locked read-only Directory Organization Summary Card.
 */
export function CustomerCompanySection({
  form,
  errors,
  options,
  disabled,
  onSelectCompany,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CustomerCompanySectionProps) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;
  const existingCompanyPartyId = form.existingCompanyPartyId ?? "";
  const existing = existingCompanyPartyId.trim().length > 0;
  const companies = options?.companies ?? [];

  const selectedCompany = useMemo(
    () =>
      companies.find((company) => company.id === existingCompanyPartyId) ??
      null,
    [companies, existingCompanyPartyId],
  );

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    const needle = query.trim().toLowerCase();
    const matched = companies
      .filter((company) => {
        if (!needle) return true;
        const displayMatch = company.displayName.toLowerCase().includes(needle);
        const legalMatch =
          company.legalName?.toLowerCase().includes(needle) ?? false;
        const orgMatch =
          company.organizationName?.toLowerCase().includes(needle) ?? false;
        return displayMatch || legalMatch || orgMatch;
      })
      .map((company) => ({
        value: company.id,
        label: company.displayName,
        description:
          company.legalName && company.legalName !== company.displayName
            ? company.legalName
            : undefined,
      }));

    return [
      {
        value: NEW_COMPANY_VALUE,
        label: t.crmLeads.newCompany,
      },
      ...matched,
    ];
  }, [companies, query, t.crmLeads.newCompany]);

  function handleSelectCompanyOption(nextValue: string | undefined) {
    if (!nextValue || nextValue === NEW_COMPANY_VALUE) {
      onSelectCompany?.("", "");
      void options?.selectCompany(null);
      return;
    }
    const found = companies.find((company) => company.id === nextValue);
    onSelectCompany?.(nextValue, found?.displayName ?? "");
    void options?.selectCompany(nextValue);
  }

  return (
    <section
      id="company"
      data-form-section="company"
      className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-card shadow-xs transition-colors dark:border-violet-400/20"
    >
      {/* Top 3px Violet-Fuchsia accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-linear-to-r from-violet-600 via-purple-500 to-fuchsia-500"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-violet-500/[0.03] px-4 py-3 dark:bg-violet-500/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300">
            <Building2 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                02
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-bold text-foreground outline-none"
              >
                {t.crmCustomerProfiles.create.sections.company}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.crmLeads.create.companyDetailsSubtitle}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
            existing
              ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300"
              : "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300",
          )}
        >
          {existing ? (
            <>
              <Link2 className="size-3" aria-hidden="true" />
              {lang === "ar" ? "مرتبط بالدليل" : "Directory Linked"}
            </>
          ) : (
            <>
              <Sparkles className="size-3" aria-hidden="true" />
              {t.crmLeads.newCompany}
            </>
          )}
        </span>
      </div>

      {/* Section Body */}
      <div className="space-y-4 p-4">
        {options?.error && (
          <DegradedBanner
            message={options.error.message ?? t.crmShared.errorGeneric}
          />
        )}

        {/* Directory Company Route Picker */}
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3 dark:border-violet-400/20 dark:bg-violet-500/[0.05]">
          <div className="relative">
            <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
              <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                {companies.length}{" "}
                {lang === "ar" ? "شركة في الدليل" : "in directory"}
              </span>
              <LeadFieldGuide field="existingCompanyPartyId" />
            </div>
            <Field
              label={t.crmLeads.existingCompany}
              error={errors.existingCompanyPartyId}
              showLabel
            >
              <Combobox
                size="sm"
                value={existingCompanyPartyId || NEW_COMPANY_VALUE}
                selectedLabel={
                  existing
                    ? (selectedCompany?.displayName ??
                      (form.companyName || existingCompanyPartyId))
                    : t.crmLeads.newCompany
                }
                options={comboboxOptions}
                onSearch={setQuery}
                debounceMs={0}
                loading={options?.isLoadingCompanies ?? false}
                placeholder={t.crmLeads.newCompany}
                searchPlaceholder={t.crmShared.searchCompanies}
                loadingLabel={t.common.loading}
                emptyLabel={t.crmShared.noMatchingCompanies}
                disabled={disabled}
                onValueChange={handleSelectCompanyOption}
                onBlur={() => onBlur("existingCompanyPartyId")}
              />
            </Field>
          </div>
        </div>

        {/* Route A: Locked Directory Organization Summary Card when existingCompanyPartyId is set */}
        {existing ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-500/25 bg-linear-to-r from-sky-500/[0.06] via-indigo-500/[0.04] to-violet-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Lock className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {selectedCompany?.displayName ??
                      (form.companyName || existingCompanyPartyId)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" />
                    {lang === "ar"
                      ? "مرتبط بسجل المنشأة في الدليل"
                      : "Verified Directory Party"}
                  </span>
                </div>
                {selectedCompany?.legalName && (
                  <p className="text-xs text-muted-foreground">
                    {selectedCompany.legalName}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t.crmLeads.create.existingContactLocked}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => handleSelectCompanyOption(NEW_COMPANY_VALUE)}
              className="shrink-0"
            >
              <PlusCircle className="size-3.5" aria-hidden="true" />
              {t.crmLeads.newCompany}
            </Button>
          </div>
        ) : (
          /* Route B: New Company 12-Column Grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {/* Company Trade Name (6 cols) */}
            <div className="relative md:col-span-6">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {form.companyName.length}/{limits.companyName}
                </span>
                <LeadFieldGuide field="companyName" />
              </div>
              <Field
                label={t.crmLeads.companyName}
                error={errors.companyName}
                required
                showLabel
              >
                <Input
                  size="sm"
                  placeholder={t.crmLeads.companyName}
                  value={form.companyName}
                  maxLength={limits.companyName}
                  disabled={disabled}
                  onChange={(event) =>
                    onFieldChange("companyName", event.target.value)
                  }
                  onBlur={() => onBlur("companyName")}
                />
              </Field>
            </div>

            {/* Official Legal Name (6 cols) */}
            <div className="relative md:col-span-6">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(form.legalName ?? "").length}/{limits.legalName}
                </span>
                <LeadFieldGuide field="legalName" />
              </div>
              <Field
                label={t.crmLeads.create.legalName}
                error={errors.legalName}
                showLabel
              >
                <Input
                  size="sm"
                  placeholder={t.crmLeads.create.legalName}
                  value={form.legalName ?? ""}
                  maxLength={limits.legalName}
                  disabled={disabled}
                  onChange={(event) =>
                    onFieldChange("legalName", event.target.value)
                  }
                  onBlur={() => onBlur("legalName")}
                />
              </Field>
            </div>

            {/* Tax Number (4 cols) */}
            <div className="relative md:col-span-4">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {form.taxNumber.length}/{limits.taxNumber}
                </span>
                <LeadFieldGuide field="taxNumber" />
              </div>
              <Field
                label={t.crmLeads.create.taxNumber}
                error={errors.taxNumber}
                showLabel
              >
                <Input
                  size="sm"
                  dir="ltr"
                  placeholder={t.crmLeads.create.taxNumber}
                  value={form.taxNumber}
                  maxLength={limits.taxNumber}
                  disabled={disabled}
                  onChange={(event) =>
                    onFieldChange("taxNumber", event.target.value)
                  }
                  onBlur={() => onBlur("taxNumber")}
                />
              </Field>
            </div>

            {/* Commercial Registration Number (4 cols) */}
            <div className="relative md:col-span-4">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {form.commercialRegistrationNumber.length}/
                  {limits.commercialRegistrationNumber}
                </span>
                <LeadFieldGuide field="commercialRegistrationNumber" />
              </div>
              <Field
                label={t.crmLeads.create.commercialRegistrationNumber}
                error={errors.commercialRegistrationNumber}
                showLabel
              >
                <Input
                  size="sm"
                  dir="ltr"
                  placeholder={t.crmLeads.create.commercialRegistrationNumber}
                  value={form.commercialRegistrationNumber}
                  maxLength={limits.commercialRegistrationNumber}
                  disabled={disabled}
                  onChange={(event) =>
                    onFieldChange(
                      "commercialRegistrationNumber",
                      event.target.value,
                    )
                  }
                  onBlur={() => onBlur("commercialRegistrationNumber")}
                />
              </Field>
            </div>

            {/* Company Website (4 cols) */}
            <div className="relative md:col-span-4">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(form.companyWebsite ?? "").length}/{limits.companyWebsite}
                </span>
                <LeadFieldGuide field="companyWebsite" />
              </div>
              <Field
                label={t.crmCustomerProfiles.create.companyWebsite}
                error={errors.companyWebsite}
                showLabel
              >
                <div className="relative flex items-center">
                  <Globe
                    className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    size="sm"
                    type="url"
                    dir="ltr"
                    placeholder="https://www.company.com"
                    value={form.companyWebsite ?? ""}
                    maxLength={limits.companyWebsite}
                    disabled={disabled}
                    onChange={(event) =>
                      onFieldChange("companyWebsite", event.target.value)
                    }
                    onBlur={() => onBlur("companyWebsite")}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>

            {/* Company Official Email (6 cols) */}
            <div className="relative md:col-span-6">
              <div className="absolute end-0 top-0 z-10 flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(form.companyEmail ?? "").length}/{limits.email}
                </span>
                <LeadFieldGuide field="companyEmail" />
              </div>
              <Field
                label={t.crmCustomerProfiles.create.companyEmail}
                error={errors.companyEmail}
                showLabel
              >
                <div className="relative flex items-center">
                  <Mail
                    className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    size="sm"
                    type="email"
                    dir="ltr"
                    placeholder="info@company.com"
                    value={form.companyEmail ?? ""}
                    maxLength={limits.email}
                    disabled={disabled}
                    onChange={(event) =>
                      onFieldChange("companyEmail", event.target.value)
                    }
                    onBlur={() => onBlur("companyEmail")}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>

            {/* Company Switchboard / Phones (6 cols) */}
            <div className="relative md:col-span-6">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  {t.crmLeads.create.companyPhones}
                </span>
                <LeadFieldGuide field="companyPhones" />
              </div>
              <CrmPhoneListField
                label={t.crmLeads.create.companyPhones}
                phones={form.companyPhones}
                path="companyPhones"
                errors={errors}
                disabled={disabled}
                onChange={onPhoneChange}
                onAdd={onPhoneAdd}
                onRemove={onPhoneRemove}
                onBlur={onBlur}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
