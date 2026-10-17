"use client";

import { useId, useState } from "react";
import { Check, Plus, UserRound, Users, X } from "lucide-react";
import { Checkbox, Field, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { createWriteAttempt, runIdempotentWrite } from "@/lib/api/idempotent-write";
import { CrmJobTitleField } from "../../../shared/components/CrmJobTitleField";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import {
  leadPath,
  parseLeadDetailResponse,
  type LeadContact,
  type LeadDetail,
} from "../../lead-contract";
import { CONTACT_MODAL_LIMITS } from "../contact-modal-contract";
import { useLeadContactModal } from "../hooks/useLeadContactModal";
import { LeadContactEditModal } from "./LeadContactEditModal";
import { HonorificSelect, LeadContactFields, LeadContactList } from "./LeadContactList";
import { LeadIndividualContactCard } from "./LeadIndividualContactCard";

export interface LeadContactsCardProps {
  lead: LeadDetail;
  canEdit: boolean;
  onSaved: (lead: LeadDetail) => void;
  onReconcile: () => void;
}

interface NewContactDraft {
  honorificTitle: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phones: string[];
  isPrimary: boolean;
}

const EMPTY_NEW_CONTACT: NewContactDraft = {
  honorificTitle: "",
  firstName: "",
  lastName: "",
  displayName: "",
  jobTitle: "",
  email: "",
  phones: [""],
  isPrimary: false,
};

export function LeadContactsCard(props: LeadContactsCardProps) {
  const { lead, canEdit, onSaved, onReconcile } = props;
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const headingId = useId();
  const editable = canEdit && lead.status !== "CONVERTED";
  const edit = useLeadContactModal(lead, onSaved, onReconcile, editable);
  const isCorporate = lead.leadProfileType === "CORPORATE";
  const visibleContacts = lead.contacts.filter(
    (contact) => !edit.open || contact.partyId !== edit.form?.partyId,
  );

  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState<NewContactDraft>(EMPTY_NEW_CONTACT);
  const [newContactErrors, setNewContactErrors] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSetPrimary = async (target: LeadContact) => {
    if (!editable || actionBusy || target.isPrimary) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const contactsPayload = lead.contacts.map((c) => ({
        partyId: c.partyId,
        displayName: c.displayName,
        firstName: c.firstName,
        lastName: c.lastName,
        honorificTitle: c.honorificTitle,
        jobTitle: c.jobTitle,
        email: c.email,
        phones: c.phones,
        isPrimary: c.partyId === target.partyId,
      }));
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: leadPath(lead.id),
        body: { contacts: contactsPayload },
        parse: parseLeadDetailResponse,
      });
      if (outcome.kind === "success") {
        onSaved(outcome.value);
      } else {
        setActionError(describeError(outcome.error) ?? t.crmShared.errorValidation);
        if (outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable") {
          onReconcile();
        }
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveNewContact = async () => {
    if (!editable || actionBusy) return;
    const computedDisplayName =
      newContact.displayName.trim() ||
      [newContact.firstName.trim(), newContact.lastName.trim()]
        .filter(Boolean)
        .join(" ");
    const errs: Record<string, string> = {};
    if (!computedDisplayName) {
      errs.displayName = t.crmLeads.create.errors.required;
    }
    setNewContactErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setActionBusy(true);
    setActionError(null);
    try {
      const shouldBePrimary = lead.contacts.length === 0 || newContact.isPrimary;
      const existingPayload = lead.contacts.map((c) => ({
        partyId: c.partyId,
        displayName: c.displayName,
        firstName: c.firstName,
        lastName: c.lastName,
        honorificTitle: c.honorificTitle,
        jobTitle: c.jobTitle,
        email: c.email,
        phones: c.phones,
        isPrimary: shouldBePrimary ? false : c.isPrimary,
      }));
      const cleanPhones = newContact.phones.map((p) => p.trim()).filter(Boolean);
      const nextPayload = [
        ...existingPayload,
        {
          displayName: computedDisplayName,
          firstName: newContact.firstName.trim() || null,
          lastName: newContact.lastName.trim() || null,
          honorificTitle: newContact.honorificTitle.trim() || null,
          jobTitle: newContact.jobTitle.trim() || null,
          email: newContact.email.trim() || null,
          phones: cleanPhones,
          isPrimary: shouldBePrimary,
        },
      ];
      const outcome = await runIdempotentWrite({
        attempt: createWriteAttempt(),
        method: "patch",
        path: leadPath(lead.id),
        body: { contacts: nextPayload },
        parse: parseLeadDetailResponse,
      });
      if (outcome.kind === "success") {
        onSaved(outcome.value);
        setAddingContact(false);
        setNewContact(EMPTY_NEW_CONTACT);
        setNewContactErrors({});
      } else {
        setActionError(describeError(outcome.error) ?? t.crmShared.errorValidation);
        if (outcome.kind === "ambiguous" || outcome.kind === "applied_unreadable") {
          onReconcile();
        }
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <section
      role="region"
      aria-labelledby={headingId}
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
          <h2 id={headingId} className="dossier-card-title">
            {t.crmLeads.create.sections.contacts}
          </h2>
          {isCorporate && (
            <span className="dossier-card-badge">
              {lead.contacts.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="dossier-card-badge">
            {t.crmCustomerProfiles.profileTypes[lead.leadProfileType]}
          </span>
          {isCorporate && editable && !addingContact && (
            <button
              type="button"
              className="dossier-btn dossier-btn-cyan"
              onClick={() => {
                setAddingContact(true);
                setNewContact({
                  ...EMPTY_NEW_CONTACT,
                  isPrimary: lead.contacts.length === 0,
                });
                setNewContactErrors({});
                setActionError(null);
              }}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>{t.crmLeads.create.addContact}</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="px-3.5 pt-3">
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {actionError}
          </div>
        </div>
      )}

      <div className="dossier-card-body grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
        {isCorporate ? (
          <>
            <LeadContactEditModal edit={edit} />
            {addingContact && (
              <div className="dossier-contact-card editing min-w-0 sm:col-span-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/35 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                      aria-hidden="true"
                    >
                      <Plus className="size-3.5" />
                    </span>
                    <span className="text-xs font-extrabold text-foreground">
                      {t.crmLeads.create.addContact}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="dossier-btn dossier-btn-cancel"
                      disabled={actionBusy}
                      onClick={() => {
                        setAddingContact(false);
                        setNewContact(EMPTY_NEW_CONTACT);
                        setNewContactErrors({});
                      }}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      <span>{t.common.cancel}</span>
                    </button>
                    <button
                      type="button"
                      className="dossier-btn dossier-btn-save"
                      disabled={actionBusy}
                      onClick={() => void handleSaveNewContact()}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>{t.common.save}</span>
                    </button>
                  </div>
                </div>
                <LeadContactFields
                  fields={[
                    {
                      label: t.crmLeadDetail.honorificTitle,
                      value: (
                        <Field label={t.crmLeadDetail.honorificTitle}>
                          <HonorificSelect
                            value={newContact.honorificTitle}
                            disabled={actionBusy}
                            placeholder={t.crmLeadDetail.honorificTitle}
                            onChange={(value) =>
                              setNewContact((prev) => ({
                                ...prev,
                                honorificTitle: value,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeadDetail.fullName,
                      value: (
                        <Field
                          label={t.crmLeadDetail.fullName}
                          error={newContactErrors.displayName}
                        >
                          <Input
                            size="sm"
                            placeholder={t.crmLeadDetail.fullName}
                            value={newContact.displayName}
                            disabled={actionBusy}
                            maxLength={CONTACT_MODAL_LIMITS.displayName}
                            onChange={(e) =>
                              setNewContact((prev) => ({
                                ...prev,
                                displayName: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeadDetail.firstName,
                      value: (
                        <Field label={t.crmLeadDetail.firstName}>
                          <Input
                            size="sm"
                            placeholder={t.crmLeadDetail.firstName}
                            value={newContact.firstName}
                            disabled={actionBusy}
                            maxLength={CONTACT_MODAL_LIMITS.name}
                            onChange={(e) =>
                              setNewContact((prev) => ({
                                ...prev,
                                firstName: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeadDetail.lastName,
                      value: (
                        <Field label={t.crmLeadDetail.lastName}>
                          <Input
                            size="sm"
                            placeholder={t.crmLeadDetail.lastName}
                            value={newContact.lastName}
                            disabled={actionBusy}
                            maxLength={CONTACT_MODAL_LIMITS.name}
                            onChange={(e) =>
                              setNewContact((prev) => ({
                                ...prev,
                                lastName: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeadConvert.contactJobTitle,
                      value: (
                        <Field label={t.crmLeadConvert.contactJobTitle}>
                          <CrmJobTitleField
                            value={newContact.jobTitle}
                            disabled={actionBusy}
                            onChange={(value) =>
                              setNewContact((prev) => ({
                                ...prev,
                                jobTitle: value,
                              }))
                            }
                            onBlur={() => {}}
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeads.email,
                      value: (
                        <Field label={t.crmLeads.email}>
                          <Input
                            size="sm"
                            type="email"
                            dir="ltr"
                            placeholder={t.crmLeads.email}
                            value={newContact.email}
                            disabled={actionBusy}
                            maxLength={CONTACT_MODAL_LIMITS.value}
                            onChange={(e) =>
                              setNewContact((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                    {
                      label: t.crmLeads.phone,
                      span2: true,
                      value: (
                        <div className="dossier-phone-box-edit p-2.5">
                          <CrmPhoneListField
                            label={t.crmLeads.phone}
                            phones={newContact.phones}
                            path="phones"
                            errors={newContactErrors}
                            disabled={actionBusy}
                            onChange={(idx, val) =>
                              setNewContact((prev) => ({
                                ...prev,
                                phones: prev.phones.map((p, i) =>
                                  i === idx ? val : p,
                                ),
                              }))
                            }
                            onAdd={() =>
                              setNewContact((prev) => ({
                                ...prev,
                                phones: [...prev.phones, ""],
                              }))
                            }
                            onRemove={(idx) =>
                              setNewContact((prev) => ({
                                ...prev,
                                phones:
                                  prev.phones.length === 1
                                    ? [""]
                                    : prev.phones.filter((_, i) => i !== idx),
                              }))
                            }
                            onBlur={() => {}}
                          />
                        </div>
                      ),
                    },
                    {
                      label: t.crmLeadDetail.primaryContact,
                      span2: true,
                      value: (
                        <Field label={t.crmLeadDetail.primaryContact}>
                          <Checkbox
                            checked={newContact.isPrimary}
                            disabled={actionBusy || lead.contacts.length === 0}
                            onCheckedChange={(checked) =>
                              setNewContact((prev) => ({
                                ...prev,
                                isPrimary: checked === true,
                              }))
                            }
                          />
                        </Field>
                      ),
                    },
                  ]}
                />
              </div>
            )}
            {lead.contacts.length > 0 ? (
              <LeadContactList
                contacts={visibleContacts}
                country={lead.address?.country ?? undefined}
                onEdit={editable ? edit.openContact : undefined}
                onSetPrimary={editable ? handleSetPrimary : undefined}
              />
            ) : (
              !addingContact && (
                <p className="col-span-full text-xs text-muted-foreground">
                  {t.crmLeadDetail.contactsEmpty}
                </p>
              )
            )}
          </>
        ) : (
          <LeadIndividualContactCard {...props} canEdit={editable} />
        )}
      </div>
    </section>
  );
}

