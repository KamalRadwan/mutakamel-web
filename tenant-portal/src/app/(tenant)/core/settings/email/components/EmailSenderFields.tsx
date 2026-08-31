"use client";

import {
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
  EMAIL_CONFIG_STATUSES,
  FROM_ADDRESS_MAX_LENGTH,
  FROM_NAME_MAX_LENGTH,
  SENDER_DOMAIN_MAX_LENGTH,
  type EmailConfigFormValues,
  type EmailConfigStatus,
} from "../email-config-contract";

interface EmailSenderFieldsProps {
  values: EmailConfigFormValues;
  onChange: (patch: Partial<EmailConfigFormValues>) => void;
  disabled: boolean;
  readOnly: boolean;
}

export function EmailSenderFields({
  values,
  onChange,
  disabled,
  readOnly,
}: EmailSenderFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field label={t.coreSettings.emailFromAddress} readOnly={readOnly} required>
        <Input
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

      <Field label={t.coreSettings.emailFromName} readOnly={readOnly} required>
        <Input
          value={values.fromName}
          onChange={(event) => onChange({ fromName: event.target.value })}
          maxLength={FROM_NAME_MAX_LENGTH}
          disabled={disabled}
          readOnly={readOnly}
          required
        />
      </Field>

      <Field label={t.coreSettings.emailReplyTo} hint={t.coreSettings.emailReplyToHint} readOnly={readOnly}>
        <Input
          dir="ltr"
          type="email"
          value={values.replyTo}
          onChange={(event) => onChange({ replyTo: event.target.value })}
          maxLength={FROM_ADDRESS_MAX_LENGTH}
          disabled={disabled}
          readOnly={readOnly}
        />
      </Field>

      <Field
        label={t.coreSettings.emailSenderDomain}
        hint={t.coreSettings.emailSenderDomainHint}
        readOnly={readOnly}
        required
      >
        <Input
          dir="ltr"
          value={values.senderDomain}
          onChange={(event) => onChange({ senderDomain: event.target.value })}
          maxLength={SENDER_DOMAIN_MAX_LENGTH}
          disabled={disabled}
          readOnly={readOnly}
          required
        />
      </Field>

      <Field
        label={t.coreSettings.emailDkimSelector}
        hint={t.coreSettings.emailDkimSelectorHint}
        readOnly={readOnly}
      >
        <Input
          dir="ltr"
          value={values.dkimSelector}
          onChange={(event) => onChange({ dkimSelector: event.target.value.toLowerCase() })}
          maxLength={63}
          disabled={disabled}
          readOnly={readOnly}
        />
      </Field>

      <Field label={t.common.status} hint={t.coreSettings.emailStatusHint} readOnly={readOnly}>
        <Select
          value={values.status}
          onValueChange={(value) => onChange({ status: value as EmailConfigStatus })}
          disabled={disabled || readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_CONFIG_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t.coreSettings.emailStatusNames[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
