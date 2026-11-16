"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_CURRENCY_FORM, type CurrencyFormValues } from "../currency-contract";
import type { BaseCurrencyStatus } from "../hooks/useBaseCurrency";
import { useCurrencyForm } from "../hooks/useCurrencyForm";
import { CurrencyFormFields } from "./CurrencyFormFields";

interface CreateCurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CurrencyFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  errorCode?: string | null;
  baseStatus?: BaseCurrencyStatus;
  baseCurrencyCode?: string | null;
}

export function CreateCurrencyModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  errorCode,
  baseStatus,
  baseCurrencyCode,
}: CreateCurrencyModalProps) {
  const { t } = useI18n();
  const form = useCurrencyForm({
    open: isOpen,
    mode: "create",
    initialValues: EMPTY_CURRENCY_FORM,
    codeReadOnly: false,
    rateLocked: false,
    baseStatus,
    baseCurrencyCode,
    isSubmitting,
    error,
    errorCode,
    onClose,
    onSubmit,
  });

  return (
    <FormModal
      open={isOpen}
      onOpenChange={form.handleOpenChange}
      onOpenAutoFocus={form.handleOpenAutoFocus}
      size="card"
      density="compact"
      bodyClassName="px-4 py-3.5"
      title={t.coreSettings.currencyCreateTitle}
      isDirty={form.isDirty && !form.busy}
      isSubmitting={form.busy}
      onSubmit={() => void form.handleSubmit()}
      error={form.generalError}
      labels={{
        submit: t.coreSettings.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav,
        sectionInvalid: t.crmShared.formSectionInvalid,
        close: t.common.close,
      }}
    >
      <CurrencyFormFields
        values={form.values}
        onChange={form.handleChange}
        isSubmitting={form.busy}
        codeReadOnly={false}
        rateLocked={false}
        showDefaultToggle
        baseStatus={baseStatus}
        baseCurrencyCode={baseCurrencyCode}
        firstCurrencyDefault={form.isFirstCurrency}
        rateRequired={form.rateRequired}
        errors={form.fieldErrors}
        errorSummary={form.errorSummary}
        anchorIds={form.anchorIds}
        fieldRefs={form.fieldRefs}
        onBlurField={form.handleBlur}
        onFocusField={form.focusField}
      />
    </FormModal>
  );
}
