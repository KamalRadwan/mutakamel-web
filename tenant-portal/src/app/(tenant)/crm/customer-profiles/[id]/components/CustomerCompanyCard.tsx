"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Globe,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn, focusRing } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { countryIsoFromName, getCountryOptions } from "@/lib/geo/country-data";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";
import {
  parseCustomerProfileDetailResponse,
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

export function CustomerCompanyCard({
  profile,
  onEdit,
  onSaved,
  onReconcile,
  readOnly,
}: CustomerCompanyCardProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const detail = t.crmLeadDetail;
  const actions = t.crmCustomerProfileActions;
  const unavailable = t.crmCustomerProfiles.unavailable;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    companyName: profile.companyName ?? profile.displayName,
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

  const countryOptions = getCountryOptions(lang);
  const storedCountry = profile.address?.country?.trim() ?? "";
  const iso = /^[A-Z]{2}$/u.test(storedCountry.toUpperCase())
    ? storedCountry.toUpperCase()
    : countryIsoFromName(storedCountry);
  const countryMatch = iso
    ? countryOptions.find((option) => option.isoCode === iso)
    : undefined;
  const countryDisplay = countryMatch
    ? `${countryMatch.flag} ${countryMatch.name}`
    : storedCountry;

  const companyEmail = profile.companyEmail ?? profile.email;
  const companyPhones =
    profile.phones.length > 0
      ? profile.phones
      : profile.companyPhone
        ? [profile.companyPhone]
        : [];

  const handleStartEdit = () => {
    onEdit?.();
    if (onSaved) {
      setDraft({
        companyName: profile.companyName ?? profile.displayName,
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
          outcome.error.message ?? t.crmCustomerProfiles.cardUpdateFailed,
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

  return (
    <section
      aria-label={detail.companyTitle}
      className="dossier-card dossier-card-indigo"
    >
      <div className="dossier-card-header">
        <div className="dossier-card-title-group">
          <div className="dossier-card-icon">
            <Building2 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="dossier-card-title">{detail.companyTitle}</h3>
            <p className="dossier-card-subtitle">
              {isAr
                ? "الهوية القانونية والسجل الضريبي وقنوات الشركة"
                : "Legal identity, tax registration & corporate channels"}
            </p>
          </div>
        </div>

        {!readOnly && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            aria-label={detail.editCompany}
            title={detail.editCompany}
            className="dossier-edit-btn"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            <span>{t.crmTags.edit}</span>
          </button>
        )}
      </div>

      <div className="dossier-card-body space-y-4">
        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.03] p-3.5">
            {errorMsg && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
              >
                {errorMsg}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  {t.crmCustomerProfiles.company} *
                </label>
                <input
                  type="text"
                  value={draft.companyName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyName: e.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  {actions.taxNumber}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.taxNumber}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, taxNumber: e.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 font-mono text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  {actions.commercialRegistration}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.commercialRegistrationNumber}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      commercialRegistrationNumber: e.target.value,
                    }))
                  }
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 font-mono text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  {t.crmCustomerProfiles.create.companyEmail}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={draft.companyEmail}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyEmail: e.target.value }))
                  }
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  {t.crmCustomerProfiles.create.companyWebsite}
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={draft.companyWebsite}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, companyWebsite: e.target.value }))
                  }
                  placeholder="https://..."
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Company Phones Editor */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {detail.companyPhones}
                </span>
                {draft.phones.length < 5 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, phones: [...d.phones, ""] }))
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Plus className="size-3" />
                    {isAr ? "إضافة رقم" : "Add phone"}
                  </button>
                )}
              </div>
              {draft.phones.map((phone, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        phones: d.phones.map((p, i) =>
                          i === idx ? e.target.value : p,
                        ),
                      }))
                    }
                    placeholder="+966..."
                    className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 font-mono text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                  />
                  {draft.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          phones: d.phones.filter((_, i) => i !== idx),
                        }))
                      }
                      className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-2.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving || !draft.companyName.trim()}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {t.common.save}
              </button>
            </div>
          </div>
        ) : (
          <>
            <dl className="dossier-field-grid">
              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {t.crmCustomerProfiles.company}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !profile.companyName && "dossier-field-empty",
                  )}
                >
                  {profile.companyName || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">{actions.legalName}</dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !profile.legalName && "dossier-field-empty",
                  )}
                >
                  {profile.legalName || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">{actions.taxNumber}</dt>
                <dd
                  className={cn(
                    "dossier-field-value font-mono",
                    !profile.taxNumber && "dossier-field-empty",
                  )}
                  dir="ltr"
                >
                  {profile.taxNumber || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {actions.commercialRegistration}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value font-mono",
                    !profile.commercialRegistrationNumber &&
                      "dossier-field-empty",
                  )}
                  dir="ltr"
                >
                  {profile.commercialRegistrationNumber || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {t.crmLeads.create.country}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !countryDisplay && "dossier-field-empty",
                  )}
                >
                  {countryDisplay || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {t.crmLeads.create.city}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !profile.address?.city && "dossier-field-empty",
                  )}
                >
                  {profile.address?.city || unavailable}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {t.crmCustomerProfiles.create.companyWebsite}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !profile.companyWebsite && "dossier-field-empty",
                  )}
                >
                  {profile.companyWebsite ? (
                    <a
                      href={profile.companyWebsite}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                      className={cn(
                        "inline-flex items-center gap-1.5 text-primary hover:underline",
                        focusRing,
                      )}
                    >
                      <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{profile.companyWebsite}</span>
                    </a>
                  ) : (
                    unavailable
                  )}
                </dd>
              </div>

              <div className="dossier-field">
                <dt className="dossier-field-label">
                  {t.crmCustomerProfiles.create.companyEmail}
                </dt>
                <dd
                  className={cn(
                    "dossier-field-value",
                    !companyEmail && "dossier-field-empty",
                  )}
                >
                  {companyEmail ? (
                    <a
                      href={`mailto:${companyEmail}`}
                      dir="ltr"
                      className={cn(
                        "inline-flex items-center gap-1.5 text-primary hover:underline",
                        focusRing,
                      )}
                    >
                      <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{companyEmail}</span>
                    </a>
                  ) : (
                    unavailable
                  )}
                </dd>
              </div>
            </dl>

            {/* Company Phones Strip */}
            <div className="space-y-1.5 border-t border-border/60 pt-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Phone className="size-3.5" aria-hidden="true" />
                <span>{detail.companyPhones}</span>
              </div>
              {companyPhones.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {companyPhones.map((phone, index) => (
                    <CustomerPhoneActionsRow
                      key={`${phone}-${index}`}
                      phone={phone}
                      country={profile.address?.country ?? undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{unavailable}</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
