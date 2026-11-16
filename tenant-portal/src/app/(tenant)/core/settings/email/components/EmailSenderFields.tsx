"use client";

import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  FROM_ADDRESS_MAX_LENGTH,
  FROM_NAME_MAX_LENGTH,
  SELECTABLE_EMAIL_PROVIDER_DRIVERS,
  SENDER_DOMAIN_MAX_LENGTH,
  willResetVerificationTuple,
  type EmailConfig,
  type EmailConfigFormValues,
  type EmailProviderDriver,
} from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import { emailFieldAnchorId } from "../email-form-navigation";

interface EmailSenderFieldsProps {
  config: EmailConfig;
  values: EmailConfigFormValues;
  fieldErrors: EmailConfigFieldErrors;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  onOpenSmtpSettings?: () => void;
  disabled: boolean;
  readOnly: boolean;
}

export function EmailSenderFields({
  config,
  values,
  fieldErrors,
  onChange,
  onOpenSmtpSettings,
  disabled,
  readOnly,
}: EmailSenderFieldsProps) {
  const { t } = useI18n();
  const isLegacyProvider = !SELECTABLE_EMAIL_PROVIDER_DRIVERS.includes(config.providerDriver);
  const resetsVerifiedTuple =
    config.dkimVerified && willResetVerificationTuple(config, values);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div id={emailFieldAnchorId("fromName")}>
          <Field
            showLabel
            label={t.coreSettings.emailFromName}
            error={fieldErrors.fromName}
            readOnly={readOnly}
            required
          >
            <Input
              size="sm"
              value={values.fromName}
              onChange={(event) => onChange({ fromName: event.target.value })}
              maxLength={FROM_NAME_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>
        </div>

        <div id={emailFieldAnchorId("fromAddress")}>
          <Field
            showLabel
            label={t.coreSettings.emailFromAddress}
            hint={t.coreSettings.emailSenderDomainMatchHint}
            error={fieldErrors.fromAddress}
            readOnly={readOnly}
            required
          >
            <Input
              size="sm"
              dir="ltr"
              type="email"
              value={values.fromAddress}
              onChange={(event) => onChange({ fromAddress: event.target.value })}
              maxLength={FROM_ADDRESS_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div id={emailFieldAnchorId("replyTo")}>
          <Field
            showLabel
            label={t.coreSettings.emailReplyTo}
            hint={t.coreSettings.emailReplyToHint}
            error={fieldErrors.replyTo}
            readOnly={readOnly}
          >
            <Input
              size="sm"
              dir="ltr"
              type="email"
              placeholder=""
              value={values.replyTo}
              onChange={(event) => onChange({ replyTo: event.target.value })}
              maxLength={FROM_ADDRESS_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
            />
          </Field>
        </div>

        <div id={emailFieldAnchorId("senderDomain")}>
          <Field
            showLabel
            label={t.coreSettings.emailSenderDomain}
            hint={t.coreSettings.emailSenderDomainHint}
            error={fieldErrors.senderDomain}
            readOnly={readOnly}
            required
          >
            <Input
              size="sm"
              dir="ltr"
              value={values.senderDomain}
              onChange={(event) => onChange({ senderDomain: event.target.value })}
              maxLength={SENDER_DOMAIN_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>
        </div>
      </div>

      <div id={emailFieldAnchorId("providerDriver")}>
        <Field
          showLabel
          label={t.coreSettings.emailProvider}
          hint={isLegacyProvider ? t.coreSettings.emailProviderUnsupported : undefined}
          error={fieldErrors.providerDriver}
          readOnly={readOnly}
        >
          <Select
            value={values.providerDriver}
            onValueChange={(value) => onChange({ providerDriver: value as EmailProviderDriver })}
            disabled={disabled || readOnly}
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

      {!readOnly && values.providerDriver === "smtp" && onOpenSmtpSettings ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSmtpSettings}
            disabled={disabled}
          >
            {t.coreSettings.emailOpenSmtpSettingsAction}
          </Button>
        </div>
      ) : null}

      {resetsVerifiedTuple ? (
        <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
          {t.coreSettings.emailSenderDomainHint}
        </p>
      ) : null}
    </div>
  );
}
