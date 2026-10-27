"use client";

import { useId } from "react";
import { Check, Plus, UserRound, Users, X } from "lucide-react";
import { Button, Checkbox, Field, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmJobTitleField } from "../../../shared/components/CrmJobTitleField";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { LeadDetail } from "../../lead-contract";
import { LEAD_CONTACT_EDIT_LIMITS } from "../lead-contacts-edit-contract";
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

  const { addingContact, newContact, newContactErrors, actionBusy } = edit;
  const actionError = edit.actionError ? describeError(edit.actionError) ?? t.crmShared.errorValidation : null;
  const canStartAction = editable && !edit.open && !actionBusy && !edit.actionMustReload;

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
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="dossier-btn dossier-btn-cyan"
              disabled={!canStartAction}
              onClick={edit.startAddingContact}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>{t.crmLeads.create.addContact}</span>
            </Button>
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
      {edit.actionMustReload && (
        <div className="px-3.5 pt-3">
          <p role="alert" className="text-sm text-destructive">{t.crmLeadDetail.contactReloadRequired}</p>
          <Button variant="outline" size="sm" disabled={actionBusy} onClick={() => void edit.reloadContacts()}>
            {t.common.retry}
          </Button>
        </div>
      )}

      <div className="dossier-card-body grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
        {isCorporate ? (
          <>
            <LeadContactEditModal edit={edit} />
            {addingContact && (
              <div className="dossier-contact-card editing min-w-0 sm:col-span-2">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-foreground"
                      aria-hidden="true"
                    >
                      <Plus className="size-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {t.crmLeads.create.addContact}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="dossier-btn dossier-btn-cancel"
                      disabled={actionBusy}
                      onClick={edit.cancelAddingContact}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      <span>{t.common.cancel}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="dossier-btn dossier-btn-save"
                      disabled={actionBusy}
                      onClick={() => void edit.saveNewContact()}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>{t.common.save}</span>
                    </Button>
                  </div>
                </div>
                <LeadContactFields
                  fields={[
                    {
                      label: t.crmLeadDetail.honorificTitle,
                      value: (
                        <Field label={t.crmLeadDetail.honorificTitle} error={newContactErrors.honorificTitle}>
                          <HonorificSelect
                            value={newContact.honorificTitle}
                            disabled={actionBusy}
                            placeholder={t.crmLeadDetail.honorificTitle}
                            onChange={(value) =>
                              edit.changeNewContact((prev) => ({
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
                            maxLength={LEAD_CONTACT_EDIT_LIMITS.displayName}
                            onChange={(e) =>
                              edit.changeNewContact((prev) => ({
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
                        <Field label={t.crmLeadDetail.firstName} error={newContactErrors.firstName}>
                          <Input
                            size="sm"
                            placeholder={t.crmLeadDetail.firstName}
                            value={newContact.firstName}
                            disabled={actionBusy}
                            maxLength={LEAD_CONTACT_EDIT_LIMITS.name}
                            onChange={(e) =>
                              edit.changeNewContact((prev) => ({
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
                        <Field label={t.crmLeadDetail.lastName} error={newContactErrors.lastName}>
                          <Input
                            size="sm"
                            placeholder={t.crmLeadDetail.lastName}
                            value={newContact.lastName}
                            disabled={actionBusy}
                            maxLength={LEAD_CONTACT_EDIT_LIMITS.name}
                            onChange={(e) =>
                              edit.changeNewContact((prev) => ({
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
                        <Field label={t.crmLeadConvert.contactJobTitle} error={newContactErrors.jobTitle}>
                          <CrmJobTitleField
                            value={newContact.jobTitle}
                            disabled={actionBusy}
                            onChange={(value) =>
                              edit.changeNewContact((prev) => ({
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
                        <Field label={t.crmLeads.email} error={newContactErrors.email}>
                          <Input
                            size="sm"
                            type="email"
                            dir="ltr"
                            placeholder={t.crmLeads.email}
                            value={newContact.email}
                            disabled={actionBusy}
                            maxLength={LEAD_CONTACT_EDIT_LIMITS.email}
                            onChange={(e) =>
                              edit.changeNewContact((prev) => ({
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
                              edit.changeNewContact((prev) => ({
                                ...prev,
                                phones: prev.phones.map((p, i) =>
                                  i === idx ? val : p,
                                ),
                              }))
                            }
                            onAdd={() =>
                              edit.changeNewContact((prev) => ({
                                ...prev,
                                phones: [...prev.phones, ""],
                              }))
                            }
                            onRemove={(idx) =>
                              edit.changeNewContact((prev) => ({
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
                              edit.changeNewContact((prev) => ({
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
                {newContactErrors.phones && (
                  <p role="alert" className="text-sm text-destructive">{newContactErrors.phones}</p>
                )}
              </div>
            )}
            {lead.contacts.length > 0 ? (
              <LeadContactList
                contacts={visibleContacts}
                country={lead.address?.country ?? undefined}
                onEdit={editable && !addingContact && !actionBusy && !edit.actionMustReload ? edit.openContact : undefined}
                onSetPrimary={canStartAction && !addingContact ? edit.setPrimaryContact : undefined}
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

