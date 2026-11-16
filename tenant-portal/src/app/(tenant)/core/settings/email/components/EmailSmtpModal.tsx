"use client";

import { PlugZap } from "lucide-react";
import { Button, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { EmailConfig, EmailConfigFormValues } from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import { buildEmailErrorSummaryItems, type EmailConfigFieldKey } from "../email-form-navigation";
import { EmailFormErrorSummary } from "./EmailFormErrorSummary";
import { EmailProviderFields } from "./EmailProviderFields";

const SMTP_SUMMARY_FIELDS: readonly EmailConfigFieldKey[] = [
  "smtpHost",
  "smtpPort",
  "smtpUsername",
  "smtpProtocol",
  "smtpPassword",
  "smtpSecure",
];

interface EmailSmtpModalProps {
  open: boolean;
  config: EmailConfig;
  values: EmailConfigFormValues;
  fieldErrors: EmailConfigFieldErrors;
  formError: string | null;
  isDirty: boolean;
  isBusy: boolean;
  pending: "save" | "verify" | "probe" | null;
  readOnly: boolean;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  onVerifyConnection: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function EmailSmtpModal({
  open,
  config,
  values,
  fieldErrors,
  formError,
  isDirty,
  isBusy,
  pending,
  readOnly,
  onChange,
  onVerifyConnection,
  onSave,
  onClose,
}: EmailSmtpModalProps) {
  const { t } = useI18n();
  const summaryItems = buildEmailErrorSummaryItems(fieldErrors, SMTP_SUMMARY_FIELDS, t);
  const probeRequiresSave = isDirty || config.providerDriver !== "smtp";

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.emailSmtpModalTitle}
      isDirty={!isBusy && isDirty}
      isSubmitting={pending === "save"}
      submitDisabled={isBusy || !isDirty}
      hideSubmit={readOnly}
      onSubmit={onSave}
      error={formError ?? undefined}
      footerLeading={
        !readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onVerifyConnection}
            disabled={isBusy || probeRequiresSave}
            loading={pending === "probe"}
          >
            <PlugZap className="size-3.5" aria-hidden="true" />
            {t.coreSettings.emailVerifyConnection}
          </Button>
        ) : undefined
      }
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
      <EmailProviderFields
        config={config}
        values={values}
        fieldErrors={fieldErrors}
        onChange={onChange}
        disabled={isBusy}
        readOnly={readOnly}
      />
      {!readOnly && probeRequiresSave ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t.coreSettings.emailSaveBeforeVerifyHint}
        </p>
      ) : null}
    </FormModal>
  );
}
