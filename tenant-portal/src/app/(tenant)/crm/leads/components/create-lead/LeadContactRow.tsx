"use client";

import { useEffect, useRef } from "react";
import {
  Briefcase,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Plus,
  Star,
  Trash2,
  User,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Label,
  RadioGroupItem,
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
import { CrmJobTitleField } from "../../../shared/components/CrmJobTitleField";
import { CRM_PHONE_LIST_MAX } from "../../../shared/components/CrmPhoneListField";
import { CrmPhoneNumberInput } from "../../../shared/components/CrmPhoneNumberInput";
import type { CrmFormErrors } from "../../../shared/hooks/useCrmCreateForm";
import type { LeadCompanyContactOption } from "../../lead-contract";
import { LEAD_CREATE_LIMITS, type LeadContactForm } from "../../lead-create-contract";
import { LeadFieldGuide } from "./LeadFieldGuide";

const NEW_CONTACT_VALUE = "__new_contact__";

interface LeadContactRowProps {
  index: number;
  contact: LeadContactForm;
  isPrimary: boolean;
  canRemove: boolean;
  existingCompany: boolean;
  directoryContacts: readonly LeadCompanyContactOption[];
  takenContactPartyIds: ReadonlySet<string>;
  isLoadingContacts: boolean;
  errors: CrmFormErrors;
  disabled: boolean;
  onChange: (patch: Partial<Omit<LeadContactForm, "key">>) => void;
  onPhoneChange: (phoneIndex: number, value: string) => void;
  onPhoneAdd: () => void;
  onPhoneRemove: (phoneIndex: number) => void;
  onRemove: () => void;
  onBlur: (path: string) => void;
}

/**
 * A single corporate contact person card inside `LeadContactsSection`.
 *
 * Supports both newly typed contacts and directory-linked contacts (when an
 * existing company is selected), with searchable 100+ job titles, E.164 phone
 * list, primary contact radio pill, and `!` field guides on every control.
 */
export function LeadContactRow({
  index,
  contact,
  isPrimary,
  canRemove,
  existingCompany,
  directoryContacts,
  takenContactPartyIds,
  isLoadingContacts,
  errors,
  disabled,
  onChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onRemove,
  onBlur,
}: LeadContactRowProps) {
  const { t, lang } = useI18n();
  const limits = LEAD_CREATE_LIMITS;
  const path = `contacts.${index}`;
  const primaryId = `lead-contact-primary-${contact.key}`;
  const directoryOwned = contact.contactPartyId.trim().length > 0;
  const honorifics = getHonorificOptions(lang);
  const honorific = findHonorific(contact.honorificTitle, lang);
  const extraPhones = contact.phones.slice(1);

  // Seed default honorific once for a new contact row
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || directoryOwned) return;
    seededRef.current = true;
    if (contact.honorificTitle.trim().length > 0) return;
    const [first] = honorifics;
    if (first) queueMicrotask(() => onChange({ honorificTitle: first.label }));
  }, [contact.honorificTitle, directoryOwned, honorifics, onChange]);

  const availableDirectoryContacts = directoryContacts.filter(
    (option) =>
      option.partyId === contact.contactPartyId ||
      !takenContactPartyIds.has(option.partyId),
  );

  function handleDirectoryContactChange(value: string) {
    if (value === NEW_CONTACT_VALUE) {
      onChange({
        contactPartyId: "",
        fullName: "",
        firstName: "",
        lastName: "",
        jobTitle: "",
        email: "",
        phones: [""],
      });
      return;
    }
    const chosen = directoryContacts.find((item) => item.partyId === value);
    if (!chosen) return;
    onChange({
      contactPartyId: chosen.partyId,
      fullName: chosen.displayName,
      firstName: "",
      lastName: "",
      jobTitle: chosen.jobTitle ?? "",
      email: chosen.primaryEmail ?? "",
      phones: chosen.phones.length > 0 ? [...chosen.phones] : [""],
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-lg border p-3.5 transition-all",
        isPrimary
          ? "border-primary/35 bg-primary/5 shadow-2xs"
          : "border-border bg-card",
      )}
    >
      {/* Contact Card Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold",
              isPrimary
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            #{index + 1}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {formatTemplate(t.crmLeads.create.contactHeading, {
              number: index + 1,
            })}
          </span>
          {directoryOwned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
              <Lock className="size-2.5" aria-hidden="true" />
              Directory
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Primary Contact Radio + Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
              isPrimary
                ? "border-success/40 bg-success-subtle text-success-subtle-foreground"
                : "border-border bg-muted/50 text-muted-foreground",
            )}
          >
            <RadioGroupItem
              value={contact.key}
              id={primaryId}
              disabled={disabled}
            />
            <Label
              htmlFor={primaryId}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold"
            >
              {isPrimary && (
                <Star className="size-3 fill-current" aria-hidden="true" />
              )}
              {t.crmLeads.create.primaryContact}
            </Label>
          </div>
          <LeadFieldGuide field="contactPrimary" />

          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={formatTemplate(t.crmLeads.create.removeContact, {
                number: index + 1,
              })}
              onClick={onRemove}
              className="size-7 rounded-full p-0 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Existing Directory Contact Selector (only when an existing directory company is selected) */}
      {existingCompany && (
        <div className="relative rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <div className="absolute end-2.5 top-2.5 flex items-center gap-1.5">
            <LeadFieldGuide field="contactPartyId" />
          </div>
          <Field
            label={t.crmLeads.existingContact}
            error={errors[`${path}.contactPartyId`]}
            showLabel
          >
            <Select
              value={contact.contactPartyId || NEW_CONTACT_VALUE}
              disabled={disabled || isLoadingContacts}
              onValueChange={handleDirectoryContactChange}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={t.crmLeads.newContact} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CONTACT_VALUE}>
                  {t.crmLeads.newContact}
                </SelectItem>
                {availableDirectoryContacts.map((option) => (
                  <SelectItem key={option.partyId} value={option.partyId}>
                    {option.displayName}
                    {option.jobTitle ? ` — ${option.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      {/* Contact Fields Grid */}
      {directoryOwned ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <div className="absolute end-0 top-0 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded bg-success-subtle px-1.5 py-0.5 text-xs font-semibold text-success-subtle-foreground">
                <CheckCircle2 className="size-2.5" aria-hidden="true" />
                Locked
              </span>
            </div>
            <Field
              label={t.crmLeads.contactName}
              hint={t.crmLeads.create.existingContactLocked}
              readOnly
              showLabel
            >
              <Input
                size="sm"
                value={contact.fullName}
                placeholder={t.crmLeads.contactName}
                disabled
              />
            </Field>
          </div>

          <div className="relative md:col-span-6">
            <div className="absolute end-0 top-0 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                <Briefcase className="size-2.5" aria-hidden="true" />
                100+
              </span>
              <LeadFieldGuide field="contactJobTitle" />
            </div>
            <Field
              label={t.crmLeads.create.contactJobTitle}
              error={errors[`${path}.jobTitle`]}
              showLabel
            >
              <CrmJobTitleField
                value={contact.jobTitle}
                disabled={disabled}
                onChange={(next) => onChange({ jobTitle: next })}
                onBlur={() => onBlur(`${path}.jobTitle`)}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Row 1: Honorific (2 cols), First Name (3 cols), Last Name (3 cols), Job Title (4 cols) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
            <div className="relative md:col-span-2">
              <div className="absolute end-0 top-0">
                <LeadFieldGuide field="honorificTitle" align="start" />
              </div>
              <Field
                label={t.crmLeads.create.titleField}
                error={errors[`${path}.honorificTitle`]}
                showLabel
              >
                <Select
                  value={honorific?.key ?? ""}
                  disabled={disabled}
                  onValueChange={(key) =>
                    onChange({
                      honorificTitle:
                        honorifics.find((option) => option.key === key)?.label ??
                        "",
                    })
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

            <div className="relative md:col-span-3">
              <div className="absolute end-0 top-0 flex items-center gap-1">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {contact.firstName.length}/{limits.firstName}
                </span>
                <LeadFieldGuide field="contactFirstName" />
              </div>
              <Field
                label={t.crmLeads.create.firstName}
                error={errors[`${path}.firstName`]}
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
                    value={contact.firstName}
                    maxLength={limits.firstName}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({ firstName: event.target.value })
                    }
                    onBlur={() => onBlur(`${path}.firstName`)}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>

            <div className="relative md:col-span-3">
              <div className="absolute end-0 top-0 flex items-center gap-1">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {contact.lastName.length}/{limits.lastName}
                </span>
                <LeadFieldGuide field="contactLastName" />
              </div>
              <Field
                label={t.crmLeads.create.lastName}
                error={errors[`${path}.lastName`]}
                showLabel
              >
                <Input
                  size="sm"
                  placeholder={t.crmLeads.create.lastName}
                  value={contact.lastName}
                  maxLength={limits.lastName}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ lastName: event.target.value })
                  }
                  onBlur={() => onBlur(`${path}.lastName`)}
                />
              </Field>
            </div>

            <div className="relative md:col-span-4">
              <div className="absolute end-0 top-0 flex items-center gap-1">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  100+ Titles
                </span>
                <LeadFieldGuide field="contactJobTitle" />
              </div>
              <Field
                label={t.crmLeads.create.contactJobTitle}
                error={errors[`${path}.jobTitle`]}
                showLabel
              >
                <CrmJobTitleField
                  value={contact.jobTitle}
                  disabled={disabled}
                  onChange={(next) => onChange({ jobTitle: next })}
                  onBlur={() => onBlur(`${path}.jobTitle`)}
                />
              </Field>
            </div>
          </div>

          {/* Row 2: Direct Phone Numbers (6 cols) & Work Email (6 cols) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                  <Phone className="size-2.5" aria-hidden="true" />
                  {contact.phones.length}/{CRM_PHONE_LIST_MAX}
                </span>
                <LeadFieldGuide field="contactPhones" />
              </div>
              <Field
                label={t.crmLeads.phone}
                error={errors[`${path}.phones.0`]}
                required={isPrimary}
                showLabel
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <CrmPhoneNumberInput
                      value={contact.phones[0] ?? ""}
                      maxLength={limits.phone}
                      label={t.crmLeads.phone}
                      placeholder={
                        t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber
                      }
                      disabled={disabled}
                      onChange={(next) => onPhoneChange(0, next)}
                      onBlur={() => onBlur(`${path}.phones.0`)}
                    />
                    {contact.phones.length < CRM_PHONE_LIST_MAX && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        aria-label={t.crmShared.addPhone}
                        data-icon-button
                        onClick={onPhoneAdd}
                        className="size-7 shrink-0 rounded-full bg-primary p-0 text-primary-foreground not-disabled:hover:bg-primary/90"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  {extraPhones.map((phone, offset) => {
                    const phoneIndex = offset + 1;
                    const rowPath = `${path}.phones.${phoneIndex}`;
                    const rowError = errors[rowPath];
                    return (
                      <div key={rowPath} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <CrmPhoneNumberInput
                            value={phone}
                            maxLength={limits.phone}
                            label={formatTemplate(t.crmShared.phoneNumbered, {
                              number: phoneIndex + 1,
                            })}
                            placeholder={
                              t.crmShared.enterPhoneNumber ??
                              t.crmShared.phoneNumber
                            }
                            disabled={disabled}
                            onChange={(next) => onPhoneChange(phoneIndex, next)}
                            onBlur={() => onBlur(rowPath)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            aria-label={formatTemplate(t.crmShared.removePhone, {
                              number: phoneIndex + 1,
                            })}
                            data-icon-button
                            onClick={() => onPhoneRemove(phoneIndex)}
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

            <div className="relative md:col-span-6">
              <div className="absolute end-0 top-0 flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {contact.email.length}/{limits.email}
                </span>
                <LeadFieldGuide field="contactEmail" />
              </div>
              <Field
                label={t.crmLeads.email}
                error={errors[`${path}.email`]}
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
                    value={contact.email}
                    maxLength={limits.email}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({ email: event.target.value })
                    }
                    onBlur={() => onBlur(`${path}.email`)}
                    className="ps-8"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
