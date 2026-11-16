"use client";

import { FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  toCurrencyForm,
  type Currency,
  type CurrencyFormValues,
} from "../currency-contract";
import { useCurrencyForm } from "../hooks/useCurrencyForm";
import { CurrencyFormFields } from "./CurrencyFormFields";

interface EditCurrencyModalProps {
  currency: Currency;
  onClose: () => void;
  onSubmit: (values: CurrencyFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  errorCode?: string | null;
  baseCurrencyCode?: string | null;
  activateOnSubmit?: boolean;
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
  errorCode,
  baseCurrencyCode,
  activateOnSubmit = false,
}: EditCurrencyModalProps) {
  const { t } = useI18n();
  const rateRequiredOnEdit =
    !currency.isDefault &&
    (activateOnSubmit || currency.status === "ACTIVE" || currency.exchangeRate !== null);

  const form = useCurrencyForm({
    open: true,
    mode: "edit",
    initialValues: toCurrencyForm(currency),
    codeReadOnly: true,
    rateLocked: currency.isDefault,
    rateRequiredOnEdit,
    isSubmitting,
    error,
    errorCode,
    onClose,
    onSubmit,
  });

  return (
    <FormModal
      open
      onOpenChange={form.handleOpenChange}
      onOpenAutoFocus={form.handleOpenAutoFocus}
      size="card"
      density="compact"
      bodyClassName="px-4 py-3.5"
      title={t.coreSettings.currencyEditTitle}
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
        codeReadOnly
        rateLocked={currency.isDefault}
        rateRequiredOnEdit={rateRequiredOnEdit}
        showDefaultToggle={false}
        baseCurrencyCode={baseCurrencyCode}
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
