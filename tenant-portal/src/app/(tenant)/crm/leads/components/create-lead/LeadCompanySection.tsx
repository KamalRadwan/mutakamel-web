"use client";

import { useMemo } from "react";
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
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { useLeadCompanyOptions } from "../../hooks/useLeadCompanyOptions";
import {
  LEAD_CREATE_LIMITS,
  type CreateLeadForm,
} from "../../lead-create-contract";
import { LeadFieldGuide } from "./LeadFieldGuide";

const NEW_COMPANY_VALUE = "__new_company__";

type LeadCompanyField =
  | "companyName"
  | "legalName"
  | "taxNumber"
  | "commercialRegistrationNumber"
  | "companyEmail"
  | "companyWebsite";

interface LeadCompanySectionProps {
  form: CreateLeadForm;
  errors: CrmFormErrors;
  options: ReturnType<typeof useLeadCompanyOptions>;
  disabled: boolean;
  onSelectCompany: (companyPartyId: string, companyName: string) => void;
  onFieldChange: (key: LeadCompanyField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * Section 02 (Corporate Route) — Organization Identity & Directory Linking (Violet Theme).
 *
 * Supports two routes:
 * 1. Create a New Company: 12-column grid for Company Name, Legal Name, Tax Number,
 *    Commercial Registration Number, Company Website, Company Official Email, and Company Phones.
 * 2. Existing Directory Company: Searchable Combobox over branch organizations (by display
 *    or legal name) + locked read-only Directory Organization Summary Card.
 */
export function LeadCompanySection({
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
}: LeadCompanySectionProps) {
  const { t, lang } = useI18n();
  const limits = LEAD_CREATE_LIMITS;
  const existing = form.existingCompanyPartyId.trim().length > 0;

  const selectedCompany = useMemo(
    () =>
      options.selectedCompany ?? options.companies.find(
        (company) => company.id === form.existingCompanyPartyId,
      ) ?? null,
    [options.selectedCompany, options.companies, form.existingCompanyPartyId],
  );

  const comboboxOptions = useMemo<ComboboxOption[]>(() => {
    const matched = options.companies
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
  }, [options.companies, t.crmLeads.newCompany]);

  function handleSelectCompanyOption(nextValue: string | undefined) {
    if (!nextValue || nextValue === NEW_COMPANY_VALUE) {
      onSelectCompany("", "");
      void options.selectCompany(null);
      return;
    }
    const found = options.companies.find((company) => company.id === nextValue);
    onSelectCompany(nextValue, found?.displayName ?? "");
    void options.selectCompany(nextValue);
  }

  return (
    <section
      data-form-section="company"
      className="relative overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors"
    >
      {/* Top 3px accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-primary"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-foreground">
            <Building2 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-foreground">
                02
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-semibold text-foreground outline-none"
              >
                {t.crmLeads.create.sections.company}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.crmLeads.create.companyDetailsSubtitle}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            existing
              ? "border-border/60 bg-muted text-foreground"
              : "border-border/60 bg-muted text-muted-foreground",
          )}
        >
          {existing ? (
            <>
              <Link2 className="size-3" aria-hidden="true" />
              {{ ar: "مرتبط بالدليل", en: "Directory Linked" }[lang]}
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
        {options.error && (
          <DegradedBanner message={options.error.message ?? t.crmShared.errorGeneric} />
        )}

        {/* Directory Company Route Picker */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="relative">
            <div className="absolute end-0 top-0 flex items-center gap-1.5">
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {options.companies.length}{" "}
                {{ ar: "شركة في الدليل", en: "in directory" }[lang]}
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
                value={form.existingCompanyPartyId || NEW_COMPANY_VALUE}
                selectedLabel={
                  existing
                    ? (selectedCompany?.displayName ??
                      (form.companyName || form.existingCompanyPartyId))
                    : t.crmLeads.newCompany
                }
                options={comboboxOptions}
                onSearch={options.searchCompanies}
                debounceMs={0}
                loading={options.isLoadingCompanies}
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
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-foreground">
                <Lock className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedCompany?.displayName ??
                      (form.companyName || form.existingCompanyPartyId)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success-subtle-foreground">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" />
                    {{
                      ar: "مرتبط بسجل المنشأة في الدليل",
                      en: "Verified Directory Party",
                    }[lang]}
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {form.legalName.length}/{limits.legalName}
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
                  value={form.legalName}
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
