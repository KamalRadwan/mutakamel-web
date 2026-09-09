"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmErrorText } from "../../../shared/hooks/useCrmErrorText";
import { useLeadContactsEdit } from "../hooks/useLeadContactsEdit";
import { LeadContactReadCard } from "./LeadContactList";
import type { LeadContactsCardProps } from "./LeadContactsCard";
import { LeadIndividualContactFields } from "./LeadIndividualContactFields";

export function LeadIndividualContactCard({ lead, canEdit, onSaved, onReconcile }: LeadContactsCardProps) {
  const { t } = useI18n();
  const describeError = useCrmErrorText();
  const edit = useLeadContactsEdit(lead, onSaved, onReconcile, canEdit);
  return <>
    <LeadContactReadCard name={lead.displayName} jobTitle={null} email={lead.email}
      phones={lead.phones.length > 0 ? lead.phones : lead.primaryMobile ? [lead.primaryMobile] : []}
      onEdit={canEdit ? edit.startEdit : undefined} />
    <FormModal size="card" density="compact" open={Boolean(edit.form)} onOpenChange={(open) => { if (!open) edit.cancel(); }}
      title={t.crmLeadDetail.editContact} description={lead.displayName}
      isDirty={edit.isDirty} isSubmitting={edit.saving} onSubmit={() => void edit.save()}
      error={describeError(edit.error) ?? undefined}
      labels={{ submit: t.common.save, cancel: t.common.cancel, close: t.common.close,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid }}>
      {edit.form && <LeadIndividualContactFields lead={lead} edit={edit} disabled={edit.saving} />}
    </FormModal>
  </>;
}
