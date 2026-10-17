"use client";

import { useState } from "react";
import {
  Briefcase,
  Check,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Star,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, cn, focusRing } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { CustomerPhoneActionsRow } from "../../components/CustomerPhoneActionsRow";
import {
  parseAddContactResponse,
  parseCustomerProfileDetailResponse,
  type CustomerProfileContact,
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

const COMPACT_BADGE =
  "shrink-0 px-1.5 py-0.5 text-2xs font-medium leading-none normal-case tracking-normal";

export function CustomerContactsCard({
  profile,
  canEdit,
  onAddContact,
  onSaved,
  onReconcile,
}: CustomerContactsCardProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const detail = t.crmLeadDetail;
  const unavailable = t.crmCustomerProfiles.unavailable;
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
          contacts: corporateDraft.map((c) => {
            const fullName =
              [c.firstName.trim(), c.lastName.trim()]
                .filter(Boolean)
                .join(" ") || c.displayName;
            return {
              contactPartyId: c.partyId,
              fullName,
              firstName: c.firstName.trim() || undefined,
              lastName: c.lastName.trim() || undefined,
              jobTitle: c.jobTitle.trim() || undefined,
              email: c.email.trim() || undefined,
              phones: c.phone.trim() ? [c.phone.trim()] : [],
              isPrimary: c.isPrimary,
            };
          }),
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
          outcome.error.message ?? t.crmCustomerProfiles.cardUpdateFailed,
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
      aria-label={
        isCorporate
          ? t.crmCustomerProfiles.create.sections.contacts
          : t.crmLeads.create.contactDetailsTitle
      }
      className="dossier-card dossier-card-teal"
    >
      <div className="dossier-card-header">
        <div className="dossier-card-title-group">
          <div className="dossier-card-icon">
            {isCorporate ? (
              <Users className="size-4" aria-hidden="true" />
            ) : (
              <User className="size-4" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="dossier-card-title">
                {isCorporate
                  ? t.crmCustomerProfiles.create.sections.contacts
                  : t.crmLeads.create.contactDetailsTitle}
              </h3>
              {isCorporate && (
                <Badge tone="neutral" className={COMPACT_BADGE}>
                  {profile.contacts.length}
                </Badge>
              )}
            </div>
            <p className="dossier-card-subtitle">
              {isCorporate
                ? isAr
                  ? "صنّاع القرار وجهات الاتصال المعتمدة لدى الشركة"
                  : "Decision makers & authorized corporate contacts"
                : isAr
                  ? "بيانات التواصل المباشر للعميل الفرد"
                  : "Direct communication channels for this individual customer"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {canEdit &&
            onSaved &&
            !isEditing &&
            (!isCorporate || profile.contacts.length > 0) && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="dossier-edit-btn"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                <span>{t.crmTags.edit}</span>
              </button>
            )}

          {isCorporate && canEdit && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                if (onAddContact) {
                  onAddContact();
                } else {
                  setIsAddingInline((cur) => !cur);
                }
              }}
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              {t.crmCustomerProfileActions.addContact}
            </Button>
          )}
        </div>
      </div>

      <div className="dossier-card-body space-y-3">
        {errorMsg && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            {errorMsg}
          </p>
        )}

        {/* Inline Add Contact Composer (when used inside Quick Modal or without external dialog) */}
        {isAddingInline && isCorporate && (
          <div className="space-y-2.5 rounded-xl border border-teal-500/35 bg-teal-500/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-200">
                {t.crmCustomerProfileActions.addContactTitle}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingInline(false)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={newContactDraft.firstName}
                onChange={(e) =>
                  setNewContactDraft((d) => ({
                    ...d,
                    firstName: e.target.value,
                  }))
                }
                placeholder={`${t.crmLeads.create.firstName} *`}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
              />
              <input
                type="text"
                value={newContactDraft.lastName}
                onChange={(e) =>
                  setNewContactDraft((d) => ({
                    ...d,
                    lastName: e.target.value,
                  }))
                }
                placeholder={t.crmLeads.create.lastName}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
              />
              <input
                type="text"
                value={newContactDraft.jobTitle}
                onChange={(e) =>
                  setNewContactDraft((d) => ({
                    ...d,
                    jobTitle: e.target.value,
                  }))
                }
                placeholder={t.crmLeads.create.contactJobTitle}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
              />
              <input
                type="tel"
                dir="ltr"
                value={newContactDraft.phone}
                onChange={(e) =>
                  setNewContactDraft((d) => ({ ...d, phone: e.target.value }))
                }
                placeholder={t.crmLeads.phone}
                className="h-8 rounded-lg border border-border bg-background px-2.5 font-mono text-xs"
              />
              <input
                type="email"
                dir="ltr"
                value={newContactDraft.email}
                onChange={(e) =>
                  setNewContactDraft((d) => ({ ...d, email: e.target.value }))
                }
                placeholder={t.crmCustomerProfiles.email}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs sm:col-span-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingInline(false)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving || !newContactDraft.firstName.trim()}
                onClick={() => void handleSaveInlineNewContact()}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3 animate-spin" />}
                {t.common.create}
              </button>
            </div>
          </div>
        )}

        {/* Inline Edit Mode */}
        {isEditing ? (
          <div className="space-y-3 rounded-xl border border-teal-500/30 bg-teal-500/[0.03] p-3">
            {isCorporate ? (
              <div className="space-y-2.5">
                {corporateDraft.map((contact, idx) => (
                  <div
                    key={contact.partyId || idx}
                    className="space-y-2 rounded-lg border border-border/80 bg-card p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        {contact.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCorporateDraft((list) =>
                            list.map((item, i) => ({
                              ...item,
                              isPrimary: i === idx,
                            })),
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors",
                          contact.isPrimary
                            ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
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
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
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
                        className="h-7 rounded border border-border bg-background px-2 text-xs"
                      />
                      <input
                        type="tel"
                        dir="ltr"
                        value={contact.phone}
                        onChange={(e) =>
                          setCorporateDraft((list) =>
                            list.map((item, i) =>
                              i === idx
                                ? { ...item, phone: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={t.crmLeads.phone}
                        className="h-7 rounded border border-border bg-background px-2 font-mono text-xs"
                      />
                      <input
                        type="email"
                        dir="ltr"
                        value={contact.email}
                        onChange={(e) =>
                          setCorporateDraft((list) =>
                            list.map((item, i) =>
                              i === idx
                                ? { ...item, email: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={t.crmCustomerProfiles.email}
                        className="h-7 rounded border border-border bg-background px-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {t.crmLeads.create.firstName} *
                    </label>
                    <input
                      type="text"
                      value={individualDraft.firstName}
                      onChange={(e) =>
                        setIndividualDraft((d) => ({
                          ...d,
                          firstName: e.target.value,
                        }))
                      }
                      className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {t.crmLeads.create.lastName}
                    </label>
                    <input
                      type="text"
                      value={individualDraft.lastName}
                      onChange={(e) =>
                        setIndividualDraft((d) => ({
                          ...d,
                          lastName: e.target.value,
                        }))
                      }
                      className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                    {t.crmCustomerProfiles.email}
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={individualDraft.email}
                    onChange={(e) =>
                      setIndividualDraft((d) => ({
                        ...d,
                        email: e.target.value,
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {t.crmLeadBoard.phones}
                    </span>
                    {individualDraft.phones.length < 5 && (
                      <button
                        type="button"
                        onClick={() =>
                          setIndividualDraft((d) => ({
                            ...d,
                            phones: [...d.phones, ""],
                          }))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:underline dark:text-teal-400"
                      >
                        <Plus className="size-3" />
                        {isAr ? "إضافة رقم" : "Add phone"}
                      </button>
                    )}
                  </div>
                  {individualDraft.phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
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
                        className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 font-mono text-xs"
                      />
                      {individualDraft.phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setIndividualDraft((d) => ({
                              ...d,
                              phones: d.phones.filter((_, i) => i !== idx),
                            }))
                          }
                          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <X className="size-3.5" />
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveEdit()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
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
        ) : isCorporate ? (
          sortedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-6 text-center text-muted-foreground">
              <Users className="mb-1.5 size-6 opacity-40" aria-hidden="true" />
              <p className="text-xs font-medium">{detail.contactsEmpty}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {sortedContacts.map((contact) => (
                <CorporateContactItem
                  key={contact.partyId}
                  contact={contact}
                  country={profile.address?.country}
                />
              ))}
            </ul>
          )
        ) : (
          <IndividualContactView profile={profile} unavailable={unavailable} />
        )}
      </div>
    </section>
  );
}

function CorporateContactItem({
  contact,
  country,
}: {
  contact: CustomerProfileContact;
  country?: string | null;
}) {
  const { t } = useI18n();
  const detail = t.crmLeadDetail;

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors",
        contact.isPrimary
          ? "border-teal-500/35 bg-teal-500/[0.04]"
          : "border-border/70 bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {contact.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {contact.honorificTitle && (
                <span className="text-xs font-medium text-muted-foreground">
                  {contact.honorificTitle}.
                </span>
              )}
              <span className="truncate text-sm font-semibold text-foreground">
                {contact.displayName}
              </span>
              {contact.isPrimary && (
                <Badge tone="brand" className={COMPACT_BADGE}>
                  {detail.primaryContact}
                </Badge>
              )}
            </div>
            {contact.jobTitle && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Briefcase className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{contact.jobTitle}</span>
              </p>
            )}
          </div>
        </div>

        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            dir="ltr"
            className={cn(
              "inline-flex items-center gap-1 rounded-xs text-xs text-primary hover:underline",
              focusRing,
            )}
          >
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
      </div>

      {contact.phones.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
          {contact.phones.map((phone, index) => (
            <CustomerPhoneActionsRow
              key={`${phone}-${index}`}
              phone={phone}
              country={country ?? undefined}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function IndividualContactView({
  profile,
  unavailable,
}: {
  profile: CustomerProfileDetail;
  unavailable: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <dl className="dossier-field-grid">
        <div className="dossier-field">
          <dt className="dossier-field-label">{t.crmCustomerProfiles.name}</dt>
          <dd className="dossier-field-value">{profile.displayName}</dd>
        </div>
        <div className="dossier-field">
          <dt className="dossier-field-label">{t.crmCustomerProfiles.email}</dt>
          <dd
            className={cn(
              "dossier-field-value",
              !profile.email && "dossier-field-empty",
            )}
          >
            {profile.email ? (
              <a
                href={`mailto:${profile.email}`}
                dir="ltr"
                className={cn(
                  "inline-flex items-center gap-1.5 text-primary hover:underline",
                  focusRing,
                )}
              >
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{profile.email}</span>
              </a>
            ) : (
              unavailable
            )}
          </dd>
        </div>
      </dl>

      <div className="space-y-1.5 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Phone className="size-3.5" aria-hidden="true" />
          <span>{t.crmLeadBoard.phones}</span>
        </div>
        {profile.phones.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {profile.phones.map((phone, index) => (
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
    </div>
  );
}
