"use client";

import { useState } from "react";
import { FormDrawer } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_CURRENCY_FORM, type CurrencyFormValues } from "../currency-contract";
import { CurrencyFormFields } from "./CurrencyFormFields";

interface CreateCurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CurrencyFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateCurrencyModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateCurrencyModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<CurrencyFormValues>(EMPTY_CURRENCY_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_CURRENCY_FORM);

  const close = () => {
    setValues(EMPTY_CURRENCY_FORM);
    onClose();
  };

  const handleSubmit = async () => {
    if (await onSubmit(values)) setValues(EMPTY_CURRENCY_FORM);
  };

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t.coreSettings.currencyCreateTitle}
      description={t.coreSettings.currencyCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void handleSubmit()}
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
        codeReadOnly={false}
        rateLocked={values.isDefault}
        showDefaultToggle
      />
    </FormDrawer>
  );
}
