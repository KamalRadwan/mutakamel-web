"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { EmailConfig, EmailConfigFormValues } from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import { buildEmailErrorSummaryItems, type EmailConfigFieldKey } from "../email-form-navigation";
import { EmailFormErrorSummary } from "./EmailFormErrorSummary";
import { EmailSenderFields } from "./EmailSenderFields";

const SENDER_SUMMARY_FIELDS: readonly EmailConfigFieldKey[] = [
  "fromName",
  "fromAddress",
  "replyTo",
  "senderDomain",
  "providerDriver",
];

interface EmailSenderModalProps {
  open: boolean;
  config: EmailConfig;
  values: EmailConfigFormValues;
  fieldErrors: EmailConfigFieldErrors;
  formError: string | null;
  isDirty: boolean;
  isBusy: boolean;
  isSubmitting: boolean;
  readOnly: boolean;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  onOpenSmtpSettings: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function EmailSenderModal({
  open,
  config,
  values,
  fieldErrors,
  formError,
  isDirty,
  isBusy,
  isSubmitting,
  readOnly,
  onChange,
  onOpenSmtpSettings,
  onSave,
  onClose,
}: EmailSenderModalProps) {
  const { t } = useI18n();
  const summaryItems = buildEmailErrorSummaryItems(fieldErrors, SENDER_SUMMARY_FIELDS, t);

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.emailSenderModalTitle}
      isDirty={!isBusy && isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={isBusy || !isDirty}
      hideSubmit={readOnly}
      onSubmit={onSave}
      error={formError ?? undefined}
      labels={{
        submit: t.coreSettings.save,
        cancel: readOnly ? t.common.close : t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
      }}
    >
      <EmailFormErrorSummary items={summaryItems} />
      <EmailSenderFields
        config={config}
        values={values}
        fieldErrors={fieldErrors}
        onChange={onChange}
        onOpenSmtpSettings={onOpenSmtpSettings}
        disabled={isBusy}
        readOnly={readOnly}
      />
    </FormModal>
  );
}
