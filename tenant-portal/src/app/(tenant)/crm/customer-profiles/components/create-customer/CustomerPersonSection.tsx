"use client";

import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  Mail,
  Phone,
  Plus,
  Star,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import { formatTemplate } from "@/lib/format/template";
import { LeadFieldGuide } from "../../../leads/components/create-lead/LeadFieldGuide";
import { CRM_PHONE_LIST_MAX } from "../../../shared/components/CrmPhoneListField";
import { CrmPhoneNumberInput } from "../../../shared/components/CrmPhoneNumberInput";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import {
  CUSTOMER_PROFILE_CREATE_LIMITS,
  type CreateCustomerProfileForm,
} from "../../customer-profile-create-contract";

type PersonField = "honorificTitle" | "firstName" | "lastName" | "email";

export interface CustomerPersonSectionProps {
  form: CreateCustomerProfileForm;
  errors: CrmFormErrors;
  disabled: boolean;
  onFieldChange: (key: PersonField, value: string) => void;
  onPhoneChange: (index: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

const EMAIL_SIMPLE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Section 02 (Individual) — Personal Identity & Direct Contact Channels.
 *
 * Matches `LeadPersonSection` 100%:
 * - Row 1: Honorific Title (2 cols) + First Name with User icon (5 cols) + Last Name (5 cols)
 * - Row 2: Direct Phone Numbers with E.164 picker (6 cols) + Email with Mail icon (6 cols)
 */
export function CustomerPersonSection({
  form,
  errors,
  disabled,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CustomerPersonSectionProps) {
  const { t, lang } = useI18n();
  const limits = CUSTOMER_PROFILE_CREATE_LIMITS;
  const honorifics = getHonorificOptions(lang);
  const honorific = findHonorific(form.honorificTitle, lang);
  const extraPhones = form.phones.slice(1);
  const isEmailValid =
    form.email.trim().length > 0 &&
    !errors.email &&
    EMAIL_SIMPLE_RE.test(form.email.trim());

  // Seed default honorific once when blank
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (form.honorificTitle.trim().length > 0) return;
    const [first] = honorifics;
    if (first) queueMicrotask(() => onFieldChange("honorificTitle", first.label));
  }, [form.honorificTitle, honorifics, onFieldChange]);

  return (
    <section
      id="person"
      data-form-section="person"
      className="relative overflow-hidden rounded-lg border border-swatch-blue-soft bg-card shadow-xs transition-colors"
    >
      {/* Top 3px Sky-Blue to Emerald accent bar */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-swatch-blue"
      />

      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-swatch-blue-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-swatch-blue-soft bg-swatch-blue-soft text-swatch-blue-deep">
            <UserCheck className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span dir="ltr" className="rounded bg-swatch-blue-soft px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-swatch-blue-deep">
                02
              </span>
              <h3
                tabIndex={-1}
                className="text-sm font-semibold text-foreground outline-none"
              >
                {t.crmLeads.create.personalInformationTitle}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.crmLeads.create.contactDetailsSubtitle}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-swatch-green-soft bg-swatch-green-soft px-2.5 py-0.5 text-2xs font-semibold text-swatch-green-deep">
          <span className="size-1.5 rounded-full bg-swatch-green" aria-hidden="true" />
          {t.crmLeads.create.types.INDIVIDUAL} · B2C
        </span>
      </div>

      {/* Section Body — Contact Card matching LeadContactRow design */}
      <div className="@container p-4">
        <div className="flex flex-col gap-3.5 rounded-lg border border-swatch-blue-soft bg-swatch-blue-soft p-3.5 shadow-2xs transition-all">
          {/* Contact Card Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-swatch-blue text-xs font-semibold text-primary-foreground">
                #1
              </span>
              <span className="text-xs font-semibold text-foreground">
                {formatTemplate(t.crmLeads.create.contactHeading, { number: 1 })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-swatch-green-soft bg-swatch-green-soft px-2.5 py-1 text-xs font-semibold text-swatch-green-deep">
                <Star className="size-3 fill-current" aria-hidden="true" />
                {t.crmLeads.create.primaryContact}
              </span>
              <LeadFieldGuide field="firstName" />
            </div>
          </div>

          {/* Row 1: Title (2 cols), First Name (5 cols), Last Name (5 cols) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12 @min-[52rem]:grid-cols-12">
            {/* Honorific Title (2 cols) */}
            <div className="relative md:col-span-2 @min-[52rem]:col-span-2">
              <div className="absolute end-0 top-0">
                <LeadFieldGuide field="honorificTitle" align="start" />
              </div>
              <Field
                label={t.crmLeads.create.titleField}
                error={errors.honorificTitle}
                showLabel
              >
                <Select
                  value={honorific?.key ?? ""}
                  disabled={disabled}
                  onValueChange={(key) =>
                    onFieldChange(
                      "honorificTitle",
                      honorifics.find((option) => option.key === key)?.label ?? "",
                    )
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={t.crmLeads.create.titleField} />
                  </SelectTrigger>
                  <SelectContent>
                    {honorifics.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* First Name (5 cols) */}
            <div className="relative md:col-span-5 @min-[52rem]:col-span-5">
              <div className="absolute end-0 top-0 flex items-center gap-1">
                <span
                  dir="ltr"
                  className={cn(
                    "font-mono text-2xs tabular-nums",
                    form.firstName.length >= limits.firstName
                      ? "font-semibold text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  {form.firstName.length}/{limits.firstName}
                </span>
                <LeadFieldGuide field="firstName" />
              </div>
              <Field
                label={t.crmLeads.create.firstName}
                error={errors.firstName}
                required
                showLabel
              >
                <div className="relative flex items-center">
                  <User
                    className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    size="sm"
                    placeholder={t.crmLeads.create.firstName}
                    value={form.firstName}
                    maxLength={limits.firstName}
                    disabled={disabled}
                    onChange={(event) =>
                      onFieldChange("firstName", event.target.value)
                    }
                    onBlur={() => onBlur("firstName")}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>

            {/* Last Name (5 cols) */}
            <div className="relative md:col-span-5 @min-[52rem]:col-span-5">
              <div className="absolute end-0 top-0 flex items-center gap-1">
                <span
                  dir="ltr"
                  className={cn(
                    "font-mono text-2xs tabular-nums",
                    form.lastName.length >= limits.lastName
                      ? "font-semibold text-warning"
                      : "text-muted-foreground",
                  )}
                >
                  {form.lastName.length}/{limits.lastName}
                </span>
                <LeadFieldGuide field="lastName" />
              </div>
              <Field
                label={t.crmLeads.create.lastName}
                error={errors.lastName}
                showLabel
              >
                <Input
                  size="sm"
                  placeholder={t.crmLeads.create.lastName}
                  value={form.lastName}
                  maxLength={limits.lastName}
                  disabled={disabled}
                  onChange={(event) =>
                    onFieldChange("lastName", event.target.value)
                  }
                  onBlur={() => onBlur("lastName")}
                />
              </Field>
            </div>
          </div>

          {/* Row 2: Phone (6 cols) & Email (6 cols) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12 @min-[52rem]:grid-cols-12">
            {/* Phone / Mobile Numbers (6 cols) */}
            <div className="relative md:col-span-6 @min-[52rem]:col-span-6">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span dir="ltr" className="inline-flex items-center gap-1 rounded bg-swatch-blue-soft px-1.5 py-0.5 font-mono text-2xs font-semibold tabular-nums text-swatch-blue-deep">
                  <Phone className="size-2.5" aria-hidden="true" />
                  {form.phones.length}/{CRM_PHONE_LIST_MAX}
                </span>
                <LeadFieldGuide field="phones" />
              </div>
              <Field
                label={t.crmLeads.phone}
                error={errors["phones.0"]}
                showLabel
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <CrmPhoneNumberInput
                      value={form.phones[0] ?? ""}
                      maxLength={limits.phone}
                      label={t.crmLeads.phone}
                      placeholder={
                        t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber
                      }
                      disabled={disabled}
                      onChange={(next) => onPhoneChange(0, next)}
                      onBlur={() => onBlur("phones.0")}
                    />
                    {form.phones.length < CRM_PHONE_LIST_MAX && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        aria-label={t.crmShared.addPhone}
                        data-icon-button
                        onClick={onPhoneAdd}
                        className="size-7 shrink-0 rounded-full bg-swatch-green p-0 text-primary-foreground not-disabled:hover:bg-swatch-green/90"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  {extraPhones.map((phone, offset) => {
                    const index = offset + 1;
                    const rowPath = `phones.${index}`;
                    const rowError = errors[rowPath];
                    return (
                      <div key={rowPath} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <CrmPhoneNumberInput
                            value={phone}
                            maxLength={limits.phone}
                            label={formatTemplate(t.crmShared.phoneNumbered, {
                              number: index + 1,
                            })}
                            placeholder={
                              t.crmShared.enterPhoneNumber ??
                              t.crmShared.phoneNumber
                            }
                            disabled={disabled}
                            onChange={(next) => onPhoneChange(index, next)}
                            onBlur={() => onBlur(rowPath)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            aria-label={formatTemplate(t.crmShared.removePhone, {
                              number: index + 1,
                            })}
                            data-icon-button
                            onClick={() => onPhoneRemove(index)}
                            className="size-7 shrink-0 rounded-full p-0"
                          >
                            <Trash2
                              className="size-3.5 text-destructive"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                        {rowError && (
                          <p className="text-xs text-destructive">{rowError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>
            </div>

            {/* Email Address (6 cols) */}
            <div className="relative md:col-span-6 @min-[52rem]:col-span-6">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                {isEmailValid && (
                  <span className="inline-flex items-center gap-1 rounded bg-swatch-green-soft px-1.5 py-0.5 text-2xs font-semibold text-swatch-green-deep">
                    <CheckCircle2 className="size-2.5" aria-hidden="true" />
                    Valid
                  </span>
                )}
                <span dir="ltr" className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {form.email.length}/{limits.email}
                </span>
                <LeadFieldGuide field="email" />
              </div>
              <Field
                label={t.crmLeads.email}
                error={errors.email}
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
                    placeholder={t.crmLeads.email}
                    value={form.email}
                    maxLength={limits.email}
                    disabled={disabled}
                    onChange={(event) =>
                      onFieldChange("email", event.target.value)
                    }
                    onBlur={() => onBlur("email")}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
