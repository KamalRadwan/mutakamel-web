"use client";

import { useState } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, Field, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  parseAddContactResponse,
  parseCustomerProfileDetailResponse,
  type CustomerProfileDetail,
} from "../../customer-profile-contract";
import { buildAddCustomerContactRequest } from "../../customer-profile-write-contract";
import { customerProfilePath } from "../../hooks/useCustomerProfiles";

export interface CustomerContactsCardProps {
  profile: CustomerProfileDetail;
  canEdit: boolean;
  onAddContact?: () => void;
  onSaved?: (next: CustomerProfileDetail) => void;
  onReconcile?: () => void;
}

function getContactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function CustomerContactsCard({
  profile,
  canEdit,
  onAddContact,
  onSaved,
  onReconcile,
}: CustomerContactsCardProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const detail = t.crmLeadDetail;
  const isCorporate = profile.profileType === "CORPORATE";
  const sortedContacts = [...profile.contacts].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
  );

  // Inline Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Individual Contact Draft
  const [individualDraft, setIndividualDraft] = useState(() => {
    const parts = profile.displayName.trim().split(/\s+/);
    return {
      firstName: parts[0] ?? profile.displayName,
      lastName: parts.slice(1).join(" "),
      email: profile.email ?? "",
      phones: profile.phones.length > 0 ? [...profile.phones] : [""],
    };
  });

  // Corporate Contacts Draft
  const [corporateDraft, setCorporateDraft] = useState(() =>
    sortedContacts.map((c) => ({
      partyId: c.partyId,
      displayName: c.displayName,
      firstName: c.firstName ?? c.displayName.split(/\s+/)[0] ?? "",
      lastName: c.lastName ?? c.displayName.split(/\s+/).slice(1).join(" "),
      jobTitle: c.jobTitle ?? "",
      email: c.email ?? "",
      phone: c.phones[0] ?? "",
      isPrimary: c.isPrimary,
    })),
  );

  // Inline Add Contact Draft (for Corporate)
  const [newContactDraft, setNewContactDraft] = useState({
    honorificTitle: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    email: "",
    phone: "",
  });

  const handleStartEdit = () => {
    setErrorMsg(null);
    if (isCorporate) {
      setCorporateDraft(
        sortedContacts.map((c) => ({
          partyId: c.partyId,
          displayName: c.displayName,
          firstName: c.firstName ?? c.displayName.split(/\s+/)[0] ?? "",
          lastName: c.lastName ?? c.displayName.split(/\s+/).slice(1).join(" "),
          jobTitle: c.jobTitle ?? "",
          email: c.email ?? "",
          phone: c.phones[0] ?? "",
          isPrimary: c.isPrimary,
        })),
      );
    } else {
      const parts = profile.displayName.trim().split(/\s+/);
      setIndividualDraft({
        firstName: parts[0] ?? profile.displayName,
        lastName: parts.slice(1).join(" "),
        email: profile.email ?? "",
        phones: profile.phones.length > 0 ? [...profile.phones] : [""],
      });
    }
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!onSaved || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      let body: Record<string, unknown>;
      if (isCorporate) {
        body = {
          contacts: corporateDraft.map((c) => ({
            contactPartyId: c.partyId,
            fullName: c.displayName,
            jobTitle: c.jobTitle.trim() || undefined,
            isPrimary: c.isPrimary,
          })),
        };
      } else {
        const cleanPhones = individualDraft.phones
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        const composedName = [
          individualDraft.firstName.trim(),
          individualDraft.lastName.trim(),
        ]
          .filter(Boolean)
          .join(" ");
        body = {
          ...(composedName ? { displayName: composedName } : {}),
          primaryContact: {
            firstName: individualDraft.firstName.trim(),
            ...(individualDraft.lastName.trim()
              ? { lastName: individualDraft.lastName.trim() }
              : {}),
            ...(individualDraft.email.trim()
              ? { email: individualDraft.email.trim() }
              : {}),
            phones: cleanPhones,
          },
        };
      }

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

  const handleSaveInlineNewContact = async () => {
    if (!newContactDraft.firstName.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "post",
        path: `${customerProfilePath(profile.id)}/contacts`,
        body: buildAddCustomerContactRequest(newContactDraft),
        parse: parseAddContactResponse,
        config: { maxResponseBytes: 64 * 1024 },
      });
      if (outcome.kind === "success") {
        setIsAddingInline(false);
        setNewContactDraft({
          honorificTitle: "",
          firstName: "",
          lastName: "",
          jobTitle: "",
          email: "",
          phone: "",
        });
        onReconcile?.();
      } else {
        setErrorMsg(
          describeError(outcome.error) ?? t.crmCustomerProfiles.cardUpdateFailed,
        );
        if (
          outcome.kind === "ambiguous" ||
          outcome.kind === "applied_unreadable"
        ) {
          setIsAddingInline(false);
          onReconcile?.();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      role="region"
      aria-label={
        isCorporate
          ? t.crmCustomerProfiles.create.sections.contacts
          : t.crmLeads.create.contactDetailsTitle
      }
      className={cn(
        "dossier-card w-full min-w-0",
        isCorporate ? "dossier-card-cyan" : "dossier-card-violet",
      )}
    >
      <div className="dossier-card-head">
        <div className="dossier-card-title-wrap">
          <span className="dossier-card-head-icon" aria-hidden="true">
            {isCorporate ? (
              <Users className="size-4" aria-hidden="true" />
            ) : (
              <UserRound className="size-4" aria-hidden="true" />
            )}
          </span>
          <h2 className="dossier-card-title">
            {isCorporate
              ? t.crmCustomerProfiles.create.sections.contacts
              : t.crmLeads.create.contactDetailsTitle}
          </h2>
          {isCorporate && (
            <span className="dossier-card-badge">
              {profile.contacts.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="dossier-card-badge">
            {t.crmCustomerProfiles.profileTypes[profile.profileType]}
          </span>

          {canEdit &&
            onSaved &&
            !isEditing &&
            (!isCorporate || profile.contacts.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleStartEdit}
                className="dossier-btn dossier-btn-sm"
              >
                <Pencil className="size-3" aria-hidden="true" />
                <span>{t.crmTags.edit}</span>
              </Button>
            )}

          {isCorporate && canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="dossier-btn dossier-btn-cyan"
              onClick={() => {
                if (onAddContact) {
                  onAddContact();
                } else {
                  setIsAddingInline((cur) => !cur);
                }
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>{t.crmCustomerProfileActions.addContact}</span>
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="px-3.5 pt-3">
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
          >
            {errorMsg}
          </p>
        </div>
      )}

      <div className="dossier-card-body flex flex-col gap-2.5">
        {/* Inline Add Contact Composer */}
        {isAddingInline && isCorporate && (
          <div className="dossier-contact-card editing min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-swatch-teal-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-swatch-teal-soft bg-swatch-teal-soft text-swatch-teal-deep"
                  aria-hidden="true"
                >
                  <Plus className="size-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {t.crmCustomerProfileActions.addContactTitle}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={saving}
                  onClick={() => setIsAddingInline(false)}
                  className="dossier-btn dossier-btn-cancel"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  <span>{t.common.cancel}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={saving || !newContactDraft.firstName.trim()}
                  onClick={() => void handleSaveInlineNewContact()}
                  className="dossier-btn dossier-btn-save"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{t.common.create}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="dossier-field-box">
                <Field label={`${t.crmLeads.create.firstName} *`}>
                  <Input
                    size="sm"
                    value={newContactDraft.firstName}
                    onChange={(e) =>
                      setNewContactDraft((d) => ({
                        ...d,
                        firstName: e.target.value,
                      }))
                    }
                    placeholder={t.crmLeads.create.firstName}
                  />
                </Field>
              </div>
              <div className="dossier-field-box">
                <Field label={t.crmLeads.create.lastName}>
                  <Input
                    size="sm"
                    value={newContactDraft.lastName}
                    onChange={(e) =>
                      setNewContactDraft((d) => ({
                        ...d,
                        lastName: e.target.value,
                      }))
                    }
                    placeholder={t.crmLeads.create.lastName}
                  />
                </Field>
              </div>
              <div className="dossier-field-box">
                <Field label={t.crmLeads.create.contactJobTitle}>
                  <Input
                    size="sm"
                    value={newContactDraft.jobTitle}
                    onChange={(e) =>
                      setNewContactDraft((d) => ({
                        ...d,
                        jobTitle: e.target.value,
                      }))
                    }
                    placeholder={t.crmLeads.create.contactJobTitle}
                  />
                </Field>
              </div>
              <div className="dossier-field-box">
                <Field label={t.crmLeads.phone}>
                  <Input
                    size="sm"
                    type="tel"
                    dir="ltr"
                    value={newContactDraft.phone}
                    onChange={(e) =>
                      setNewContactDraft((d) => ({
                        ...d,
                        phone: e.target.value,
                      }))
                    }
                    placeholder={t.crmLeads.phone}
                    className="font-mono"
                  />
                </Field>
              </div>
              <div className="dossier-field-box sm:col-span-2">
                <Field label={t.crmCustomerProfiles.email}>
                  <Input
                    size="sm"
                    type="email"
                    dir="ltr"
                    value={newContactDraft.email}
                    onChange={(e) =>
                      setNewContactDraft((d) => ({
                        ...d,
                        email: e.target.value,
                      }))
                    }
                    placeholder={t.crmCustomerProfiles.email}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Inline Edit Mode */}
        {isEditing ? (
          <div className="dossier-contact-card editing min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-swatch-teal-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-swatch-teal-soft bg-swatch-teal-soft text-swatch-teal-deep"
                  aria-hidden="true"
                >
                  <Pencil className="size-3.5" />
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {detail.editContact}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={saving}
                  onClick={() => setIsEditing(false)}
                  className="dossier-btn dossier-btn-cancel"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  <span>{t.common.cancel}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={saving}
                  onClick={() => void handleSaveEdit()}
                  className="dossier-btn dossier-btn-save"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" aria-hidden="true" />
                  )}
                  <span>{t.common.save}</span>
                </Button>
              </div>
            </div>

            {isCorporate ? (
              <div className="space-y-2.5">
                <p className="text-sm text-muted-foreground">
                  {t.crmCustomerProfiles.existingContactReadOnly}
                </p>
                {corporateDraft.map((contact, idx) => (
                  <div
                    key={contact.partyId || idx}
                    className="dossier-field-box space-y-2 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {contact.displayName}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setCorporateDraft((list) =>
                            list.map((item, i) => ({
                              ...item,
                              isPrimary: i === idx,
                            })),
                          )
                        }
                        className={cn(
                          "h-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold transition-colors",
                          contact.isPrimary
                            ? "bg-swatch-teal-soft text-swatch-teal-deep"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Star
                          className={cn(
                            "size-3",
                            contact.isPrimary && "fill-current",
                          )}
                        />
                        {detail.primaryContact}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input
                        size="sm"
                        value={contact.jobTitle}
                        onChange={(e) =>
                          setCorporateDraft((list) =>
                            list.map((item, i) =>
                              i === idx
                                ? { ...item, jobTitle: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={t.crmLeads.create.contactJobTitle}
                      />
                      <Input
                        size="sm"
                        type="tel"
                        dir="ltr"
                        value={contact.phone}
                        readOnly
                        placeholder={t.crmLeads.phone}
                        className="font-mono"
                      />
                      <Input
                        size="sm"
                        type="email"
                        dir="ltr"
                        value={contact.email}
                        readOnly
                        placeholder={t.crmCustomerProfiles.email}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="dossier-field-box">
                    <Field label={`${t.crmLeads.create.firstName} *`}>
                      <Input
                        size="sm"
                        value={individualDraft.firstName}
                        onChange={(e) =>
                          setIndividualDraft((d) => ({
                            ...d,
                            firstName: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="dossier-field-box">
                    <Field label={t.crmLeads.create.lastName}>
                      <Input
                        size="sm"
                        value={individualDraft.lastName}
                        onChange={(e) =>
                          setIndividualDraft((d) => ({
                            ...d,
                            lastName: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="dossier-field-box sm:col-span-2">
                    <Field label={t.crmCustomerProfiles.email}>
                      <Input
                        size="sm"
                        type="email"
                        dir="ltr"
                        value={individualDraft.email}
                        onChange={(e) =>
                          setIndividualDraft((d) => ({
                            ...d,
                            email: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="dossier-phone-box-edit space-y-1.5 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="dossier-phone-box-label">
                      📞 {t.crmLeadBoard.phones}
                    </span>
                    {individualDraft.phones.length < 5 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setIndividualDraft((d) => ({
                            ...d,
                            phones: [...d.phones, ""],
                          }))
                        }
                        className="dossier-btn-action dossier-btn-action-emerald"
                      >
                        <Plus className="size-3" />
                        <span>{t.crmCustomerProfiles.ui.contacts.addPhone}</span>
                      </Button>
                    )}
                  </div>
                  {individualDraft.phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input
                        size="sm"
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) =>
                          setIndividualDraft((d) => ({
                            ...d,
                            phones: d.phones.map((p, i) =>
                              i === idx ? e.target.value : p,
                            ),
                          }))
                        }
                        className="flex-1 font-mono"
                      />
                      {individualDraft.phones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setIndividualDraft((d) => ({
                              ...d,
                              phones: d.phones.filter((_, i) => i !== idx),
                            }))
                          }
                          className="inline-flex size-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isCorporate ? (
          sortedContacts.length === 0 ? (
            !isAddingInline && (
              <p className="text-xs text-muted-foreground">
                {detail.contactsEmpty}
              </p>
            )
          ) : (
            sortedContacts.map((contact) => (
              <CustomerContactReadCard
                key={contact.partyId}
                name={contact.displayName}
                honorificTitle={contact.honorificTitle}
                jobTitle={contact.jobTitle}
                phones={contact.phones}
                email={contact.email}
                country={profile.address?.country ?? undefined}
                isPrimary={contact.isPrimary}
                showJobTitle
                onEdit={canEdit && onSaved ? handleStartEdit : undefined}
              />
            ))
          )
        ) : (
          <CustomerContactReadCard
            name={profile.displayName}
            jobTitle={null}
            phones={
              profile.phones.length > 0
                ? profile.phones
                : profile.primaryMobile
                  ? [profile.primaryMobile]
                  : []
            }
            email={profile.email}
            country={profile.address?.country ?? undefined}
            showJobTitle={false}
            onEdit={canEdit && onSaved ? handleStartEdit : undefined}
          />
        )}
      </div>
    </section>
  );
}

function CustomerContactReadCard({
  name,
  honorificTitle,
  jobTitle,
  phones,
  email,
  country,
  isPrimary,
  showJobTitle = true,
  onEdit,
}: {
  name: string;
  honorificTitle?: string | null;
  jobTitle: string | null;
  phones: string[];
  email: string | null;
  country?: string;
  isPrimary?: boolean;
  showJobTitle?: boolean;
  onEdit?: () => void;
}) {
  const { t } = useI18n();
  const initials = getContactInitials(name);

  return (
    <div
      className={cn(
        "dossier-contact-card w-full min-w-0",
        isPrimary && "primary",
      )}
    >
      {/* Horizontal 2-Row Layout:
          Row 1: Full Name (with Avatar, Primary badge & Edit button) | Job Title | Email
          Row 2: Phone box spanning full horizontal width with inline Call / WhatsApp / Telegram */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        {/* Row 1, Col 1: Full Name */}
        <div
          className={cn(
            "dossier-field-box flex min-w-0 flex-col justify-center",
            showJobTitle ? "sm:col-span-6" : "sm:col-span-7",
          )}
        >
          <dt className="dossier-field-label">{t.crmLeadDetail.fullName}</dt>
          <dd className="dossier-field-val mt-0.5 min-w-0 text-xs text-foreground">
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-semibold text-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-primary-foreground shadow-2xs",
                    isPrimary
                      ? "bg-swatch-green"
                      : "bg-swatch-indigo",
                  )}
                >
                  {initials}
                </span>
                {honorificTitle && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {honorificTitle}.
                  </span>
                )}
                <span className="truncate text-xs font-semibold text-foreground">
                  {name}
                </span>
                {isPrimary && (
                  <Badge
                    tone="positive"
                    className="dossier-badge-primary shrink-0 gap-1"
                  >
                    <Star className="size-3 fill-current" aria-hidden="true" />
                    {t.crmLeadDetail.primaryContact}
                  </Badge>
                )}
              </span>

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
          </dd>
        </div>

        {/* Row 1, Col 2: Job Title (Corporate) */}
        {showJobTitle && (
          <div className="dossier-field-box flex min-w-0 flex-col justify-center sm:col-span-3">
            <dt className="dossier-field-label">
              {t.crmLeadConvert.contactJobTitle}
            </dt>
            <dd className="dossier-field-val mt-0.5 min-w-0 wrap-anywhere text-xs text-foreground">
              {jobTitle ? (
                <span className="inline-flex items-center rounded-md border border-swatch-teal-soft bg-swatch-teal-soft px-2 py-0.5 text-2xs font-semibold text-swatch-teal-deep">
                  {jobTitle}
                </span>
              ) : (
                <span className="dossier-field-empty">
                  {t.detail.notRecorded}
                </span>
              )}
            </dd>
          </div>
        )}

        {/* Row 1, Col 3: Email */}
        <div
          className={cn(
            "dossier-field-box flex min-w-0 flex-col justify-center",
            showJobTitle ? "sm:col-span-3" : "sm:col-span-5",
          )}
        >
          <dt className="dossier-field-label">{t.crmLeads.email}</dt>
          <dd className="dossier-field-val mt-0.5 min-w-0 wrap-anywhere text-xs text-foreground">
            {email ? (
              <a
                dir="ltr"
                href={"mailto:" + email}
                className="dossier-field-link truncate font-medium"
              >
                {email}
              </a>
            ) : (
              <span className="dossier-field-empty">
                {t.detail.notRecorded}
              </span>
            )}
          </dd>
        </div>

        {/* Row 2: Full-Width Horizontal Phone Strip */}
        <div className="dossier-phone-box-view mb-0 min-w-0 p-2.5 sm:col-span-12">
          <dt className="dossier-phone-box-label mb-1.5">
            📞 {t.crmLeads.phone} {phones.length > 0 ? `(${phones.length})` : ""}
          </dt>
          <dd className="min-w-0 text-xs text-foreground">
            {phones.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {phones.map((phone, index) => (
                  <CustomerPhoneActionsRow
                    key={`${phone}-${index}`}
                    phone={phone}
                    country={country}
                    badge={index === 0 ? t.crmLeads.phone : `#${index + 1}`}
                  />
                ))}
              </div>
            ) : (
              <span className="dossier-field-empty">
                {t.detail.notRecorded}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}


