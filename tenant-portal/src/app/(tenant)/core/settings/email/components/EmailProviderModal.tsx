"use client";

import {
  Badge,
  Button,
  Field,
  FormModal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  SELECTABLE_EMAIL_PROVIDER_DRIVERS,
  type EmailConfig,
  type EmailConfigFormValues,
  type EmailProviderDriver,
} from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import {
  buildEmailErrorSummaryItems,
  emailFieldAnchorId,
  type EmailConfigFieldKey,
} from "../email-form-navigation";
import { EmailFormErrorSummary } from "./EmailFormErrorSummary";

const PROVIDER_SUMMARY_FIELDS: readonly EmailConfigFieldKey[] = ["providerDriver", "status"];

interface EmailProviderModalProps {
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

export function EmailProviderModal({
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
}: EmailProviderModalProps) {
  const { t } = useI18n();
  const isLegacyProvider = !SELECTABLE_EMAIL_PROVIDER_DRIVERS.includes(config.providerDriver);
  const summaryItems = buildEmailErrorSummaryItems(fieldErrors, PROVIDER_SUMMARY_FIELDS, t);
  const activationBlocked = !config.dkimVerified && values.status !== "ACTIVE";

  return (
    <FormModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      size="card"
      density="compact"
      bodyClassName="gap-3 px-4 py-3.5"
      title={t.coreSettings.emailExistingProviderModalTitle}
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

      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">
            {t.coreSettings.emailProviderNames[config.providerDriver]}
          </span>
          {config.providerDriver !== "platform-shared" ? (
            <Badge tone={config.providerCredentialsConfigured ? "positive" : "caution"} size="sm">
              {config.providerCredentialsConfigured
                ? t.coreSettings.emailConfigured
                : t.coreSettings.emailNotConfigured}
            </Badge>
          ) : null}
        </div>
        {isLegacyProvider ? (
          <p className="text-xs text-muted-foreground">
            {t.coreSettings.emailExistingProviderNotice}
          </p>
        ) : null}
      </div>

      <div id={emailFieldAnchorId("providerDriver")}>
        <Field
          showLabel
          label={t.coreSettings.emailProvider}
          error={fieldErrors.providerDriver}
          readOnly={readOnly}
        >
          <Select
            value={values.providerDriver}
            onValueChange={(value) => onChange({ providerDriver: value as EmailProviderDriver })}
            disabled={isBusy || readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue>{t.coreSettings.emailProviderNames[values.providerDriver]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {isLegacyProvider ? (
                <SelectItem value={config.providerDriver} disabled>
                  {t.coreSettings.emailProviderNames[config.providerDriver]}
                </SelectItem>
              ) : null}
              {SELECTABLE_EMAIL_PROVIDER_DRIVERS.map((driver) => (
                <SelectItem key={driver} value={driver}>
                  {t.coreSettings.emailProviderNames[driver]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {!readOnly && values.providerDriver === "smtp" ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSmtpSettings}
            disabled={isBusy}
          >
            {t.coreSettings.emailOpenSmtpSettingsAction}
          </Button>
        </div>
      ) : null}

      <div id={emailFieldAnchorId("status")}>
        <Field
          showLabel
          label={t.coreSettings.emailDeliveryStatusTitle}
          hint={
            config.dkimVerified
              ? t.coreSettings.emailStatusHint
              : t.coreSettings.emailActivationRequiresDkim
          }
          error={fieldErrors.status}
          readOnly={readOnly}
        >
          <div className="flex min-h-8 items-center gap-2.5">
            <Switch
              aria-label={t.coreSettings.emailDeliveryStatusTitle}
              checked={values.status === "ACTIVE"}
              onCheckedChange={(checked) =>
                onChange({ status: checked ? "ACTIVE" : "SUSPENDED" })
              }
              disabled={isBusy || readOnly || activationBlocked}
            />
            <Badge tone={values.status === "ACTIVE" ? "positive" : "neutral"} size="sm">
              {t.coreSettings.emailStatusNames[values.status]}
            </Badge>
          </div>
        </Field>
      </div>
    </FormModal>
  );
}
