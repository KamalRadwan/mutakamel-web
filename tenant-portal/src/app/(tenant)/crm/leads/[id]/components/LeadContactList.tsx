"use client";

import type { ReactNode } from "react";
import { Pencil, Star } from "lucide-react";
import { Badge, Button, cn, useFieldControl } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import type { LeadContact } from "../../lead-contract";
import { LeadPhoneActionsRow } from "../../components/LeadPhoneActionsRow";

export function LeadContactList({
  contacts,
  country,
  onEdit,
  onSetPrimary,
}: {
  contacts: LeadContact[];
  /** The lead's country, which completes a national number for WhatsApp and Telegram. */
  country?: string;
  onEdit?: (contact: LeadContact) => void;
  onSetPrimary?: (contact: LeadContact) => void;
}) {
  return contacts.map((contact) => (
    <LeadContactReadCard
      key={contact.partyId}
      name={contact.displayName}
      jobTitle={contact.jobTitle}
      phones={contact.phones}
      email={contact.email}
      country={country}
      isPrimary={contact.isPrimary}
      onEdit={onEdit ? () => onEdit(contact) : undefined}
      onSetPrimary={
        onSetPrimary && !contact.isPrimary ? () => onSetPrimary(contact) : undefined
      }
    />
  ));
}

function getContactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** Only the full name and three ways to identify/reach this person, never company data. */
export function LeadContactReadCard({
  name,
  jobTitle,
  phones,
  email,
  country,
  isPrimary,
  onEdit,
  onSetPrimary,
}: {
  name: string;
  jobTitle: string | null;
  phones: string[];
  email: string | null;
  country?: string;
  isPrimary?: boolean;
  onEdit?: () => void;
  onSetPrimary?: () => void;
}) {
  const { t, lang } = useI18n();
  const initials = getContactInitials(name);
  return (
    <div
      className={cn(
        "dossier-contact-card min-w-0",
        isPrimary && "primary",
      )}
    >
      <LeadContactFields
        fields={[
          {
            label: t.crmLeadDetail.fullName,
            span2: true,
            value: (
              <span className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2 font-bold text-foreground">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white shadow-2xs",
                      isPrimary
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-cyan-500 to-indigo-600",
                    )}
                  >
                    {initials}
                  </span>
                  <span className="wrap-anywhere text-[13px] font-extrabold text-foreground">
                    {name}
                  </span>
                  {isPrimary && (
                    <Badge tone="positive" className="dossier-badge-primary gap-1">
                      <Star className="size-3 fill-current" aria-hidden="true" />
                      {t.crmLeadDetail.primaryContact}
                    </Badge>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {!isPrimary && onSetPrimary && (
                    <button
                      type="button"
                      className="dossier-btn dossier-btn-sm"
                      onClick={onSetPrimary}
                    >
                      ★ {lang === "ar" ? "تعيين كرئيسي" : "Set Primary"}
                    </button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="dossier-btn dossier-btn-sm shrink-0"
                      aria-label={t.crmLeadDetail.editContact + ": " + name}
                      title={t.crmLeadDetail.editContact}
                      onClick={onEdit}
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                      <span>{t.crmTags.edit}</span>
                    </Button>
                  )}
                </span>
              </span>
            ),
          },
          {
            label: t.crmLeadConvert.contactJobTitle,
            value: jobTitle ? (
              <span className="inline-flex items-center rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-200">
                {jobTitle}
              </span>
            ) : null,
          },
          {
            label: t.crmLeads.phone,
            span2: true,
            orderClass: "order-4",
            value:
              phones.length > 0 ? (
                <div className="dossier-phone-box-view flex min-w-0 flex-col gap-1.5 p-2.5">
                  <div className="dossier-phone-box-header">
                    <span className="dossier-phone-box-title">
                      📞 {t.crmLeads.phone} ({phones.length})
                    </span>
                  </div>
                  <div className="dossier-phone-list">
                    {phones.map((phone, index) => (
                      <LeadPhoneActionsRow
                        key={phone}
                        phone={phone}
                        country={country}
                        badge={
                          index === 0
                            ? t.crmLeads.phone
                            : `#${index + 1}`
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null,
          },
          {
            label: t.crmLeads.email,
            orderClass: "order-3",
            value: email ? (
              <a
                dir="ltr"
                href={"mailto:" + email}
                className="dossier-field-link wrap-anywhere font-medium"
              >
                {email}
              </a>
            ) : null,
          },
        ]}
      />
    </div>
  );
}

export function LeadContactFields({
  fields,
}: {
  fields: Array<{
    label: string;
    value: ReactNode;
    span2?: boolean;
    orderClass?: string;
  }>;
}) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {fields.map(({ label, value, span2, orderClass }) => (
        <div
          key={label}
          className={cn(
            "dossier-field-box min-w-0",
            span2 && "sm:col-span-2",
            orderClass,
          )}
        >
          <dt className="dossier-field-label">{label}</dt>
          <dd className="dossier-field-val mt-0.5 min-w-0 wrap-anywhere text-xs text-foreground">
            {value || (
              <span className="dossier-field-empty">
                {t.detail.notRecorded}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Stored Honorific Title dropdown (`Mr / السيد`, `Ms / الآنسة`, `Mrs / السيدة`,
 * `Dr / الدكتور`, `Eng / المهندس`) that claims the enclosing `<Field>` label.
 */
export function HonorificSelect({
  value,
  disabled,
  readOnly,
  placeholder,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const { lang } = useI18n();
  const field = useFieldControl({ readOnly }, { nativeReadOnly: true });
  const options = getHonorificOptions(lang);
  const matched = findHonorific(value, lang);
  const hasCurrentOption = !value || options.some((opt) => opt.label === value);

  return (
    <select
      {...field}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        if (readOnly) return;
        onChange(event.target.value);
      }}
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground shadow-2xs transition-colors focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        readOnly && "bg-muted/50 text-muted-foreground",
      )}
    >
      <option value="">{placeholder ?? "—"}</option>
      {!hasCurrentOption && <option value={value}>{value}</option>}
      {options.map((opt) => (
        <option key={opt.key} value={opt.label}>
          {opt.label}
        </option>
      ))}
      {matched && matched.label !== value && (
        <option value={matched.label}>{matched.label}</option>
      )}
    </select>
  );
}

