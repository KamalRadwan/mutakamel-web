"use client";

import {
  Badge,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  SENDER_DOMAIN_MAX_LENGTH,
  SMTP_ALLOWED_PORTS,
  SMTP_PASSWORD_MAX_LENGTH,
  SMTP_PROTOCOLS,
  SMTP_USERNAME_MAX_LENGTH,
  type EmailConfig,
  type EmailConfigFormValues,
  type SmtpProtocol,
} from "../email-config-contract";
import type { EmailConfigFieldErrors } from "../email-config-messages";
import { emailFieldAnchorId } from "../email-form-navigation";

interface EmailProviderFieldsProps {
  config: EmailConfig;
  values: EmailConfigFormValues;
  fieldErrors: EmailConfigFieldErrors;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  disabled: boolean;
  readOnly: boolean;
}

export function EmailProviderFields({
  config,
  values,
  fieldErrors,
  onChange,
  disabled,
  readOnly,
}: EmailProviderFieldsProps) {
  const { t } = useI18n();
  const passwordRequired = config.providerDriver !== "smtp" && !config.smtpPasswordConfigured;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div id={emailFieldAnchorId("smtpHost")}>
          <Field
            showLabel
            label={t.coreSettings.emailSmtpHost}
            error={fieldErrors.smtpHost}
            readOnly={readOnly}
            required
          >
            <Input
              size="sm"
              dir="ltr"
              value={values.smtpHost}
              onChange={(event) => onChange({ smtpHost: event.target.value })}
              maxLength={SENDER_DOMAIN_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>
        </div>

        <div id={emailFieldAnchorId("smtpPort")}>
          <Field
            showLabel
            label={t.coreSettings.emailSmtpPort}
            error={fieldErrors.smtpPort}
            readOnly={readOnly}
            required
          >
            <Select
              value={values.smtpPort}
              onValueChange={(value) => onChange({ smtpPort: value })}
              disabled={disabled || readOnly}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={t.coreSettings.emailSmtpPortPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {SMTP_ALLOWED_PORTS.map((port) => (
                  <SelectItem key={port} value={String(port)}>
                    {String(port)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
        <div id={emailFieldAnchorId("smtpUsername")}>
          <Field
            showLabel
            label={t.coreSettings.emailSmtpUsername}
            error={fieldErrors.smtpUsername}
            readOnly={readOnly}
            required
          >
            <Input
              size="sm"
              dir="ltr"
              autoComplete="off"
              value={values.smtpUsername}
              onChange={(event) => onChange({ smtpUsername: event.target.value })}
              maxLength={SMTP_USERNAME_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>
        </div>

        <div id={emailFieldAnchorId("smtpProtocol")}>
          <Field showLabel label={t.coreSettings.emailSmtpProtocol} readOnly={readOnly}>
            <Select
              value={values.smtpProtocol}
              onValueChange={(value) => onChange({ smtpProtocol: value as SmtpProtocol })}
              disabled={disabled || readOnly}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SMTP_PROTOCOLS.map((protocol) => (
                  <SelectItem key={protocol} value={protocol}>
                    {t.coreSettings.emailSmtpProtocolNames[protocol]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
        <div id={emailFieldAnchorId("smtpPassword")} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={config.smtpPasswordConfigured ? "positive" : "caution"} size="sm">
              {config.smtpPasswordConfigured
                ? t.coreSettings.emailConfigured
                : t.coreSettings.emailNotConfigured}
            </Badge>
          </div>
          <Field
            showLabel
            label={t.coreSettings.emailSmtpPassword}
            hint={
              config.smtpPasswordConfigured
                ? t.coreSettings.emailPasswordStoredHint
                : passwordRequired
                  ? t.coreSettings.emailSmtpPasswordRequired
                  : t.coreSettings.emailPasswordMissingHint
            }
            error={fieldErrors.smtpPassword}
            readOnly={readOnly}
            required={passwordRequired}
          >
            {/* Write-only: never pre-filled with invented bullets, and left blank
                on save so the stored secret survives untouched. */}
            <Input
              size="sm"
              placeholder={
                config.smtpPasswordConfigured
                  ? t.coreSettings.emailPasswordKeepSavedPlaceholder
                  : ""
              }
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={values.smtpPassword}
              onChange={(event) => onChange({ smtpPassword: event.target.value })}
              maxLength={SMTP_PASSWORD_MAX_LENGTH}
              required={passwordRequired}
              disabled={disabled}
              readOnly={readOnly}
            />
          </Field>
        </div>

        <div id={emailFieldAnchorId("smtpSecure")}>
          <Field
            showLabel
            label={t.coreSettings.emailSmtpSecure}
            error={fieldErrors.smtpSecure}
            readOnly={readOnly}
          >
            <div className="flex min-h-8 items-center">
              <Switch
                aria-label={t.coreSettings.emailSmtpSecure}
                checked={values.smtpSecure}
                onCheckedChange={(checked) => onChange({ smtpSecure: checked })}
                disabled={disabled || readOnly}
              />
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}
