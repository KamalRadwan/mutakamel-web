"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { toCurrencyForm, type Currency, type CurrencyFormValues } from "../currency-contract";
import { CurrencyFormFields } from "./CurrencyFormFields";

interface EditCurrencyModalProps {
  currency: Currency;
  onClose: () => void;
  onSubmit: (values: CurrencyFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Mounted only while a row is selected, and keyed on that row's id by the
 * screen, so the initial form state is the selected currency by construction
 * rather than by a reset effect.
 */
export function EditCurrencyModal({
  currency,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: EditCurrencyModalProps) {
  const { t } = useI18n();
  const initial = toCurrencyForm(currency);
  const [values, setValues] = useState<CurrencyFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.coreSettings.currencyEditTitle}
      description={currency.code}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.coreSettings.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <CurrencyFormFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        codeReadOnly
        rateLocked={currency.isDefault}
        showDefaultToggle={false}
      />
    </FormDrawer>
  );
}
