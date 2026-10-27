"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { Language } from "@/i18n/useLanguage";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  parseCustomerProfileDetailResponse,
  type CustomerProfileAddress,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";

export interface CustomerCompanyCardProps {
  profile: CustomerProfileDetail;
  onEdit?: () => void;
  onSaved?: (next: CustomerProfileDetail) => void;
  onReconcile?: () => void;
  readOnly: boolean;
}

function formatFullLegalAddress(
  address: CustomerProfileAddress | null,
): string | null {
  if (!address) return null;
  const parts = [
    address.street,
    address.area,
    address.city,
    address.country,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function CustomerCompanyCard({
  profile,
  onEdit,
  onSaved,
  onReconcile,
  readOnly,
}: CustomerCompanyCardProps) {
  const { t, lang } = useI18n();
  const describeError = useCrmErrorText();
  const detail = t.crmLeadDetail;
  const actions = t.crmCustomerProfileActions;
  const emptyLabel = t.detail.notRecorded;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    companyName: profile.companyName ?? profile.displayName,
    legalName: profile.legalName ?? "",
    taxNumber: profile.taxNumber ?? "",
    commercialRegistrationNumber: profile.commercialRegistrationNumber ?? "",
    companyEmail: profile.companyEmail ?? profile.email ?? "",
    companyWebsite: profile.companyWebsite ?? "",
    phones:
      profile.phones.length > 0
        ? [...profile.phones]
        : profile.companyPhone
          ? [profile.companyPhone]
          : [""],
  });

  if (profile.profileType !== "CORPORATE") return null;

  const companyEmail = profile.companyEmail ?? profile.email;
  const companyPhones =
    profile.phones.length > 0
      ? profile.phones
      : profile.companyPhone
        ? [profile.companyPhone]
        : [];
  const fullLegalAddress = formatFullLegalAddress(profile.address);

  const read = (value: string | null, dir?: "ltr") => (
    <ReadValue value={value} dir={dir} emptyLabel={emptyLabel} />
  );

  const handleStartEdit = () => {
    onEdit?.();
    if (onSaved) {
      setDraft({
        companyName: profile.companyName ?? profile.displayName,
        legalName: profile.legalName ?? "",
        taxNumber: profile.taxNumber ?? "",
        commercialRegistrationNumber:
          profile.commercialRegistrationNumber ?? "",
        companyEmail: profile.companyEmail ?? profile.email ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        phones:
          profile.phones.length > 0
            ? [...profile.phones]
            : profile.companyPhone
               ? [profile.companyPhone]
              : [""],
      });
      setErrorMsg(null);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!onSaved || saving || !draft.companyName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const cleanPhones = draft.phones
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      const body: Record<string, unknown> = {
        displayName: draft.companyName.trim(),
        companyName: draft.companyName.trim(),
        taxNumber: draft.taxNumber.trim(),
        commercialRegistrationNumber:
          draft.commercialRegistrationNumber.trim(),
        ...(draft.companyEmail.trim()
          ? { companyEmail: draft.companyEmail.trim() }
          : {}),
        ...(draft.companyWebsite.trim()
          ? { companyWebsite: draft.companyWebsite.trim() }
          : {}),
        companyPhones: cleanPhones,
      };

      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: customerProfilePath(profile.id),
        body,
        parse: parseCustomerProfileDetailResponse,
        config: { maxResponseBytes: 512 * 1024 },
      });

      if (outcome.kind === "success") {
        onSaved(outcome.value);
        setIsEditing(false);
      } else {
        setErrorMsg(
          describeError(outcome.error) ?? t.crmCustomerProfiles.cardUpdateFailed,
        );
        if (
          outcome.kind === "ambiguous" ||
          outcome.kind === "applied_unreadable"
        ) {
          setIsEditing(false);
          onReconcile?.();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Card
        role="dialog"
        aria-label={detail.editCompany}
        className="dossier-card dossier-card-indigo dossier-card-editing"
      >
        <CardHeader className="dossier-card-head dossier-card-header-editing-indigo flex-row items-center justify-between gap-2">
          <div className="dossier-card-title">
            <span
              className="dossier-icon-pill dossier-ip-indigo"
              aria-hidden="true"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </span>
            <CardTitle className="text-xs font-semibold tracking-wider text-swatch-indigo-deep uppercase">
              {detail.editCompany}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={saving}
              onClick={() => setIsEditing(false)}
              aria-label={t.common.cancel}
              className="dossier-btn-cancel"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span>{t.common.cancel}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={saving || !draft.companyName.trim()}
              onClick={() => void handleSave()}
              aria-label={detail.saveCompany}
              className="dossier-btn-save"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-3.5" aria-hidden="true" />
              )}
              <span>{detail.saveCompany}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="dossier-card-body flex flex-col gap-3">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
            >
              {errorMsg}
            </div>
          )}

          {/* Split Phone Edit Panel */}
          <div className="dossier-phone-box-edit mb-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="dossier-phone-box-label">
                📞 {detail.companyPhones}
              </span>
              {draft.phones.length < 5 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setDraft((d) => ({ ...d, phones: [...d.phones, ""] }))
                  }
                  className="dossier-btn-action dossier-btn-action-emerald"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  <span>{t.crmCustomerProfiles.ui.companyCard.add_phone}</span>
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {draft.phones.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    size="sm"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        phones: d.phones.map((p, i) =>
                          i === idx ? e.target.value : p,
                        ),
                      }))
                    }
                    placeholder="+966..."
                    className="flex-1 font-mono"
                  />
                  {draft.phones.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={saving}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          phones: d.phones.filter((_, i) => i !== idx),
                        }))
                      }
                      className="inline-flex size-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="dossier-phone-hint">
              {t.crmCustomerProfiles.ui.companyCard.phone_hint}
            </p>
          </div>

          {/* 2-Column Company Fields Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="dossier-field-box">
              <Field label={t.crmLeads.companyName} required>
                <Input
                  size="sm"
                  value={draft.companyName}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyName: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="dossier-field-box">
              <Field label={detail.companyEmail}>
                <Input
                  size="sm"
                  type="email"
                  dir="ltr"
                  value={draft.companyEmail}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyEmail: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="dossier-field-box">
              <Field label={actions.taxNumber}>
                <Input
                  size="sm"
                  dir="ltr"
                  value={draft.taxNumber}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, taxNumber: e.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="dossier-field-box">
              <Field label={actions.commercialRegistration}>
                <Input
                  size="sm"
                  dir="ltr"
                  value={draft.commercialRegistrationNumber}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      commercialRegistrationNumber: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <div className="dossier-field-box sm:col-span-2">
              <Field label={detail.companyWebsite}>
                <Input
                  size="sm"
                  type="url"
                  dir="ltr"
                  placeholder="https://..."
                  value={draft.companyWebsite}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyWebsite: e.target.value }))
                  }
                />
              </Field>
            </div>
          </div>

          <div className="dossier-address-edit-box">
            <Field
              label={t.crmLeads.create.sections.address}
              hint={actions.addressReadOnly}
              readOnly
              showLabel
            >
              <Input
                size="sm"
                value={fullLegalAddress ?? ""}
                readOnly
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fields: Array<{
    label: string;
    value: React.ReactNode;
    labelClassName?: string;
    fullWidth?: boolean;
  }> = [
    {
      label: t.crmLeads.companyName,
      value: read(profile.companyName || profile.displayName),
    },
    ...(profile.legalName
      ? [{ label: actions.legalName, value: read(profile.legalName) }]
      : []),
    {
      label: detail.companyEmail,
      value: (
        <span className="flex items-center gap-1.5">
          {read(companyEmail, "ltr")}
          {companyEmail && (
            <Button variant="ghost" size="xs" asChild>
              <a
                href={`mailto:${companyEmail}`}
                aria-label={detail.sendEmail}
                title={detail.sendEmail}
              >
                <Mail
                  className="size-3.5 text-swatch-indigo"
                  aria-hidden="true"
                />
              </a>
            </Button>
          )}
        </span>
      ),
    },
    { label: actions.taxNumber, value: read(profile.taxNumber, "ltr") },
    {
      label: actions.commercialRegistration,
      labelClassName: "whitespace-nowrap",
      value: read(profile.commercialRegistrationNumber, "ltr"),
    },
    {
      label: detail.companyWebsite,
      value: profile.companyWebsite ? (
        <a
          href={
            profile.companyWebsite.startsWith("http")
              ? profile.companyWebsite
              : `https://${profile.companyWebsite}`
          }
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="inline-flex items-center gap-1 text-swatch-indigo underline-offset-2 hover:underline"
        >
          <span>{profile.companyWebsite}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <EmptyValue label={emptyLabel} />
      ),
    },
    {
      label: detail.location,
      value: (
        <CustomerCompanyLocation
          address={profile.address}
          lang={lang}
          emptyLabel={emptyLabel}
        />
      ),
    },
    {
      label: t.crmCustomerProfiles.ui.companyCard.full_legal_address,
      fullWidth: true,
      value: read(fullLegalAddress),
    },
  ];

  return (
    <Card
      aria-label={detail.companyTitle}
      className="dossier-card dossier-card-indigo"
    >
      <CardHeader className="dossier-card-head flex-row items-center justify-between gap-2">
        <div className="dossier-card-title">
          <span
            className="dossier-icon-pill dossier-ip-indigo"
            aria-hidden="true"
          >
            <Building2 className="size-3.5" aria-hidden="true" />
          </span>
          <CardTitle className="text-xs font-semibold tracking-wider uppercase">
            {detail.companyTitle}
          </CardTitle>
          <span className="dossier-badge dossier-badge-corporate">
            {t.crmCustomerProfiles.profileTypes.CORPORATE}
          </span>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="dossier-btn-action"
            aria-label={detail.editCompany}
            title={detail.editCompany}
            onClick={handleStartEdit}
          >
            <Pencil className="size-3" aria-hidden="true" />
            <span>{detail.editCompany}</span>
          </Button>
        ) : (
          <span className="dossier-badge dossier-badge-converted">
            🔒 {t.crmCustomerProfiles.ui.companyCard.read_only}
          </span>
        )}
      </CardHeader>

      <CardContent className="dossier-card-body">
        {/* Highlighted Emerald-Cyan Company Phones Box (View Mode) */}
        <div className="dossier-phone-box-view">
          <div className="dossier-phone-box-head">
            <span className="dossier-phone-box-label">
              📞 {detail.companyPhones}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleStartEdit}
                className="dossier-btn-action dossier-btn-action-emerald"
              >
                <Pencil className="size-3" aria-hidden="true" />
                <span>
                  {t.crmCustomerProfiles.ui.companyCard.edit_phones_code_number}
                </span>
              </Button>
            )}
          </div>
          {companyPhones.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {companyPhones.map((phone, index) => (
                <CustomerPhoneActionsRow
                  key={`${phone}-${index}`}
                  phone={phone}
                  country={profile.address?.country ?? undefined}
                  badge={
                    index === 0
                      ? t.crmCustomerProfiles.ui.companyCard.primary_phone
                      : t.crmCustomerProfiles.ui.companyCard.secondary
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyValue label={emptyLabel} />
          )}
        </div>

        {/* 2-Column Boxed Company Fields Grid */}
        <dl className="dossier-grid-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-2.5 sm:grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1fr)]">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn(
                "dossier-field-box flex flex-col justify-center",
                field.fullWidth && "dossier-span-all",
              )}
            >
              <dt
                className={cn(
                  "dossier-field-label text-xs text-muted-foreground",
                  field.labelClassName,
                )}
              >
                {field.label}
              </dt>
              <dd className="dossier-field-val min-w-0 text-xs font-semibold text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function ReadValue({
  value,
  dir,
  emptyLabel,
}: {
  value: string | null;
  dir?: "ltr";
  emptyLabel: string;
}) {
  if (!value) return <EmptyValue label={emptyLabel} />;
  return (
    <span
      className="flex min-h-(--size-control-xs) items-center wrap-anywhere"
      dir={dir}
    >
      {value}
    </span>
  );
}

function EmptyValue({ label }: { label: string }) {
  return (
    <span className="flex min-h-(--size-control-xs) items-center text-muted-foreground">
      {label}
    </span>
  );
}

function CustomerCompanyLocation({
  address,
  lang,
  emptyLabel,
}: {
  address: CustomerProfileAddress | null;
  lang: Language;
  emptyLabel: string;
}) {
  if (!address) return <EmptyValue label={emptyLabel} />;
  const storedCountry = address.country?.trim() ?? "";
  const isoCode = storedCountry
    ? /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
      ? storedCountry.toUpperCase()
      : countryIsoFromName(storedCountry)
    : null;
  const country = isoCode
    ? getCountryOptions(lang).find((option) => option.isoCode === isoCode)
    : undefined;
  const parts = [country?.name ?? address.country, address.city].filter(
    (part): part is string => Boolean(part),
  );
  if (parts.length === 0) return <EmptyValue label={emptyLabel} />;
  return (
    <span className="flex min-h-(--size-control-xs) items-center gap-1">
      {country && (
        <span aria-hidden="true" className="text-sm leading-none">
          {country.flag}
        </span>
      )}
      <span>{parts.join(" / ")}</span>
    </span>
  );
}

