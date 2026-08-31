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
  EMAIL_PROVIDER_DRIVERS,
  SMTP_ALLOWED_PORTS,
  SMTP_PASSWORD_MAX_LENGTH,
  SMTP_PROTOCOLS,
  SMTP_USERNAME_MAX_LENGTH,
  type EmailConfig,
  type EmailConfigFormValues,
  type EmailProviderDriver,
  type SmtpProtocol,
} from "../email-config-contract";

interface EmailProviderFieldsProps {
  config: EmailConfig;
  values: EmailConfigFormValues;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  disabled: boolean;
  readOnly: boolean;
}

export function EmailProviderFields({
  config,
  values,
  onChange,
  disabled,
  readOnly,
}: EmailProviderFieldsProps) {
  const { t } = useI18n();
  const isSmtp = values.providerDriver === "smtp";

  return (
    <div className="flex flex-col gap-4">
      <Field label={t.coreSettings.emailProvider} readOnly={readOnly}>
        <Select
          value={values.providerDriver}
          onValueChange={(value) => onChange({ providerDriver: value as EmailProviderDriver })}
          disabled={disabled || readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_PROVIDER_DRIVERS.map((driver) => (
              <SelectItem key={driver} value={driver}>
                {t.coreSettings.emailProviderNames[driver]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t.coreSettings.emailCredentials}</span>
        {/* The API returns presence, never a value. Rendering a fake masked
            string would claim knowledge of a secret this client never sees. */}
        <Badge tone={config.providerCredentialsConfigured ? "positive" : "caution"}>
          {config.providerCredentialsConfigured
            ? t.coreSettings.emailConfigured
            : t.coreSettings.emailNotConfigured}
        </Badge>
        <Badge tone="neutral">{t.coreSettings.emailCredentialsModes[config.credentialsMode]}</Badge>
      </div>

      {isSmtp ? (
        <>
          <Field label={t.coreSettings.emailSmtpHost} readOnly={readOnly} required>
            <Input
              dir="ltr"
              value={values.smtpHost}
              onChange={(event) => onChange({ smtpHost: event.target.value })}
              maxLength={253}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>

          <Field label={t.coreSettings.emailSmtpPort} hint={t.coreSettings.emailSmtpPortHint} readOnly={readOnly}>
            <Select
              value={values.smtpPort}
              onValueChange={(value) => onChange({ smtpPort: value })}
              disabled={disabled || readOnly}
            >
              <SelectTrigger>
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

          <Field label={t.coreSettings.emailSmtpProtocol} readOnly={readOnly}>
            <Select
              value={values.smtpProtocol}
              onValueChange={(value) => onChange({ smtpProtocol: value as SmtpProtocol })}
              disabled={disabled || readOnly}
            >
              <SelectTrigger>
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

          <Field label={t.coreSettings.emailSmtpSecure} readOnly={readOnly}>
            <Switch
              checked={values.smtpSecure}
              onCheckedChange={(checked) => onChange({ smtpSecure: checked })}
              disabled={disabled || readOnly}
            />
          </Field>

          <Field label={t.coreSettings.emailSmtpUsername} readOnly={readOnly} required>
            <Input
              dir="ltr"
              value={values.smtpUsername}
              onChange={(event) => onChange({ smtpUsername: event.target.value })}
              maxLength={SMTP_USERNAME_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
              required
            />
          </Field>

          <Field
            label={t.coreSettings.emailSmtpPassword}
            hint={
              config.smtpPasswordConfigured
                ? t.coreSettings.emailPasswordStoredHint
                : t.coreSettings.emailPasswordMissingHint
            }
            readOnly={readOnly}
          >
            {/* Write-only: never pre-filled, and left blank on save so the
                stored secret survives an edit that did not retype it. */}
            <Input
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={values.smtpPassword}
              onChange={(event) => onChange({ smtpPassword: event.target.value })}
              maxLength={SMTP_PASSWORD_MAX_LENGTH}
              disabled={disabled}
              readOnly={readOnly}
            />
          </Field>
        </>
      ) : null}
    </div>
  );
}
