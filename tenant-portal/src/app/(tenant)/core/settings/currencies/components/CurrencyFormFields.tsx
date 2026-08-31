"use client";

import { Field, Input, Switch } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CURRENCY_CODE_LENGTH,
  CURRENCY_NAME_MAX_LENGTH,
  CURRENCY_SYMBOL_MAX_LENGTH,
  type CurrencyFormValues,
} from "../currency-contract";

interface CurrencyFormFieldsProps {
  values: CurrencyFormValues;
  onChange: (patch: Partial<CurrencyFormValues>) => void;
  isSubmitting: boolean;
  /** The code is immutable after creation — `UpdateCurrencyDto` has no `code`. */
  codeReadOnly: boolean;
  /** The server pins the default currency's rate to 1 and ignores any other. */
  rateLocked: boolean;
  showDefaultToggle: boolean;
}

export function CurrencyFormFields({
  values,
  onChange,
  isSubmitting,
  codeReadOnly,
  rateLocked,
  showDefaultToggle,
}: CurrencyFormFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.coreSettings.currencyCode}
        hint={t.coreSettings.currencyCodeHint}
        readOnly={codeReadOnly}
        required
      >
        <Input
          dir="ltr"
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          maxLength={CURRENCY_CODE_LENGTH}
          disabled={isSubmitting}
          readOnly={codeReadOnly}
          required
        />
      </Field>

      <Field label={t.coreSettings.currencyName} required>
        <Input
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          maxLength={CURRENCY_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={t.coreSettings.currencySymbol}>
        <Input
          value={values.symbol}
          onChange={(event) => onChange({ symbol: event.target.value })}
          maxLength={CURRENCY_SYMBOL_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.coreSettings.currencyDecimalPlaces} hint={t.coreSettings.currencyDecimalPlacesHint}>
        <Input
          dir="ltr"
          inputMode="numeric"
          value={values.decimalPlaces}
          onChange={(event) => onChange({ decimalPlaces: event.target.value })}
          maxLength={1}
          disabled={isSubmitting}
        />
      </Field>

      <Field
        label={t.coreSettings.currencyExchangeRate}
        hint={rateLocked ? t.coreSettings.currencyRateLockedHint : t.coreSettings.currencyRateHint}
        readOnly={rateLocked}
        required={!rateLocked}
      >
        <Input
          dir="ltr"
          inputMode="decimal"
          value={values.exchangeRate}
          onChange={(event) => onChange({ exchangeRate: event.target.value })}
          disabled={isSubmitting}
          readOnly={rateLocked}
        />
      </Field>

      {showDefaultToggle ? (
        <Field label={t.coreSettings.currencyMakeDefault} hint={t.coreSettings.currencyMakeDefaultHint}>
          <Switch
            checked={values.isDefault}
            onCheckedChange={(checked) => onChange({ isDefault: checked })}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}
    </div>
  );
}
