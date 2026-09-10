"use client";

import { Button, Checkbox, Field, FormModal, Input, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CrmJobTitleField } from "../../../shared/components/CrmJobTitleField";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import type { LeadContactModal } from "../hooks/useLeadContactModal";
import { CONTACT_MODAL_LIMITS } from "../contact-modal-contract";
import { LeadContactFields } from "./LeadContactList";

export function LeadContactEditModal({ edit }: { edit: LeadContactModal }) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const form = edit.form;
  const disabled = edit.saving || edit.loading || edit.mustReload;
  const identityField = (field: "displayName" | "firstName" | "lastName" | "honorificTitle" | "email", label: string, maxLength: number) => (
    <Field label={label} error={edit.errors[field]} readOnly={!edit.canEditIdentity}>
      <Input value={form?.[field] ?? ""} disabled={disabled} maxLength={maxLength}
        type={field === "email" ? "email" : "text"} dir={field === "email" ? "ltr" : undefined}
        onChange={(event) => edit.setField(field, event.target.value)} />
    </Field>
  );
  return (
    <FormModal size="card" density="compact" open={edit.open} onOpenChange={(open) => { if (!open) edit.close(); }}
      title={t.crmLeadDetail.editContact} description={t.crmLeadDetail.contactSharedRecord}
      isDirty={edit.isDirty} isSubmitting={edit.saving} onSubmit={() => void edit.save()}
      submitDisabled={edit.loading || edit.mustReload || !form}
      error={describeError(edit.error) ?? undefined}
      labels={{ submit: t.common.save, cancel: t.common.cancel, close: t.common.close,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid }}>
      {edit.loading ? <Skeleton className="h-60 rounded-md" /> : form && <>
        {!edit.canEditIdentity && <p className="text-xs text-muted-foreground">{t.crmLeadDetail.contactIdentityPermission}</p>}
        <LeadContactFields fields={[
          { label: t.crmLeadDetail.fullName, value: identityField("displayName", t.crmLeadDetail.fullName, CONTACT_MODAL_LIMITS.displayName) },
          { label: t.crmLeadDetail.firstName, value: identityField("firstName", t.crmLeadDetail.firstName, CONTACT_MODAL_LIMITS.name) },
          { label: t.crmLeadDetail.lastName, value: identityField("lastName", t.crmLeadDetail.lastName, CONTACT_MODAL_LIMITS.name) },
          { label: t.crmLeadDetail.honorificTitle, value: identityField("honorificTitle", t.crmLeadDetail.honorificTitle, CONTACT_MODAL_LIMITS.honorificTitle) },
          { label: t.crmLeadConvert.contactJobTitle, value: <Field label={t.crmLeadConvert.contactJobTitle} error={edit.errors.jobTitle}>
            <CrmJobTitleField value={form.jobTitle} disabled={disabled}
              onChange={(value) => edit.setField("jobTitle", value)} onBlur={() => {}} />
          </Field> },
          { label: t.crmLeads.phone, value: edit.canEditIdentity ? (
            <CrmPhoneListField label={t.crmLeads.phone} phones={form.phones.map(({ value }) => value)} path="phones"
              errors={edit.errors} disabled={disabled} onChange={edit.setPhone} onAdd={edit.addPhone}
              onRemove={edit.removePhone} onBlur={() => {}} />
          ) : form.phones.map(({ value }) => value).join(" / ") },
          { label: t.crmLeads.email, value: identityField("email", t.crmLeads.email, CONTACT_MODAL_LIMITS.value) },
          { label: t.crmLeadDetail.primaryContact, value: <Field label={t.crmLeadDetail.primaryContact} error={edit.errors.isPrimary}>
            <Checkbox checked={form.isPrimary} disabled={disabled}
              onCheckedChange={(checked) => edit.setField("isPrimary", checked === true)} />
          </Field> },
        ]} />
        {edit.errors.phones && <p role="alert" className="text-xs text-destructive">{edit.errors.phones}</p>}
        {edit.errors.contacts && <p role="alert" className="text-xs text-destructive">{edit.errors.contacts}</p>}
      </>}
      {edit.mustReload && <div className="flex flex-col items-start gap-2">
        <p role="alert" className="text-sm text-destructive">{
          edit.failure === "partial" ? t.crmLeadDetail.contactPartialSave : t.crmLeadDetail.contactReloadRequired
        }</p>
        <Button variant="outline" size="sm" disabled={edit.loading || edit.saving} onClick={() => void edit.reload()}>{t.common.retry}</Button>
      </div>}
    </FormModal>
  );
}
