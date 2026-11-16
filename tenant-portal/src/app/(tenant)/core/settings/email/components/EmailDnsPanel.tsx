"use client";

import {
  Badge,
  CopyButton,
  DateTime,
  Field,
  FormModal,
  IdentifierText,
  Input,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  dkimRecordHost,
  type EmailConfig,
  type EmailConfigFormValues,
} from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import {
  buildEmailErrorSummaryItems,
  emailFieldAnchorId,
  type EmailConfigFieldKey,
} from "../email-form-navigation";
import { EmailFormErrorSummary } from "./EmailFormErrorSummary";

const DNS_SUMMARY_FIELDS: readonly EmailConfigFieldKey[] = ["dkimSelector"];

interface EmailDnsPanelProps {
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
  onSave: () => void;
  onVerify: () => void;
  onClose: () => void;
}

/**
 * Centered compact DNS verification modal.
 *
 * Only the record **host** (`${dkimSelector}._domainkey.${senderDomain}`) is
 * derivable from the API; the expected TXT record value lives in deployment
 * registry data (`TENANT_EMAIL_DKIM_PROOFS_V1_JSON`) and is never exposed to
 * the browser, nor is any SPF record verified here.
 */
export function EmailDnsPanel({
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
  onSave,
  onVerify,
  onClose,
}: EmailDnsPanelProps) {
  const { t, lang } = useI18n();
  const host = dkimRecordHost(config);
  const summaryItems = buildEmailErrorSummaryItems(fieldErrors, DNS_SUMMARY_FIELDS, t);
  const submitLabel = isDirty ? t.coreSettings.save : t.coreSettings.emailVerify;
  const isSubmitting = isDirty ? pending === "save" : pending === "verify";

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.emailDnsTitle}
      isDirty={!isBusy && isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={isBusy}
      hideSubmit={readOnly}
      onSubmit={isDirty ? onSave : onVerify}
      error={formError ?? undefined}
      labels={{
        submit: submitLabel,
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <Badge tone={config.dkimVerified ? "positive" : "caution"} size="sm">
          {config.dkimVerified
            ? t.coreSettings.emailDkimVerified
            : t.coreSettings.emailDkimUnverified}
        </Badge>
        {config.verifiedAt ? (
          <span className="text-xs text-muted-foreground">
            <DateTime value={config.verifiedAt} precision="datetime" language={lang} />
          </span>
        ) : null}
      </div>

      <Field showLabel label={t.coreSettings.emailSenderDomain} readOnly>
        <Input size="sm" dir="ltr" value={config.senderDomain} readOnly />
      </Field>

      <div id={emailFieldAnchorId("dkimSelector")}>
        <Field
          showLabel
          label={t.coreSettings.emailDkimSelector}
          hint={t.coreSettings.emailDkimSelectorHint}
          error={fieldErrors.dkimSelector}
          readOnly={readOnly}
        >
          <Input
            size="sm"
            placeholder=""
            dir="ltr"
            value={values.dkimSelector}
            onChange={(event) => onChange({ dkimSelector: event.target.value.toLowerCase() })}
            maxLength={63}
            disabled={isBusy}
            readOnly={readOnly}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t.coreSettings.emailDkimHost}
        </span>
        {host === null ? (
          <span className="text-xs text-muted-foreground">{t.coreSettings.emailNotConfigured}</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <IdentifierText selectAll className="text-xs text-foreground">
              {host}
            </IdentifierText>
            <CopyButton
              value={host}
              copyLabel={`${t.coreSettings.emailCopyValue}: ${t.coreSettings.emailDkimHost}`}
              copiedLabel={t.coreSettings.emailCopied}
              failedLabel={t.coreSettings.emailCopyFailed}
            />
          </span>
        )}
      </div>

      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t.coreSettings.emailDnsValueUnavailableNote}
      </p>

      {!readOnly && isDirty ? (
        <p className="text-xs text-muted-foreground">{t.coreSettings.emailSaveBeforeVerifyHint}</p>
      ) : null}
    </FormModal>
  );
}
