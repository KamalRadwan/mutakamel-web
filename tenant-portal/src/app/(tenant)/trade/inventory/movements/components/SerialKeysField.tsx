"use client";

import { Field, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { buildSerialSelection } from "../serial-input";

export function SerialKeysField({ value, quantity, onChange, disabled, subset = false }: {
  value: string;
  quantity?: string;
  onChange: (value: string) => void;
  disabled: boolean;
  subset?: boolean;
}) {
  const { t } = useI18n();
  let invalid = false;
  try { buildSerialSelection(value, quantity?.trim() || undefined); } catch { invalid = true; }
  return (
    <Field label={t.tradeInventory.serialKeysLabel} showLabel
      hint={subset ? t.tradeInventory.serialSubsetHint : t.tradeInventory.serialArrayHint}
      error={invalid ? t.tradeInventory.serialSelectionInvalid : undefined}>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)}
        disabled={disabled} rows={3} dir="ltr" />
    </Field>
  );
}
